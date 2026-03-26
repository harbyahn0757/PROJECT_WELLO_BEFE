import logging
import asyncio
import time
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from datetime import datetime

from google import genai
from google.genai import types

from ..core.config import settings

# 로거 설정
logger = logging.getLogger(__name__)

@dataclass
class GeminiRequest:
    """Gemini API 요청 데이터 클래스"""
    prompt: str
    model: str = "gemini-1.5-pro"  # 기본 모델
    temperature: float = 0.3
    max_tokens: int = 4096
    response_format: Optional[Dict[str, Any]] = None  # JSON 응답 요청 시 {"type": "json_object"}
    chat_history: Optional[List[Dict[str, str]]] = None  # 세션 히스토리 (role, content)
    system_instruction: Optional[str] = None  # Context Caching용 시스템 프롬프트 (optional)

@dataclass
class GeminiResponse:
    """Gemini API 응답 데이터 클래스"""
    content: Optional[str] = None
    success: bool = False
    error: Optional[str] = None
    usage: Optional[Dict[str, int]] = None

class GeminiService:
    """Google Gemini 서비스 클래스"""

    MAX_CHAT_SESSIONS = 20  # 채팅 세션 캐시 상한
    MAX_CONTENT_CACHES = 10  # CachedContent 상한

    SAFETY_SETTINGS = [
        types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
    ]

    HEALTH_CACHE_TTL = 300  # 헬스체크 캐시 5분

    def __init__(self):
        self._api_key: Optional[str] = None
        self._client: Optional[genai.Client] = None
        self._initialized: bool = False
        self._chat_sessions: Dict[str, Any] = {}  # 세션별 ChatSession 저장
        self._content_caches: Dict[str, Any] = {}  # 세션별 CachedContent 저장
        self._cache_enabled: bool = True  # Context Caching 활성화 여부
        self._health_cache: Optional[dict] = None  # 헬스체크 결과 캐시
        self._health_cache_time: float = 0  # 캐시 갱신 시각

    async def initialize(self):
        """Gemini 클라이언트 초기화"""
        if self._initialized:
            return

        self._api_key = settings.google_gemini_api_key

        if self._api_key and self._api_key != "dev-gemini-key":
            self._client = genai.Client(api_key=self._api_key)
            self._initialized = True
            logger.info("[Gemini Service] 초기화 완료")
        else:
            logger.warning("[Gemini Service] API 키 없음 또는 유효하지 않음")
            self._initialized = False
            await self._notify_slack("Gemini API 키 미설정", "initialize", "API 키가 없거나 유효하지 않습니다.")

    async def check_health(self) -> dict:
        """Gemini API 키 유효성 검증 (위젯 로드 전 호출, 5분 캐싱)"""
        # 캐시 유효하면 API 호출 없이 반환
        if self._health_cache and (time.monotonic() - self._health_cache_time) < self.HEALTH_CACHE_TTL:
            return self._health_cache

        if not self._initialized:
            await self.initialize()
        if not self._initialized:
            return {"healthy": False, "error": "Gemini 서비스 미초기화"}
        try:
            response = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model="gemini-3-flash-preview",
                    contents="ping",
                    config=types.GenerateContentConfig(max_output_tokens=5),
                ),
                timeout=5.0,
            )
            result = {"healthy": True}
        except asyncio.TimeoutError:
            error_msg = "헬스체크 타임아웃 (5초)"
            logger.error(f"[Gemini] {error_msg}")
            await self._notify_slack("Gemini 헬스체크 실패", "check_health", error_msg)
            result = {"healthy": False, "error": error_msg}
        except Exception as e:
            error_msg = str(e)
            logger.error(f"[Gemini] 헬스체크 실패: {error_msg}")
            await self._notify_slack("Gemini 헬스체크 실패", "check_health", error_msg)
            result = {"healthy": False, "error": error_msg}

        self._health_cache = result
        self._health_cache_time = time.monotonic()
        return result

    async def _notify_slack(self, title: str, location: str, error_message: str):
        """Gemini 에러 Slack 알림 (내부 유틸)"""
        try:
            from .slack_service import get_slack_service, AlertType
            if settings.slack_webhook_url:
                slack = get_slack_service(settings.slack_webhook_url)
                await slack.send_error_alert(AlertType.API_ERROR, {
                    "error_type": title,
                    "location": f"gemini_service.py:{location}",
                    "error_message": error_message,
                    "uuid": "system",
                })
        except Exception:
            pass  # Slack 전송 실패는 무시

    async def call_api(
        self,
        request: GeminiRequest,
        save_log: bool = True,
        patient_uuid: Optional[str] = None,
        session_id: Optional[str] = None,
        step_number: Optional[str] = None,
        step_name: Optional[str] = None
    ) -> GeminiResponse:
        """Gemini API 호출"""
        
        if not self._initialized:
            await self.initialize()
            
        if not self._initialized:
            return GeminiResponse(success=False, error="Gemini 서비스가 초기화되지 않았습니다.")

        try:
            # GenerateContentConfig 구성
            config = types.GenerateContentConfig(
                temperature=request.temperature,
                max_output_tokens=request.max_tokens,
                safety_settings=self.SAFETY_SETTINGS,
            )

            # JSON 응답 요청
            if request.response_format and request.response_format.get("type") == "json_object":
                config.response_mime_type = "application/json"

            # System instruction 설정
            if request.system_instruction:
                config.system_instruction = request.system_instruction

            # Phase 3: Context Caching 적용
            cached_content = None
            is_first_message = not (request.chat_history and len(request.chat_history) > 0)

            if self._cache_enabled and request.system_instruction and session_id and is_first_message:
                cached_content = await self._get_or_create_cache(
                    system_prompt=request.system_instruction,
                    model_name=request.model,
                    cache_key=session_id
                )

            if cached_content:
                config.cached_content = cached_content.name
                logger.info(f"✅ [Cache] Context Caching 활성화 (30-50% 성능 향상 예상)")

            # 네이티브 async 호출
            logger.info(f"📡 [Gemini Service] API 호출 중... (Model: {request.model})")

            try:
                response = await asyncio.wait_for(
                    self._client.aio.models.generate_content(
                        model=request.model,
                        contents=request.prompt,
                        config=config,
                    ),
                    timeout=60.0  # 60초 타임아웃
                )
            except asyncio.TimeoutError:
                logger.error(f"❌ [Gemini Service] 타임아웃 (60초 초과)")
                return GeminiResponse(success=False, error="Gemini API 타임아웃 (60초 초과)")
            
            # 응답 완료 여부 확인
            if not response.candidates:
                logger.error(f"❌ [Gemini Service] 응답에 candidates가 없습니다")
                return GeminiResponse(success=False, error="Gemini API 응답 형식 오류 (candidates 없음)")
            
            finish_reason = response.candidates[0].finish_reason

            logger.debug(f"🔍 [Gemini] finish_reason: {finish_reason}")

            if finish_reason != "STOP":  # STOP이 아니면 비정상
                logger.warning(f"⚠️ [Gemini Service] 비정상 종료: {finish_reason}")

                if finish_reason == "MAX_TOKENS":
                    logger.error(f"❌ [Gemini Service] 토큰 제한 초과 (max: {request.max_tokens})")
                    return GeminiResponse(success=False, error=f"응답이 토큰 제한({request.max_tokens})을 초과했습니다")
                elif finish_reason == "SAFETY":
                    logger.error(f"❌ [Gemini Service] 안전 필터에 의해 차단됨")
                    return GeminiResponse(success=False, error="안전 필터에 의해 응답이 차단되었습니다")
                else:
                    logger.error(f"❌ [Gemini Service] 알 수 없는 종료 이유: {finish_reason}")
                    return GeminiResponse(success=False, error=f"응답 생성 실패: {finish_reason}")
            
            response_text = response.text
            
            # 응답 길이 체크 (JSON인 경우 최소 길이 검증)
            if request.response_format and request.response_format.get("type") == "json_object":
                if len(response_text) < 100:
                    logger.warning(f"⚠️ [Gemini Service] 응답이 너무 짧음: {len(response_text)}자")
                    return GeminiResponse(success=False, error=f"Gemini 응답 불완전 ({len(response_text)}자, 최소 100자 필요)")
            
            # 디버깅 로그
            logger.debug(f"🔍 [Gemini] 응답 길이: {len(response_text)}자")
            if response.usage_metadata:
                logger.debug(f"🔍 [Gemini] 토큰: {response.usage_metadata.total_token_count} (입력: {response.usage_metadata.prompt_token_count}, 출력: {response.usage_metadata.candidates_token_count})")
            
            # 로깅 저장
            if save_log and patient_uuid:
                from .session_logger import get_session_logger
                session_logger = get_session_logger()
                
                # 로그에 저장할 요청 데이터 구성
                log_request_data = {
                    "model": request.model,
                    "prompt": request.prompt,
                    "temperature": request.temperature
                }
                
                # 로그에 저장할 응답 데이터 구성
                log_response_data = {
                    "content": response_text,
                    "usage": {
                         # Gemini는 정확한 토큰 사용량을 제공하지 않을 수 있음 (메타데이터 확인 필요)
                        "prompt_tokens": 0, 
                        "completion_tokens": 0,
                        "total_tokens": 0
                    }
                }
                if response.usage_metadata:
                     log_response_data["usage"] = {
                        "prompt_tokens": response.usage_metadata.prompt_token_count,
                        "completion_tokens": response.usage_metadata.candidates_token_count,
                        "total_tokens": response.usage_metadata.total_token_count
                     }

                session_logger.log_step(
                    patient_uuid=patient_uuid,
                    step_number=step_number or "unknown",
                    step_name=step_name or "Gemini Analysis",
                    request_data=log_request_data,
                    response_data=log_response_data,
                    session_id=session_id
                )

            return GeminiResponse(
                content=response_text,
                success=True,
                usage={
                    "total_tokens": response.usage_metadata.total_token_count if response.usage_metadata else 0
                }
            )

        except Exception as e:
            logger.error(f"[Gemini Service] API 호출 실패: {str(e)}")
            await self._notify_slack("Gemini API 호출 실패", "call_api", str(e))
            return GeminiResponse(success=False, error=str(e))

    async def stream_api(self, request: GeminiRequest, session_id: Optional[str] = None):
        """
        Gemini API 스트리밍 호출
        
        기능:
        - 세션 히스토리 지원 (멀티턴 대화)
        - Context Caching 자동 활성화 (조건 충족 시)
        - Graceful degradation (캐싱 실패 시 일반 모드)
        """
        if not self._initialized:
            await self.initialize()
            
        if not self._initialized:
            yield "Gemini 서비스가 초기화되지 않았습니다."
            return

        try:
            # GenerateContentConfig 구성
            config = types.GenerateContentConfig(
                temperature=request.temperature,
                max_output_tokens=request.max_tokens,
                safety_settings=self.SAFETY_SETTINGS,
            )

            # Context Caching 시도 (첫 메시지 + system_instruction 있을 때만)
            cached_content = None
            is_first_message = not (request.chat_history and len(request.chat_history) > 0)

            if request.system_instruction and session_id and is_first_message:
                cached_content = await self._get_or_create_cache(
                    system_prompt=request.system_instruction,
                    model_name=request.model,
                    cache_key=session_id
                )

            if cached_content:
                config.cached_content = cached_content.name
                cache_status = "cached"
            else:
                cache_status = "normal"

            # System instruction 설정
            if request.system_instruction:
                config.system_instruction = request.system_instruction

            logger.info(f"📡 [Gemini] {request.model} 호출 (session: {session_id[:8] if session_id else 'None'}..., mode: {cache_status})")

            # 히스토리 있으면 Chat 모드, 없으면 단일 생성
            if is_first_message:
                for chunk in self._client.models.generate_content_stream(
                    model=request.model,
                    contents=request.prompt,
                    config=config,
                ):
                    if chunk.text:
                        yield chunk.text
                        await asyncio.sleep(0)
            else:
                chat = self._client.chats.create(
                    model=request.model,
                    config=config,
                    history=request.chat_history,
                )
                for chunk in chat.send_message_stream(message=request.prompt):
                    if chunk.text:
                        yield chunk.text
                        await asyncio.sleep(0)

        except Exception as e:
            logger.error(f"[Gemini] 스트리밍 실패: {str(e)}")
            asyncio.ensure_future(self._notify_slack("Gemini 스트리밍 실패", "stream_api", str(e)))
            yield "죄송합니다. 일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요."
    
    def _format_chat_history(self, history: List[Dict[str, Any]]) -> List[types.Content]:
        """채팅 히스토리를 Gemini Chat 형식(types.Content)으로 변환"""
        formatted = []
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if not content:
                continue

            # Gemini Chat 형식: "user" 또는 "model"
            if role == "assistant":
                role = "model"
            elif role != "user":
                continue  # user와 assistant만 지원

            formatted.append(types.Content(
                role=role,
                parts=[types.Part(text=content)],
            ))

        return formatted
    
    async def _get_or_create_cache(
        self, 
        system_prompt: str, 
        model_name: str,
        cache_key: Optional[str] = None
    ) -> Optional[Any]:
        """
        시스템 프롬프트를 캐싱하여 재사용 (Graceful degradation)
        
        캐싱 조건:
        - 최소 1,024 토큰 이상 (Gemini 3 Flash 요구사항)
        - 실패 시 자동으로 non-cached 방식으로 fallback
        - 기존 기능에 전혀 영향 없음
        
        Args:
            system_prompt: 캐싱할 시스템 프롬프트
            model_name: 모델 이름
            cache_key: 캐시 식별자 (세션 ID 등)
        
        Returns:
            CachedContent 객체 또는 None (캐싱 불가 시)
        """
        if not self._cache_enabled or not cache_key:
            return None
        
        try:
            # 기존 캐시 재사용 (있으면)
            if cache_key in self._content_caches:
                cached = self._content_caches[cache_key]
                try:
                    # 캐시 유효성 확인
                    if hasattr(cached, 'expire_time') and cached.expire_time:
                        if datetime.now() < cached.expire_time:
                            logger.debug(f"♻️ [Cache] 기존 캐시 재사용: {cache_key[:8]}...")
                            return cached

                    # 만료된 캐시 정리
                    await self._client.aio.caches.delete(name=cached.name)
                    del self._content_caches[cache_key]
                    logger.debug(f"🗑️ [Cache] 만료된 캐시 정리")
                except:
                    # 정리 실패해도 무시하고 진행
                    pass

            # 토큰 수 추정 (4자 ≈ 1토큰, 보수적 추정)
            estimated_tokens = len(system_prompt) // 4

            # 최소 토큰 수 체크 (Gemini 3 Flash: 1,024 토큰)
            if estimated_tokens < 1024:
                logger.debug(f"⏭️ [Cache] 토큰 부족 ({estimated_tokens} < 1024), 일반 모드 사용")
                return None

            # 새 캐시 생성 시도
            logger.debug(f"📦 [Cache] 새 캐시 생성 중... (~{estimated_tokens} tokens)")

            cached_content = await self._client.aio.caches.create(
                model=model_name,
                config=types.CreateCachedContentConfig(
                    display_name=f"welno_rag_{cache_key[:16]}",
                    system_instruction=system_prompt,
                    ttl="3600s",
                ),
            )

            # LRU: 캐시 상한 초과 시 가장 오래된 항목 제거
            if len(self._content_caches) >= self.MAX_CONTENT_CACHES:
                oldest_key = next(iter(self._content_caches))
                try:
                    await self._client.aio.caches.delete(
                        name=self._content_caches[oldest_key].name
                    )
                except Exception:
                    pass
                del self._content_caches[oldest_key]
                logger.info(f"🗑️ [Cache] LRU 제거: {oldest_key} ({len(self._content_caches)}/{self.MAX_CONTENT_CACHES})")
            self._content_caches[cache_key] = cached_content
            logger.info(f"✅ [Cache] 캐시 생성 완료 (30-50% 성능 향상 예상)")

            return cached_content
            
        except Exception as e:
            # 모든 캐싱 에러는 조용히 무시하고 일반 모드로 진행
            logger.debug(f"⏭️ [Cache] 캐싱 불가 (일반 모드): {str(e)[:50]}...")
            return None
    
    async def clear_cache(self, cache_key: str):
        """특정 세션의 캐시 삭제"""
        if cache_key in self._content_caches:
            try:
                cached = self._content_caches[cache_key]
                await self._client.aio.caches.delete(name=cached.name)
                del self._content_caches[cache_key]
                logger.info(f"🗑️ [Context Cache] 캐시 삭제 완료: {cache_key}")
            except Exception as e:
                logger.warning(f"⚠️ [Context Cache] 캐시 삭제 실패: {str(e)}")

# 전역 인스턴스 생성
gemini_service = GeminiService()

