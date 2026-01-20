import os
import json
import logging
import asyncio
from typing import Optional, List, Dict, Any, Union
from dataclasses import dataclass
from datetime import datetime, timedelta

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from google.generativeai import caching

from app.core.config import settings

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
    
    def __init__(self):
        self._api_key: Optional[str] = None
        self._initialized: bool = False
        self._chat_sessions: Dict[str, Any] = {}  # 세션별 ChatSession 저장
        self._content_caches: Dict[str, Any] = {}  # 세션별 CachedContent 저장
        self._cache_enabled: bool = True  # Context Caching 활성화 여부
        
    async def initialize(self):
        """Gemini 클라이언트 초기화"""
        if self._initialized:
            return

        self._api_key = settings.google_gemini_api_key
        
        if self._api_key and self._api_key != "dev-gemini-key":
            genai.configure(api_key=self._api_key)
            self._initialized = True
            logger.info("✅ [Gemini Service] 초기화 완료")
        else:
            logger.warning("⚠️ [Gemini Service] API 키 없음 또는 유효하지 않음")
            self._initialized = False
        
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
            # 모델 설정
            generation_config = {
                "temperature": request.temperature,
                "max_output_tokens": request.max_tokens,
            }
            
            # JSON 응답을 강제하려면 프롬프트에 지시하거나 response_mime_type 설정 (1.5 Pro부터 지원)
            if request.response_format and request.response_format.get("type") == "json_object":
                generation_config["response_mime_type"] = "application/json"

            model = genai.GenerativeModel(
                model_name=request.model,
                generation_config=generation_config
            )

            # 안전 설정 (차단 최소화)
            safety_settings = {
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            }

            # 비동기 호출 (asyncio.to_thread로 래핑, genai 라이브러리가 기본적으로 동기식이므로)
            logger.info(f"📡 [Gemini Service] API 호출 중... (Model: {request.model})")
            
            response = await asyncio.to_thread(
                model.generate_content,
                request.prompt,
                safety_settings=safety_settings
            )
            
            response_text = response.text
            
            # 로깅 저장
            if save_log and patient_uuid:
                from app.services.session_logger import get_session_logger
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
            logger.error(f"❌ [Gemini Service] API 호출 실패: {str(e)}")
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
            generation_config = {
                "temperature": request.temperature,
                "max_output_tokens": request.max_tokens,
            }
            
            # Context Caching 시도 (첫 메시지 + system_instruction 있을 때만)
            cached_content = None
            is_first_message = not (request.chat_history and len(request.chat_history) > 0)
            
            if request.system_instruction and session_id and is_first_message:
                cached_content = await self._get_or_create_cache(
                    system_prompt=request.system_instruction,
                    model_name=request.model,
                    cache_key=session_id
                )
            
            # 모델 생성 (캐시 사용 or 일반)
            if cached_content:
                model = genai.GenerativeModel.from_cached_content(
                    cached_content=cached_content,
                    generation_config=generation_config
                )
                cache_status = "cached"
            else:
                model = genai.GenerativeModel(
                    model_name=request.model,
                    generation_config=generation_config
                )
                cache_status = "normal"

            # 안전 설정 (의료 콘텐츠를 위해 차단 최소화)
            safety_settings = {
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            }

            logger.info(f"📡 [Gemini] {request.model} 호출 (session: {session_id[:8] if session_id else 'None'}..., mode: {cache_status})")
            
            # 히스토리 있으면 Chat 모드, 없으면 단일 생성
            if is_first_message:
                response = model.generate_content(
                    request.prompt,
                    safety_settings=safety_settings,
                    stream=True
                )
            else:
                chat_session = model.start_chat(history=request.chat_history)
                response = chat_session.send_message(
                    request.prompt,
                    safety_settings=safety_settings,
                    stream=True
                )
            
            # 스트리밍 응답
            for chunk in response:
                if chunk.text:
                    yield chunk.text

        except Exception as e:
            logger.error(f"❌ [Gemini] 호출 실패: {str(e)}")
            yield f"오류 발생: {str(e)}"
    
    def _format_chat_history(self, history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """채팅 히스토리를 Gemini Chat 형식으로 변환"""
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
            
            formatted.append({
                "role": role,
                "parts": [content]  # Gemini Chat API 형식: parts는 리스트
            })
        
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
                    await asyncio.to_thread(cached.delete)
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
            
            cached_content = await asyncio.to_thread(
                caching.CachedContent.create,
                model=model_name,
                display_name=f"welno_rag_{cache_key[:16]}",
                system_instruction=system_prompt,
                ttl=timedelta(hours=1)
            )
            
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
                await asyncio.to_thread(cached.delete)
                del self._content_caches[cache_key]
                logger.info(f"🗑️ [Context Cache] 캐시 삭제 완료: {cache_key}")
            except Exception as e:
                logger.warning(f"⚠️ [Context Cache] 캐시 삭제 실패: {str(e)}")

# 전역 인스턴스 생성
gemini_service = GeminiService()

