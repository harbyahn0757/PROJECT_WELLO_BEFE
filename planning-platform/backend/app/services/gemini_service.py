import os
import json
import logging
import asyncio
from typing import Optional, List, Dict, Any, Union
from dataclasses import dataclass
from datetime import datetime

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

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
        """Gemini API 스트리밍 호출 (세션 히스토리 지원)"""
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
            
            model = genai.GenerativeModel(
                model_name=request.model,
                generation_config=generation_config
            )

            safety_settings = {
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            }

            logger.info(f"📡 [Gemini Service] 스트리밍 호출 중... (Model: {request.model}, Session: {session_id})")
            
            # 세션 히스토리가 있으면 ChatSession 사용
            if session_id and request.chat_history and len(request.chat_history) > 0:
                # 기존 히스토리로 ChatSession 시작
                chat_session = model.start_chat(history=request.chat_history)
                # 새 메시지 전송
                response = chat_session.send_message(
                    request.prompt,
                    safety_settings=safety_settings,
                    stream=True
                )
            else:
                # 일반 스트리밍 호출 (첫 메시지 또는 히스토리 없음)
                response = model.generate_content(
                    request.prompt,
                    safety_settings=safety_settings,
                    stream=True
                )
            
            for chunk in response:
                if chunk.text:
                    yield chunk.text

        except Exception as e:
            logger.error(f"❌ [Gemini Service] 스트리밍 호출 실패: {str(e)}")
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

# 전역 인스턴스 생성
gemini_service = GeminiService()

