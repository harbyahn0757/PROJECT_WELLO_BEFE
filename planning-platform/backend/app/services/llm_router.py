"""
LLM Router — Gemini/OpenAI 프로바이더 자동 전환 싱글턴

State Machine:
  HEALTHY  → Gemini 정상 동작
  DEGRADED → Gemini 실패, OpenAI 폴백
  DOWN     → 두 프로바이더 모두 실패, 위젯 fail-closed

슬라이딩 윈도우 카운터로 임계값 초과 시 상태 전환.
백그라운드 복구 루프로 Gemini 재가동 감지.
Redis override poll로 수동 제어 지원.
"""

from enum import Enum
import asyncio
import time
import logging
from collections import deque
from datetime import datetime, timezone
from typing import Optional, AsyncGenerator, Dict, Any, List

logger = logging.getLogger(__name__)


class LLMState(str, Enum):
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    DOWN = "DOWN"


class ErrorClass(str, Enum):
    PERMANENT = "PERMANENT"   # 403/401/invalid_key → 즉시 전환
    QUOTA = "QUOTA"           # 429/RESOURCE_EXHAUSTED → 카운터 +1
    TRANSIENT = "TRANSIENT"   # 5xx/timeout → retry 후 실패면 +1
    UNKNOWN = "UNKNOWN"


# 모델 매핑 (Gemini → OpenAI 폴백)
GEMINI_TO_OPENAI_MODEL: Dict[str, str] = {
    "gemini-3-flash-preview": "gpt-4o-mini",
    "gemini-2.0-flash": "gpt-4o-mini",
    "gemini-2.5-flash-lite": "gpt-4o-mini",
    "gemini-2.5-flash": "gpt-4o-mini",
    "gemini-2.5-pro": "gpt-4o",
}
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"

RECOVERY_SUCCESS_REQUIRED = 2   # Gemini 복귀 판정에 필요한 연속 성공 수
TRANSITION_COOLDOWN = 10        # 동일 전환 재진입 방지 (초)
ALERT_DEDUP_SECONDS = 60        # Slack 알림 중복 억제 (초)


def classify_error(exc: Exception) -> ErrorClass:
    """예외를 분류 — 메시지 문자열 매칭 + 타입 확인"""
    msg = str(exc).lower()
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError)):
        return ErrorClass.TRANSIENT
    for kw in ("403", "permission_denied", "project denied access",
               "api key not valid", "401", "unauthenticated",
               "invalid_api_key", "api key expired"):
        if kw in msg:
            return ErrorClass.PERMANENT
    for kw in ("429", "resource_exhausted", "quota", "rate limit", "rpm"):
        if kw in msg:
            return ErrorClass.QUOTA
    for kw in ("503", "unavailable", "500", "502", "504", "timeout", "connection"):
        if kw in msg:
            return ErrorClass.TRANSIENT
    return ErrorClass.UNKNOWN


class LLMRouter:
    """Gemini/OpenAI 자동 폴백 라우터 (in-memory 싱글턴)"""

    def __init__(self):
        self._state: LLMState = LLMState.HEALTHY
        self._state_entered_at: float = time.monotonic()
        self._state_entered_iso: str = datetime.now(timezone.utc).isoformat()
        self._lock: asyncio.Lock = asyncio.Lock()
        self._failures: deque = deque()          # (ts, provider, err_class)
        self._recovery_task: Optional[asyncio.Task] = None
        self._recovery_success_count: Dict[str, int] = {"gemini": 0, "openai": 0}
        self._last_alert_key: Optional[str] = None
        self._last_alert_at: float = 0.0
        self._last_transition_at: float = 0.0
        self._last_transition_key: Optional[str] = None
        self._override_state: Optional[str] = None
        self._override_widgets: Dict[str, str] = {}
        self._override_task: Optional[asyncio.Task] = None

    # ── 설정 프로퍼티 (settings 지연 참조로 circular import 방지) ──────────
    @property
    def _cfg(self):
        from ..core.config import settings
        return settings

    @property
    def _window_seconds(self) -> int:
        return getattr(self._cfg, "llm_window_seconds", 60)

    @property
    def _failure_threshold(self) -> int:
        return getattr(self._cfg, "llm_failure_threshold", 5)

    @property
    def _degraded_holdoff(self) -> int:
        return getattr(self._cfg, "llm_degraded_holdoff", 60)

    @property
    def _down_holdoff(self) -> int:
        return getattr(self._cfg, "llm_down_holdoff", 30)

    @property
    def _recovery_degraded_interval(self) -> int:
        return getattr(self._cfg, "llm_recovery_degraded_interval", 300)

    @property
    def _recovery_down_interval(self) -> int:
        return getattr(self._cfg, "llm_recovery_down_interval", 120)

    # ── Public API ─────────────────────────────────────────────────────────
    @property
    def state(self) -> LLMState:
        if self._override_state in ("HEALTHY", "DEGRADED", "DOWN"):
            return LLMState(self._override_state)
        return self._state

    def state_entered_at_iso(self) -> str:
        return self._state_entered_iso

    def get_widget_overrides(self) -> Dict[str, str]:
        return dict(self._override_widgets)

    async def start(self):
        """FastAPI startup_event에서 호출"""
        if self._recovery_task is None or self._recovery_task.done():
            self._recovery_task = asyncio.create_task(self._recovery_loop())
        if self._override_task is None or self._override_task.done():
            self._override_task = asyncio.create_task(self._override_poll_loop())
        logger.info("[LLMRouter] started (state=%s)", self._state.value)

    async def stop(self):
        """FastAPI shutdown_event에서 호출"""
        for t in (self._recovery_task, self._override_task):
            if t and not t.done():
                t.cancel()

    async def call_api(self, request: Any, **kwargs) -> Any:
        """Gemini 우선 호출, 실패 시 OpenAI 폴백. GeminiResponse 호환 반환."""
        from .gemini_service import gemini_service, GeminiResponse
        state = self.state

        if state == LLMState.HEALTHY:
            try:
                resp = await gemini_service.call_api(request, **kwargs)
                if resp.success:
                    return resp
                await self._record_failure("gemini", Exception(resp.error or "unknown"))
                if self.state == LLMState.DEGRADED:
                    return await self._call_openai(request, **kwargs)
                return resp
            except Exception as e:
                await self._record_failure("gemini", e)
                if self.state == LLMState.DEGRADED:
                    return await self._call_openai(request, **kwargs)
                raise

        if state == LLMState.DEGRADED:
            return await self._call_openai(request, **kwargs)

        # DOWN
        from .gemini_service import GeminiResponse
        return GeminiResponse(success=False, error="LLM services unavailable (DOWN)")

    async def stream_api(
        self,
        request: Any,
        session_id: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """스트리밍 호출. 시작 전 provider 결정, 시작 후 동일 provider 유지."""
        from .gemini_service import gemini_service
        state = self.state

        if state == LLMState.HEALTHY:
            try:
                gen = gemini_service.stream_api(request, session_id=session_id)
                first = None
                try:
                    first = await gen.__anext__()
                except StopAsyncIteration:
                    return
                except Exception as e:
                    await self._record_failure("gemini", e)
                    # 아래로 흘러 OpenAI 시도
                else:
                    yield first
                    try:
                        async for chunk in gen:
                            yield chunk
                    except Exception as e:
                        logger.error("[LLMRouter] gemini stream mid-fail: %s", e)
                        await self._record_failure("gemini", e)
                    return
            except Exception as e:
                await self._record_failure("gemini", e)

        # DEGRADED or HEALTHY 후 Gemini 첫 청크 실패 → OpenAI
        if self.state in (LLMState.HEALTHY, LLMState.DEGRADED):
            try:
                gpt_req = self._to_gpt_request(request)
                from .gpt_service import gpt_service
                async for chunk in gpt_service.stream_api(gpt_req, session_id=session_id):
                    yield chunk
                return
            except Exception as e:
                logger.error("[LLMRouter] openai stream failed: %s", e)
                await self._record_failure("openai", e)

        yield "죄송합니다. 서비스가 일시 점검 중입니다. 잠시 후 다시 시도해 주세요."

    async def check_health(self) -> Dict[str, Any]:
        """기존 gemini_service.check_health 래퍼"""
        from .gemini_service import gemini_service
        state = self.state
        if state == LLMState.HEALTHY:
            return await gemini_service.check_health()
        if state == LLMState.DEGRADED:
            return {"healthy": True, "provider": "openai", "degraded": True}
        return {"healthy": False, "provider": None, "error": "all providers down"}

    # ── Internal helpers ────────────────────────────────────────────────────
    async def _call_openai(self, request: Any, **kwargs) -> Any:
        from .gpt_service import gpt_service, GPTResponse
        from .gemini_service import GeminiResponse
        try:
            gpt_req = self._to_gpt_request(request)
            gpt_resp = await gpt_service.call_api(
                gpt_req,
                save_log=kwargs.get("save_log", True),
                patient_uuid=kwargs.get("patient_uuid"),
                session_id=kwargs.get("session_id"),
                step_number=kwargs.get("step_number"),
                step_name=kwargs.get("step_name"),
            )
            return GeminiResponse(
                content=gpt_resp.content,
                success=gpt_resp.success,
                error=gpt_resp.error,
                usage=gpt_resp.usage,
            )
        except Exception as e:
            await self._record_failure("openai", e)
            from .gemini_service import GeminiResponse
            return GeminiResponse(success=False, error=f"openai fallback failed: {e}")

    def _to_gpt_request(self, req: Any) -> Any:
        """GeminiRequest → GPTRequest 변환"""
        from .gpt_service import GPTRequest
        model = GEMINI_TO_OPENAI_MODEL.get(req.model, DEFAULT_OPENAI_MODEL)
        chat_history: List[Dict[str, str]] = []
        if req.chat_history:
            for h in req.chat_history:
                if not isinstance(h, dict):
                    continue
                role = h.get("role", "user")
                if role == "model":
                    role = "assistant"
                if role not in ("user", "assistant", "system"):
                    continue
                content = h.get("content") or ""
                if content:
                    chat_history.append({"role": role, "content": content})
        # OpenAI 폴백 시 max_tokens 상한 1500 (gpt-4o-mini 스트리밍 속도 확보)
        # Gemini는 기본 4096이나 OpenAI는 길어지면 10초+ 소요 → RAG 응답은 1500이면 충분
        fallback_max_tokens = min(req.max_tokens or 2000, 1500)
        return GPTRequest(
            system_message=req.system_instruction or "",
            user_message=req.prompt,
            model=model,
            temperature=req.temperature,
            max_tokens=fallback_max_tokens,
            response_format=req.response_format,
            chat_history=chat_history if chat_history else None,
        )

    async def _record_failure(self, provider: str, exc: Exception):
        async with self._lock:
            now = time.monotonic()
            err_class = classify_error(exc)
            logger.warning("[LLMRouter] failure: provider=%s class=%s err=%s",
                           provider, err_class.value, str(exc)[:120])

            if err_class == ErrorClass.PERMANENT:
                if provider == "gemini":
                    self._transition_locked(LLMState.DEGRADED, f"gemini PERMANENT: {str(exc)[:80]}")
                elif provider == "openai":
                    self._transition_locked(LLMState.DOWN, f"openai PERMANENT: {str(exc)[:80]}")
                return

            self._failures.append((now, provider, err_class))
            cutoff = now - self._window_seconds
            while self._failures and self._failures[0][0] < cutoff:
                self._failures.popleft()

            provider_count = sum(1 for _, p, _ in self._failures if p == provider)
            if provider_count >= self._failure_threshold:
                if provider == "gemini":
                    self._transition_locked(
                        LLMState.DEGRADED,
                        f"gemini threshold {provider_count}/{self._window_seconds}s",
                    )
                elif provider == "openai":
                    self._transition_locked(
                        LLMState.DOWN,
                        f"openai threshold {provider_count}/{self._window_seconds}s",
                    )

    def _transition_locked(self, new_state: LLMState, reason: str):
        """Lock 내에서만 호출. 상태 전환 + Slack 알림 예약."""
        old = self._state
        if old == new_state:
            return

        now = time.monotonic()
        trans_key = f"{old.value}->{new_state.value}"
        if trans_key == self._last_transition_key and (now - self._last_transition_at) < TRANSITION_COOLDOWN:
            logger.info("[LLMRouter] transition skipped by cooldown: %s", trans_key)
            return

        self._state = new_state
        self._state_entered_at = now
        self._state_entered_iso = datetime.now(timezone.utc).isoformat()
        self._failures.clear()
        self._recovery_success_count = {"gemini": 0, "openai": 0}
        self._last_transition_at = now
        self._last_transition_key = trans_key

        logger.warning("[LLMRouter] STATE TRANSITION: %s -> %s (%s)",
                       old.value, new_state.value, reason)
        asyncio.create_task(self._notify_state_change(old, new_state, reason))

    async def _notify_state_change(self, old: LLMState, new: LLMState, reason: str):
        now = time.monotonic()
        key = f"{old.value}->{new.value}"
        if key == self._last_alert_key and (now - self._last_alert_at) < ALERT_DEDUP_SECONDS:
            return
        self._last_alert_key = key
        self._last_alert_at = now

        templates = {
            "HEALTHY->DEGRADED": ("⚠️ WELNO LLM Fallback 활성화",
                                   f"Gemini → OpenAI 전환\nReason: {reason}"),
            "DEGRADED->HEALTHY": ("✅ WELNO LLM 복구",
                                   f"Gemini 재개\nReason: {reason}"),
            "DEGRADED->DOWN": ("🚨 WELNO LLM 전면 중단",
                                f"Gemini + OpenAI 둘 다 실패. RAG 위젯 미노출\nReason: {reason}"),
            "DOWN->DEGRADED": ("🔶 WELNO LLM 부분 복구",
                                f"OpenAI 재개\nReason: {reason}"),
            "DOWN->HEALTHY": ("✅ WELNO LLM 완전 복구",
                               f"Gemini 재개\nReason: {reason}"),
            "HEALTHY->DOWN": ("🚨 WELNO LLM 전면 중단",
                               f"둘 다 실패\nReason: {reason}"),
        }
        title, message = templates.get(key, (f"WELNO LLM State: {key}", reason))
        try:
            from .slack_service import get_slack_service, AlertType
            from ..core.config import settings
            if settings.slack_webhook_url:
                slack = get_slack_service(settings.slack_webhook_url)
                await slack.send_error_alert(AlertType.API_ERROR, {
                    "error_type": title,
                    "location": "llm_router:state_change",
                    "error_message": message,
                    "uuid": "system",
                })
        except Exception as e:
            logger.warning("[LLMRouter] slack notify failed: %s", e)

    # ── Recovery loop ──────────────────────────────────────────────────────
    async def _recovery_loop(self):
        logger.info("[LLMRouter] recovery loop started")
        while True:
            try:
                state = self._state
                if state == LLMState.DEGRADED:
                    if (time.monotonic() - self._state_entered_at) < self._degraded_holdoff:
                        await asyncio.sleep(10)
                        continue
                    await asyncio.sleep(self._recovery_degraded_interval)
                    await self._check_gemini_quiet()
                elif state == LLMState.DOWN:
                    if (time.monotonic() - self._state_entered_at) < self._down_holdoff:
                        await asyncio.sleep(5)
                        continue
                    await asyncio.sleep(self._recovery_down_interval)
                    await self._check_openai_quiet()
                    if self._state == LLMState.DOWN:
                        await self._check_gemini_quiet()
                else:
                    await asyncio.sleep(60)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error("[LLMRouter] recovery loop error: %s", e)
                await asyncio.sleep(30)

    async def _check_gemini_quiet(self):
        try:
            from .gemini_service import gemini_service
            result = await gemini_service.check_health()
            if result.get("healthy"):
                self._recovery_success_count["gemini"] += 1
                logger.info("[LLMRouter] gemini recovery ping ok (%d/%d)",
                            self._recovery_success_count["gemini"], RECOVERY_SUCCESS_REQUIRED)
                if self._recovery_success_count["gemini"] >= RECOVERY_SUCCESS_REQUIRED:
                    async with self._lock:
                        self._transition_locked(LLMState.HEALTHY, "gemini recovered")
            else:
                self._recovery_success_count["gemini"] = 0
        except Exception as e:
            self._recovery_success_count["gemini"] = 0
            logger.debug("[LLMRouter] gemini ping failed: %s", e)

    async def _check_openai_quiet(self):
        try:
            from .gpt_service import gpt_service, GPTRequest
            test_req = GPTRequest(
                system_message="",
                user_message="ping",
                model=DEFAULT_OPENAI_MODEL,
                temperature=0.0,
                max_tokens=5,
            )
            resp = await gpt_service.call_api(test_req, save_log=False)
            if resp.success:
                logger.info("[LLMRouter] openai recovery ping ok")
                async with self._lock:
                    self._transition_locked(LLMState.DEGRADED, "openai recovered")
        except Exception as e:
            logger.debug("[LLMRouter] openai ping failed: %s", e)

    # ── Redis override poll ─────────────────────────────────────────────────
    async def _override_poll_loop(self):
        logger.info("[LLMRouter] override poll loop started")
        while True:
            try:
                await asyncio.to_thread(self._poll_redis_override_sync)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.debug("[LLMRouter] override poll error: %s", e)
            await asyncio.sleep(30)

    def _poll_redis_override_sync(self):
        try:
            import redis
            from ..core.config import settings
            redis_url = getattr(settings, "redis_url", "redis://10.0.1.10:6379/0")
            client = redis.from_url(redis_url, decode_responses=True, socket_timeout=3)
            state_override = client.get("welno:llm:override:state")
            self._override_state = (
                state_override if state_override in ("HEALTHY", "DEGRADED", "DOWN") else None
            )
            new_widgets: Dict[str, str] = {}
            for widget_key in ("rag_chat", "survey", "character_intro"):
                val = client.get(f"welno:widget:override:{widget_key}")
                if val in ("enabled", "disabled"):
                    new_widgets[widget_key] = val
            self._override_widgets = new_widgets
        except Exception as e:
            logger.debug("[LLMRouter] redis override poll skipped: %s", e)


# 싱글턴 인스턴스
llm_router = LLMRouter()
