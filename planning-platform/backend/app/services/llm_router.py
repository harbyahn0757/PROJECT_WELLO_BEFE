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
from typing import Optional, AsyncGenerator, Dict, Any, List, Tuple

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


class QuotaGuard:
    """엔드포인트별 일별/시간별 호출 상한 카운터 (in-memory 폴백 포함)

    P0-E5: 일별 USD 비용 누적 + cap (warn/block) — 4월 사고 메커니즘 무관 차단
    P0-E6: 5분 sliding window spike 감지 (분당 폭주 즉시 감지)
    """

    def __init__(self):
        self._daily: Dict[str, int] = {}    # {endpoint:date_str: count}
        self._hourly: Dict[str, int] = {}   # {endpoint:date_hour_str: count}
        self._daily_usd: Dict[str, float] = {}  # {date_str: usd_total}  — 전체 endpoint 합산
        self._monthly_usd: Dict[str, float] = {}  # M1: {YYYY-MM: usd_total}
        self._minute_calls: Dict[str, int] = {}  # {YYYY-MM-DDTHH:MM: count} — 5분 spike
        # M6-M9 트렌드 (2026 LLM observability)
        self._minute_results: Dict[str, Dict[str, int]] = {}  # {minute: {ok:N, fail:N}} — error rate spike
        self._endpoint_token_avg: Dict[str, float] = {}  # endpoint 별 input_tokens EWMA — token spike
        self._endpoint_token_n: Dict[str, int] = {}  # EWMA 표본 수
        self._session_cost_usd: Dict[str, float] = {}  # {YYYY-MM-DD:session_id: usd} — per-session 누적
        self._quota_alert_at: Dict[str, float] = {}  # Slack dedup 1h

    def _daily_key(self, endpoint: str) -> str:
        from datetime import date
        return f"{endpoint}:{date.today().isoformat()}"

    def _hourly_key(self, endpoint: str) -> str:
        from datetime import datetime as _dt
        now = _dt.now()
        return f"{endpoint}:{now.strftime('%Y-%m-%dT%H')}"

    def check(self, endpoint: str, daily_ceiling: int, hourly_ceiling: int) -> bool:
        """True = 허용, False = 초과"""
        dk = self._daily_key(endpoint)
        hk = self._hourly_key(endpoint)
        if self._daily.get(dk, 0) >= daily_ceiling:
            return False
        if self._hourly.get(hk, 0) >= hourly_ceiling:
            return False
        return True

    def record(self, endpoint: str, daily_ceiling: int = 0) -> float:
        """카운터 +1, daily_ceiling 대비 사용률 반환 (0.0~1.0+). 80% 사전 경고 트리거용."""
        dk = self._daily_key(endpoint)
        hk = self._hourly_key(endpoint)
        self._daily[dk] = self._daily.get(dk, 0) + 1
        self._hourly[hk] = self._hourly.get(hk, 0) + 1
        if daily_ceiling > 0:
            return self._daily[dk] / daily_ceiling
        return 0.0

    def get_daily_count(self, endpoint: str) -> int:
        return self._daily.get(self._daily_key(endpoint), 0)

    def should_alert(self, endpoint: str) -> bool:
        """Slack 알림 dedup 1h"""
        last = self._quota_alert_at.get(endpoint, 0.0)
        if time.monotonic() - last >= 3600:
            self._quota_alert_at[endpoint] = time.monotonic()
            return True
        return False

    # ── P0-E5 비용 누적 & cap
    def _today_str(self) -> str:
        from datetime import date
        return date.today().isoformat()

    def _month_str(self) -> str:
        from datetime import date
        return date.today().strftime("%Y-%m")

    def add_cost(self, usd: float, session_id: Optional[str] = None) -> Tuple[float, float]:
        """단일 호출 비용 누적. (today_usd, this_month_usd) 반환. session_id 있으면 per-session 도 누적."""
        d = self._today_str()
        m = self._month_str()
        amount = max(0.0, usd or 0.0)
        self._daily_usd[d] = self._daily_usd.get(d, 0.0) + amount
        self._monthly_usd[m] = self._monthly_usd.get(m, 0.0) + amount
        # M7: per-session cost 누적 (retry loop / 비싼 세션 감지용)
        if session_id:
            sk = f"{d}:{session_id}"
            self._session_cost_usd[sk] = self._session_cost_usd.get(sk, 0.0) + amount
        return self._daily_usd[d], self._monthly_usd[m]

    def daily_usd(self) -> float:
        return self._daily_usd.get(self._today_str(), 0.0)

    def monthly_usd(self) -> float:
        return self._monthly_usd.get(self._month_str(), 0.0)

    def session_cost(self, session_id: str) -> float:
        return self._session_cost_usd.get(f"{self._today_str()}:{session_id}", 0.0)

    def top_sessions_today(self, limit: int = 10) -> List[Tuple[str, float]]:
        """오늘 cost 상위 N 세션 — retry loop / 비정상 세션 감지."""
        d = self._today_str() + ":"
        items = [(k.split(":", 1)[1], v) for k, v in self._session_cost_usd.items() if k.startswith(d)]
        items.sort(key=lambda x: x[1], reverse=True)
        return items[:limit]

    # ── P0-E6 5분 sliding window spike
    def _minute_key(self, offset_min: int = 0) -> str:
        from datetime import datetime as _dt, timedelta
        t = _dt.now() - timedelta(minutes=offset_min)
        return t.strftime("%Y-%m-%dT%H:%M")

    def record_minute(self) -> int:
        """현재 분 카운터 +1 후 직전 5분 합 반환 (sliding window)."""
        now_key = self._minute_key(0)
        self._minute_calls[now_key] = self._minute_calls.get(now_key, 0) + 1
        # 5분 window 합 (현재 + 이전 4분)
        total = sum(self._minute_calls.get(self._minute_key(i), 0) for i in range(5))
        # 오래된 키 정리 (10분 이상 경과)
        if len(self._minute_calls) > 30:
            cutoff = self._minute_key(10)
            self._minute_calls = {k: v for k, v in self._minute_calls.items() if k >= cutoff}
        return total

    def record_result(self, success: bool) -> Tuple[int, int, float]:
        """M9: 5분 window 성공/실패 누적. (ok, fail, fail_rate) 반환."""
        now_key = self._minute_key(0)
        bucket = self._minute_results.setdefault(now_key, {"ok": 0, "fail": 0})
        if success:
            bucket["ok"] += 1
        else:
            bucket["fail"] += 1
        ok_total = sum(self._minute_results.get(self._minute_key(i), {}).get("ok", 0) for i in range(5))
        fail_total = sum(self._minute_results.get(self._minute_key(i), {}).get("fail", 0) for i in range(5))
        total = ok_total + fail_total
        rate = (fail_total / total) if total > 0 else 0.0
        # 오래된 키 정리
        if len(self._minute_results) > 30:
            cutoff = self._minute_key(10)
            self._minute_results = {k: v for k, v in self._minute_results.items() if k >= cutoff}
        return ok_total, fail_total, rate

    def record_token(self, endpoint: str, input_tokens: int) -> Tuple[float, float]:
        """M8: endpoint 별 input_tokens EWMA 갱신. (current, ratio_to_avg) 반환.
        ratio > spike_multiplier (예: 1.5x) 면 prompt loop / context bug 의심.
        """
        if input_tokens <= 0:
            return 0.0, 1.0
        avg = self._endpoint_token_avg.get(endpoint, 0.0)
        n = self._endpoint_token_n.get(endpoint, 0)
        # EWMA — 최근 호출 가중 (alpha 0.2 = 5회 평균 영향)
        if n < 5:
            new_avg = ((avg * n) + input_tokens) / (n + 1)
        else:
            new_avg = avg * 0.8 + input_tokens * 0.2
        self._endpoint_token_avg[endpoint] = new_avg
        self._endpoint_token_n[endpoint] = n + 1
        # spike 비교는 충분히 표본 쌓인 후 (n>=10)
        if n < 10 or avg <= 0:
            return float(input_tokens), 1.0
        return float(input_tokens), input_tokens / avg

    def get_endpoint_token_avg(self, endpoint: str) -> Optional[float]:
        return self._endpoint_token_avg.get(endpoint)


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
        self._quota: QuotaGuard = QuotaGuard()
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

    async def call_api(
        self,
        request: Any,
        endpoint: str = "default",
        session_id: Optional[str] = None,
        partner_id: Optional[str] = None,
        hospital_id: Optional[str] = None,
        **kwargs,
    ) -> Any:
        """Gemini 우선 호출, 실패 시 OpenAI 폴백. GeminiResponse 호환 반환.

        Args:
            endpoint: 쿼터 추적용 엔드포인트 식별자
                      (chat_tagging / rag_chat / checkup_design / default)
            session_id/partner_id/hospital_id: usage_log 추적용 — 5/4 점검 결과 145건 100% NULL 이라
                                              session 단위 retry loop 감지 불가 → P0 추적 가능화
        """
        from .gemini_service import gemini_service, GeminiResponse
        from .llm_usage_logger import llm_usage_logger
        import time

        # Quota 체크
        daily_ceiling, hourly_ceiling = self._quota_ceilings(endpoint)
        if not self._quota.check(endpoint, daily_ceiling, hourly_ceiling):
            if self._quota.should_alert(endpoint):
                logger.warning("[LLMRouter] quota_exceeded endpoint=%s", endpoint)
                asyncio.create_task(self._notify_quota_exceeded(endpoint))
            llm_usage_logger.log(
                model="(quota_blocked)", endpoint=endpoint,
                session_id=session_id, partner_id=partner_id, hospital_id=hospital_id,
                success=False, error_class="QUOTA_BLOCKED",
            )
            return GeminiResponse(success=False, error="quota_exceeded", error_class="QUOTA_BLOCKED")

        # P0-E5 비용 cap — 일별 USD 누적 도달 시 차단 (4월 100만원 사고 재발 방지)
        from ..core.config import settings as _cfg
        if getattr(_cfg, "llm_cost_cap_enabled", True):
            today_usd = self._quota.daily_usd()
            month_usd = self._quota.monthly_usd()
            block_cap = float(getattr(_cfg, "llm_cost_cap_block_usd", 20.0))
            month_block = float(getattr(_cfg, "llm_cost_monthly_block_usd", 500.0))
            # 일별 cap 차단
            if today_usd >= block_cap:
                if self._quota.should_alert("cost_cap_block"):
                    logger.error("[LLMRouter] cost_cap BLOCK — today=$%.4f >= $%.2f endpoint=%s",
                                 today_usd, block_cap, endpoint)
                    asyncio.create_task(self._notify_cost_cap_block(today_usd, block_cap))
                llm_usage_logger.log(
                    model="(cost_blocked)", endpoint=endpoint,
                    session_id=session_id, partner_id=partner_id, hospital_id=hospital_id,
                    success=False, error_class="COST_CAP_BLOCKED",
                )
                return GeminiResponse(success=False, error=f"cost_cap_blocked (${today_usd:.2f} >= ${block_cap:.2f})", error_class="COST_CAP_BLOCKED")
            # M1: 월별 cap 차단 — Anthropic monthly cap 패턴
            if month_usd >= month_block:
                if self._quota.should_alert("cost_monthly_block"):
                    logger.error("[LLMRouter] monthly cap BLOCK — month=$%.4f >= $%.2f endpoint=%s",
                                 month_usd, month_block, endpoint)
                    asyncio.create_task(self._notify_cost_monthly_block(month_usd, month_block))
                llm_usage_logger.log(
                    model="(cost_monthly_blocked)", endpoint=endpoint,
                    session_id=session_id, partner_id=partner_id, hospital_id=hospital_id,
                    success=False, error_class="COST_CAP_BLOCKED",
                )
                return GeminiResponse(success=False, error=f"monthly_cap_blocked (${month_usd:.2f} >= ${month_block:.2f})", error_class="COST_CAP_BLOCKED")

        ratio = self._quota.record(endpoint, daily_ceiling)
        # 80% 사전 경고 — Free Tier 1개월 100% fail 사고 재발 방지 (운영자 사전 인지)
        if ratio >= 0.8 and self._quota.should_alert(f"{endpoint}:warn80"):
            asyncio.create_task(self._notify_quota_threshold(endpoint, ratio, daily_ceiling))

        # M3: 시간별 80% warn (block 임박 사전 인지)
        hourly_count = self._quota._hourly.get(self._quota._hourly_key(endpoint), 0)
        if hourly_ceiling > 0 and (hourly_count / hourly_ceiling) >= 0.8 and self._quota.should_alert(f"{endpoint}:hr_warn80"):
            asyncio.create_task(self._notify_hourly_threshold(endpoint, hourly_count, hourly_ceiling))

        # P0-E6 5분 sliding window spike 감지 (4월 무한 retry 폭주 즉시 감지)
        if getattr(_cfg, "llm_spike_enabled", True):
            spike_count = self._quota.record_minute()
            spike_threshold = int(getattr(_cfg, "llm_spike_5min_threshold", 20))
            if spike_count >= spike_threshold and self._quota.should_alert(f"{endpoint}:spike5min"):
                logger.warning("[LLMRouter] 5min spike — %d calls/5min (threshold=%d) endpoint=%s",
                               spike_count, spike_threshold, endpoint)
                asyncio.create_task(self._notify_spike(endpoint, spike_count, spike_threshold))

        state = self.state
        t0 = time.monotonic()

        async def _log_usage(resp: Any, model_name: str, ok: bool, err_class: Optional[str] = None):
            # 로깅 자체 실패가 LLM 응답 흐름을 차단하지 않도록 try/except 보호
            try:
                usage = getattr(resp, "usage", None) or {}
                # resp.error_class 가 있으면 우선 사용 (gemini_service 가 세분화한 분류)
                resp_err_class = getattr(resp, "error_class", None)
                final_err_class = err_class if err_class is not None else resp_err_class
                in_t = int(usage.get("input_tokens") or 0)
                out_t = int(usage.get("output_tokens") or 0)
                cached_t = int(usage.get("cached_tokens") or 0)
                # P0-E5 비용 누적 — 성공/실패 무관 (실패도 input 토큰 청구되는 경우 있음)
                # M1/M7: 일별 + 월별 + per-session
                try:
                    from ..core.llm_pricing import estimate_usd as _est
                    cost = _est(model_name, in_t, out_t, cached_t)
                    today_total, month_total = self._quota.add_cost(cost, session_id=session_id)
                    warn_cap = float(getattr(_cfg, "llm_cost_cap_warn_usd", 5.0))
                    if today_total >= warn_cap and self._quota.should_alert("cost_cap_warn"):
                        asyncio.create_task(self._notify_cost_cap_warn(today_total, warn_cap))
                    # M1: 월별 warn ($200)
                    month_warn = float(getattr(_cfg, "llm_cost_monthly_warn_usd", 200.0))
                    if month_total >= month_warn and self._quota.should_alert("cost_monthly_warn"):
                        asyncio.create_task(self._notify_cost_monthly_warn(month_total, month_warn))
                except Exception as cost_exc:
                    logger.debug("[LLMRouter] cost estimate skip: %s", cost_exc)
                # M8: token spike per endpoint (loop/prompt bug 조기 감지)
                try:
                    if in_t > 0:
                        cur, ratio_avg = self._quota.record_token(endpoint, in_t)
                        spike_x = float(getattr(_cfg, "llm_token_spike_multiplier", 1.5))
                        if ratio_avg >= spike_x and self._quota.should_alert(f"{endpoint}:tok_spike"):
                            asyncio.create_task(self._notify_token_spike(endpoint, in_t, ratio_avg))
                except Exception as tok_exc:
                    logger.debug("[LLMRouter] token spike check skip: %s", tok_exc)
                # M9: error rate spike (5min window > 10%)
                try:
                    ok_n, fail_n, fr = self._quota.record_result(ok)
                    rate_th = float(getattr(_cfg, "llm_error_rate_5min_threshold", 0.10))
                    min_calls = int(getattr(_cfg, "llm_error_rate_min_calls", 10))
                    if (ok_n + fail_n) >= min_calls and fr >= rate_th and self._quota.should_alert("error_rate_5min"):
                        asyncio.create_task(self._notify_error_rate(ok_n, fail_n, fr, rate_th))
                except Exception as er_exc:
                    logger.debug("[LLMRouter] error rate check skip: %s", er_exc)
                llm_usage_logger.log(
                    model=model_name,
                    endpoint=endpoint,
                    session_id=session_id,
                    partner_id=partner_id,
                    hospital_id=hospital_id,
                    input_tokens=in_t,
                    output_tokens=out_t,
                    cached_tokens=cached_t,
                    latency_ms=int((time.monotonic() - t0) * 1000),
                    success=ok,
                    error_class=final_err_class,
                )
            except Exception as log_exc:
                logger.warning("[LLMRouter] _log_usage 실패 (무시): %s", log_exc)

        if state == LLMState.HEALTHY:
            try:
                resp = await gemini_service.call_api(request, **kwargs)
                if resp.success:
                    await _log_usage(resp, getattr(request, "model", "gemini"), True)
                    return resp
                await self._record_failure("gemini", Exception(resp.error or "unknown"))
                # HEALTHY 라도 429/quota fail 시 즉시 OpenAI 폴백 (5/2 92건 사용자 fail 방지)
                err_lower = (resp.error or "").lower()
                if "429" in err_lower or "quota" in err_lower or "resource_exhausted" in err_lower or self.state == LLMState.DEGRADED:
                    logger.info("[LLMRouter] Gemini fail (state=%s, err=%s) — 즉시 OpenAI 폴백", self.state, (resp.error or "")[:60])
                    fb = await self._call_openai(request, **kwargs)
                    await _log_usage(fb, "openai-fallback", fb.success,
                                     None if fb.success else "OPENAI_FALLBACK_FAIL")
                    return fb
                # err_class None → _log_usage 가 resp.error_class (gemini_service 세분화) 우선 사용
                # MAX_TOKENS / SAFETY 시 retry 무의미 → 호출자 (greetings 등) 에게 전파만
                await _log_usage(resp, getattr(request, "model", "gemini"), False, None)
                return resp
            except Exception as e:
                await self._record_failure("gemini", e)
                err_lower = str(e).lower()
                # HEALTHY 라도 429/quota exception 시 즉시 OpenAI 폴백
                if "429" in err_lower or "quota" in err_lower or "resource_exhausted" in err_lower or self.state == LLMState.DEGRADED:
                    logger.info("[LLMRouter] Gemini exception (state=%s, err=%s) — 즉시 OpenAI 폴백", self.state, str(e)[:60])
                    fb = await self._call_openai(request, **kwargs)
                    await _log_usage(fb, "openai-fallback", fb.success,
                                     None if fb.success else "OPENAI_FALLBACK_FAIL")
                    return fb
                raise

        if state == LLMState.DEGRADED:
            # P0-E5 dev-reviewer CONDITIONAL fix — DEGRADED 분기에도 cap 재확인
            # (race: 함수 진입 직후 다른 비동기 호출이 누적 → 단일 호출 우회 차단)
            if getattr(_cfg, "llm_cost_cap_enabled", True):
                today_usd = self._quota.daily_usd()
                block_cap = float(getattr(_cfg, "llm_cost_cap_block_usd", 20.0))
                if today_usd >= block_cap:
                    if self._quota.should_alert("cost_cap_block_degraded"):
                        asyncio.create_task(self._notify_cost_cap_block(today_usd, block_cap))
                    llm_usage_logger.log(
                        model="(cost_blocked_degraded)", endpoint=endpoint,
                        session_id=session_id, partner_id=partner_id, hospital_id=hospital_id,
                        success=False, error_class="COST_CAP_BLOCKED",
                    )
                    return GeminiResponse(success=False, error=f"cost_cap_blocked (degraded, ${today_usd:.2f})", error_class="COST_CAP_BLOCKED")
            fb = await self._call_openai(request, **kwargs)
            await _log_usage(fb, "openai-degraded", fb.success,
                             None if fb.success else "OPENAI_DEGRADED_FAIL")
            return fb

        # DOWN
        from .gemini_service import GeminiResponse
        llm_usage_logger.log(
            model="(down)", endpoint=endpoint,
            session_id=session_id, partner_id=partner_id, hospital_id=hospital_id,
            success=False, error_class="DOWN",
        )
        return GeminiResponse(success=False, error="LLM services unavailable (DOWN)", error_class="DOWN")

    async def stream_api(
        self,
        request: Any,
        session_id: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """스트리밍 호출. 시작 전 provider 결정, 시작 후 동일 provider 유지.
        M6: TTFT (Time To First Token) 측정 — 첫 chunk 시점 logger.info (P95 SLO < 500ms 목표).
        """
        from .gemini_service import gemini_service
        state = self.state
        _ttft_t0 = time.monotonic()

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
                    ttft_ms = int((time.monotonic() - _ttft_t0) * 1000)
                    logger.info("[TTFT] provider=gemini session=%s ms=%d", (session_id or "-")[:24], ttft_ms)
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
                _first_yielded = False
                async for chunk in gpt_service.stream_api(gpt_req, session_id=session_id):
                    if not _first_yielded:
                        ttft_ms = int((time.monotonic() - _ttft_t0) * 1000)
                        logger.info("[TTFT] provider=openai session=%s ms=%d", (session_id or "-")[:24], ttft_ms)
                        _first_yielded = True
                    yield chunk
                return
            except Exception as e:
                logger.error("[LLMRouter] openai stream failed: %s", e)
                await self._record_failure("openai", e)

        # M5: 사용자에게 폴백 응답 노출 — 즉시 Slack 알림 (5/2 1개월 100% fail 같은 사고 즉각 인지)
        if self._quota.should_alert("user_chat_fail"):
            asyncio.create_task(self._notify_user_chat_fail(session_id))
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
    def _quota_ceilings(self, endpoint: str):
        """(daily_ceiling, hourly_ceiling) 반환"""
        cfg = self._cfg
        daily_map = {
            "chat_tagging": getattr(cfg, "llm_quota_chat_tagging_daily", 2000),
            "rag_chat": getattr(cfg, "llm_quota_rag_chat_daily", 5000),
            "checkup_design": getattr(cfg, "llm_quota_checkup_design_daily", 1000),
        }
        daily = daily_map.get(endpoint, 5000)
        multiplier = getattr(cfg, "llm_quota_hourly_multiplier", 0.15)
        return daily, max(1, int(daily * multiplier))

    async def _notify_quota_exceeded(self, endpoint: str) -> None:
        try:
            from .slack_service import get_slack_service, AlertType
            from ..core.config import settings
            if settings.slack_webhook_url:
                slack = get_slack_service(settings.slack_webhook_url)
                await slack.send_error_alert(AlertType.API_ERROR, {
                    "error_type": "LLM Quota 초과",
                    "location": f"llm_router:quota:{endpoint}",
                    "error_message": f"endpoint={endpoint} daily/hourly 상한 도달",
                    "uuid": "system",
                })
        except Exception as e:
            logger.warning("[LLMRouter] quota slack notify failed: %s", e)

    async def _notify_user_chat_fail(self, session_id: Optional[str]) -> None:
        """M5: 사용자에게 '일시적 오류' 폴백 응답 노출 — 즉시 알림."""
        try:
            from .slack_service import get_slack_service, AlertType
            from ..core.config import settings
            if settings.slack_webhook_url:
                slack = get_slack_service(settings.slack_webhook_url)
                await slack.send_error_alert(AlertType.USER_CHAT_FAIL, {
                    "error_type": "🚨 사용자에게 폴백 응답 노출",
                    "location": "llm_router:stream_api:fallback_yield",
                    "error_message": (
                        f"LLM 폴백 체인 (Gemini → OpenAI) 모두 실패. "
                        f"session_id={session_id or 'unknown'}. "
                        f"5/2 1개월 100% fail 사고와 동일 패턴 — 즉시 점검 필요. (1h dedup)"
                    ),
                    "uuid": session_id or "system",
                })
        except Exception as e:
            logger.warning("[LLMRouter] user fail slack notify failed: %s", e)

    async def _notify_cost_monthly_warn(self, month_usd: float, warn_cap: float) -> None:
        """M1: 월별 비용 사전 경고."""
        try:
            from .slack_service import get_slack_service, AlertType
            from ..core.config import settings
            if settings.slack_webhook_url:
                slack = get_slack_service(settings.slack_webhook_url)
                await slack.send_error_alert(AlertType.QUOTA_THRESHOLD, {
                    "error_type": f"💰 LLM 월별 비용 사전 경고 — ${month_usd:.2f} / warn ${warn_cap:.2f}",
                    "location": "llm_router:cost_monthly_warn",
                    "error_message": f"이번 달 누적 ${month_usd:.4f} ≥ warn ${warn_cap:.2f}. block ${getattr(settings, 'llm_cost_monthly_block_usd', 500):.2f} 도달 전 운영팀 사전 인지 (1h dedup).",
                    "uuid": "system",
                })
        except Exception as e:
            logger.warning("[LLMRouter] monthly warn slack failed: %s", e)

    async def _notify_cost_monthly_block(self, month_usd: float, block_cap: float) -> None:
        """M1: 월별 비용 차단 — 4월 100만원 사고 (≈$700/mo) 재발 방지."""
        try:
            from .slack_service import get_slack_service, AlertType
            from ..core.config import settings
            if settings.slack_webhook_url:
                slack = get_slack_service(settings.slack_webhook_url)
                await slack.send_error_alert(AlertType.SYSTEM_ERROR, {
                    "error_type": f"🛑 LLM 월별 cap 차단 — ${month_usd:.2f} ≥ ${block_cap:.2f}",
                    "location": "llm_router:cost_monthly_block",
                    "error_message": f"이번 달 ${month_usd:.4f} block cap ${block_cap:.2f} 도달. 매월 1일 자동 reset. 임계 조정: WELNO_LLM_COST_MONTHLY_BLOCK_USD",
                    "uuid": "system",
                })
        except Exception as e:
            logger.warning("[LLMRouter] monthly block slack failed: %s", e)

    async def _notify_hourly_threshold(self, endpoint: str, count: int, ceiling: int) -> None:
        """M3: 시간별 80% 사전 경고."""
        try:
            from .slack_service import get_slack_service, AlertType
            from ..core.config import settings
            if settings.slack_webhook_url:
                slack = get_slack_service(settings.slack_webhook_url)
                await slack.send_error_alert(AlertType.QUOTA_THRESHOLD, {
                    "error_type": f"⏱️ LLM 시간별 80% 도달 — {endpoint} {count}/{ceiling}",
                    "location": f"llm_router:hourly_warn:{endpoint}",
                    "error_message": f"endpoint={endpoint} 현재 시간 {count}/{ceiling} ({int(count/ceiling*100)}%). 시간 경계까지 모니터링 권고.",
                    "uuid": "system",
                })
        except Exception as e:
            logger.warning("[LLMRouter] hourly threshold slack failed: %s", e)

    async def _notify_token_spike(self, endpoint: str, current: int, ratio: float) -> None:
        """M8: token spike — prompt loop / context bug 조기 감지."""
        try:
            from .slack_service import get_slack_service, AlertType
            from ..core.config import settings
            if settings.slack_webhook_url:
                slack = get_slack_service(settings.slack_webhook_url)
                avg = self._quota.get_endpoint_token_avg(endpoint) or 0.0
                await slack.send_error_alert(AlertType.QUOTA_THRESHOLD, {
                    "error_type": f"📈 input token spike — {endpoint} {current} ({ratio:.1f}x avg)",
                    "location": f"llm_router:token_spike:{endpoint}",
                    "error_message": f"endpoint={endpoint} input={current} EWMA avg={avg:.0f} → {ratio:.2f}x. prompt loop / context 누적 / history 압축 미동작 의심.",
                    "uuid": "system",
                })
        except Exception as e:
            logger.warning("[LLMRouter] token spike slack failed: %s", e)

    async def _notify_error_rate(self, ok: int, fail: int, rate: float, threshold: float) -> None:
        """M9: error rate spike (5min)."""
        try:
            from .slack_service import get_slack_service, AlertType
            from ..core.config import settings
            if settings.slack_webhook_url:
                slack = get_slack_service(settings.slack_webhook_url)
                await slack.send_error_alert(AlertType.SYSTEM_ERROR, {
                    "error_type": f"🚨 chat fail rate {int(rate*100)}% (5min) — Gemini 장애 의심",
                    "location": "llm_router:error_rate_5min",
                    "error_message": f"5분 window: 성공 {ok} / 실패 {fail} = {rate:.1%} (임계 {threshold:.1%}). 전체 fail 응답 가능성 → DEGRADED 강제 전환 검토 권고.",
                    "uuid": "system",
                })
        except Exception as e:
            logger.warning("[LLMRouter] error rate slack failed: %s", e)

    async def _notify_cost_cap_warn(self, today_usd: float, warn_cap: float) -> None:
        """일별 비용 사전 경고 ($5/일 도달, 1h dedup)."""
        try:
            from .slack_service import get_slack_service, AlertType
            from ..core.config import settings
            if settings.slack_webhook_url:
                slack = get_slack_service(settings.slack_webhook_url)
                await slack.send_error_alert(AlertType.QUOTA_THRESHOLD, {
                    "error_type": f"💰 LLM 비용 사전 경고 — 일 ${today_usd:.2f} (warn cap ${warn_cap:.2f})",
                    "location": "llm_router:cost_cap_warn",
                    "error_message": f"오늘 누적 ${today_usd:.4f} ≥ warn ${warn_cap:.2f}. block cap 도달 전 운영팀 사전 인지 (1h dedup).",
                    "uuid": "system",
                })
        except Exception as e:
            logger.warning("[LLMRouter] cost warn slack notify failed: %s", e)

    async def _notify_cost_cap_block(self, today_usd: float, block_cap: float) -> None:
        """일별 비용 차단 — 4월 100만원 사고 재발 방지 (1h dedup)."""
        try:
            from .slack_service import get_slack_service, AlertType
            from ..core.config import settings
            if settings.slack_webhook_url:
                slack = get_slack_service(settings.slack_webhook_url)
                await slack.send_error_alert(AlertType.SYSTEM_ERROR, {
                    "error_type": f"🛑 LLM 비용 cap 차단 — 일 ${today_usd:.2f} ≥ ${block_cap:.2f}",
                    "location": "llm_router:cost_cap_block",
                    "error_message": (
                        f"누적 ${today_usd:.4f} block cap ${block_cap:.2f} 도달. "
                        f"이후 호출 차단 → COST_CAP_BLOCKED 응답. "
                        f"하루 자정 자동 reset. 임계 조정: WELNO_LLM_COST_CAP_BLOCK_USD"
                    ),
                    "uuid": "system",
                })
        except Exception as e:
            logger.warning("[LLMRouter] cost block slack notify failed: %s", e)

    async def _notify_spike(self, endpoint: str, count_5min: int, threshold: int) -> None:
        """5분 sliding window spike 감지 — 무한 retry/봇 폭주 즉시 감지 (1h dedup)."""
        try:
            from .slack_service import get_slack_service, AlertType
            from ..core.config import settings
            if settings.slack_webhook_url:
                slack = get_slack_service(settings.slack_webhook_url)
                await slack.send_error_alert(AlertType.QUOTA_THRESHOLD, {
                    "error_type": f"⚡ LLM 5분 spike — {count_5min} calls/5min (threshold={threshold})",
                    "location": f"llm_router:spike5min:{endpoint}",
                    "error_message": (
                        f"endpoint={endpoint} 5분 누적 호출 {count_5min} ≥ {threshold}. "
                        f"4월 무한 retry / 봇 트래픽 의심. "
                        f"임계 조정: WELNO_LLM_SPIKE_5MIN_THRESHOLD"
                    ),
                    "uuid": "system",
                })
        except Exception as e:
            logger.warning("[LLMRouter] spike slack notify failed: %s", e)

    async def _notify_quota_threshold(self, endpoint: str, ratio: float, ceiling: int) -> None:
        try:
            from .slack_service import get_slack_service, AlertType
            from ..core.config import settings
            if settings.slack_webhook_url:
                slack = get_slack_service(settings.slack_webhook_url)
                await slack.send_error_alert(AlertType.QUOTA_THRESHOLD, {
                    "error_type": f"LLM Quota {int(ratio*100)}% 도달 (사전 경고)",
                    "location": f"llm_router:quota:{endpoint}",
                    "error_message": (
                        f"endpoint={endpoint} usage={self._quota.get_daily_count(endpoint)}/{ceiling} "
                        f"({int(ratio*100)}%) — 1h dedup, ceiling 도달 전 운영팀 사전 인지용"
                    ),
                    "uuid": "system",
                })
        except Exception as e:
            logger.warning("[LLMRouter] quota threshold slack notify failed: %s", e)

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
        # OpenAI 폴백 시 max_tokens 상한 800 (gpt-4o-mini 스트리밍 속도 확보)
        # 1500이면 실제 출력 700~1200 tokens → 20~23초 소요.
        # 800으로 제한 시 실제 출력 400~600 tokens → 8~12초 소요 (목표).
        # RAG 답변은 300~500자가 적정이며 800 tokens면 충분.
        fallback_max_tokens = min(req.max_tokens or 2000, 800)
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
                # property 사용 — Redis override 인지 (override DEGRADED여도 헬스체크 진행)
                state = self.state
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
                        self._transition_locked(LLMState.HEALTHY, "gemini auto-recovered")
                    # 자동 복구 시 Redis override 키도 자동 삭제 (영구 잠김 방지)
                    await asyncio.to_thread(self._clear_redis_override_sync)
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

    def _clear_redis_override_sync(self):
        """Gemini 자동 복구 성공 시 Redis override 키 삭제 + in-memory 캐시도 즉시 reset"""
        try:
            import redis
            from ..core.config import settings
            redis_url = getattr(settings, "redis_url", "redis://10.0.1.10:6379/0")
            client = redis.from_url(redis_url, decode_responses=True, socket_timeout=3)
            client.delete("welno:llm:override:state", "welno:llm:override:reason")
            self._override_state = None
            logger.info("[LLMRouter] redis override auto-cleared (gemini recovered)")
        except Exception as e:
            logger.warning("[LLMRouter] redis override auto-clear failed: %s", e)


# 싱글턴 인스턴스
llm_router = LLMRouter()
