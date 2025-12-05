"""
공용 GPT 서비스 모듈
기존 GPT 호출 로직을 모듈화하여 재사용성 향상
"""
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
import json
import logging
import os
from datetime import datetime
from openai import AsyncOpenAI
from ..core.config import settings

logger = logging.getLogger(__name__)

@dataclass
class GPTRequest:
    """GPT 요청 데이터 클래스"""
    system_message: str
    user_message: str
    model: str = "gpt-4o-mini"
    temperature: float = 0.5  # 0.3 → 0.5: 창의성 허용하되 통제 유지
    max_tokens: int = 2000
    response_format: Optional[Dict[str, Any]] = None

@dataclass
class GPTResponse:
    """GPT 응답 데이터 클래스"""
    content: str
    model: str
    usage: Dict[str, int]
    success: bool
    error: Optional[str] = None

class GPTService:
    """공용 GPT 서비스 클래스"""
    
    def __init__(self):
        self._client: Optional[AsyncOpenAI] = None
        self._api_key: Optional[str] = None
        
    async def initialize(self):
        """OpenAI 클라이언트 초기화"""
        self._api_key = settings.openai_api_key
        
        if self._api_key and not self._api_key.startswith("sk-proj-your-") and self._api_key != "dev-openai-key" and self._api_key != "sk-test-placeholder":
            self._client = AsyncOpenAI(api_key=self._api_key)
            logger.info("✅ [GPT Service] OpenAI 클라이언트 초기화 완료")
        else:
            logger.warning("⚠️ [GPT Service] OpenAI API 키 없음 - 목 데이터 사용")
            self._client = None
        
    async def call_api(
        self,
        request: GPTRequest,
        save_log: bool = True,
        health_data: Optional[List[Any]] = None,
        prescription_data: Optional[List[Any]] = None
    ) -> GPTResponse:
        """GPT API 호출 (공용 메서드)"""
        try:
            # 클라이언트 초기화 확인
            if self._client is None:
                await self.initialize()
            
            # API 키 확인
            if not self._api_key or self._api_key.startswith("sk-proj-your-") or self._api_key == "dev-openai-key" or self._api_key == "sk-test-placeholder":
                logger.info("🔄 [GPT Service] API 키 없음 - 목 데이터로 폴백")
                return GPTResponse(
                    content="",
                    model=request.model,
                    usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                    success=False,
                    error="API 키 없음"
                )
            
            # 프롬프트 로그 저장 (옵션)
            if save_log:
                self._save_prompt_log(request, health_data, prescription_data)
            
            logger.info(f"🤖 [GPT Service] API 호출 시작 - 모델: {request.model}, 프롬프트 길이: {len(request.user_message)}")
            
            # GPT API 호출
            messages = [
                {"role": "system", "content": request.system_message},
                {"role": "user", "content": request.user_message}
            ]
            
            api_params = {
                "model": request.model,
                "messages": messages,
                "max_tokens": request.max_tokens,
                "temperature": request.temperature
            }
            
            # JSON 응답 형식이 요청된 경우
            if request.response_format:
                api_params["response_format"] = request.response_format
            
            response = await self._client.chat.completions.create(**api_params)
            
            result = response.choices[0].message.content
            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }
            
            logger.info(f"✅ [GPT Service] 응답 수신 완료 - 응답 길이: {len(result) if result else 0}, 토큰 사용: {usage['total_tokens']}")
            
            # 응답 로그 저장 (옵션)
            if save_log:
                self._save_response_log(result, health_data, prescription_data)
            
            return GPTResponse(
                content=result or "",
                model=request.model,
                usage=usage,
                success=True
            )
            
        except Exception as e:
            logger.error(f"❌ [GPT Service] API 호출 실패: {str(e)}")
            return GPTResponse(
                content="",
                model=request.model,
                usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                success=False,
                error=str(e)
            )
    
    async def call_with_json_response(
        self,
        request: GPTRequest,
        save_log: bool = True
    ) -> Dict[str, Any]:
        """JSON 형식 응답을 기대하는 GPT 호출"""
        # JSON 응답 형식 설정
        request.response_format = {"type": "json_object"}
        
        response = await self.call_api(request, save_log=save_log)
        
        if not response.success:
            return {}
        
        # JSON 파싱
        try:
            parsed = self.parse_json_response(response.content)
            return parsed
        except Exception as e:
            logger.error(f"❌ [GPT Service] JSON 파싱 실패: {str(e)}")
            return {}
    
    def parse_json_response(self, response: str) -> Dict[str, Any]:
        """JSON 응답 파싱 (코드블록 제거)"""
        if not response:
            return {}
        
        # JSON 코드블록 제거 (```json ... ```)
        cleaned = response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]  # ```json 제거
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]  # ``` 제거
        
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]  # ``` 제거
        
        cleaned = cleaned.strip()
        
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"❌ [GPT Service] JSON 파싱 오류: {str(e)}, 원본: {cleaned[:200]}")
            raise
    
    def _save_prompt_log(
        self,
        request: GPTRequest,
        health_data: Optional[List[Any]] = None,
        prescription_data: Optional[List[Any]] = None
    ):
        """프롬프트 로그 저장"""
        try:
            log_dir = "logs"
            os.makedirs(log_dir, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            log_file = os.path.join(log_dir, f"gpt_prompt_{timestamp}.json")
            
            log_data = {
                "timestamp": timestamp,
                "model": request.model,
                "system_message": request.system_message,
                "user_message": request.user_message,
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
                "health_data_count": len(health_data) if health_data else 0,
                "prescription_data_count": len(prescription_data) if prescription_data else 0
            }
            
            with open(log_file, "w", encoding="utf-8") as f:
                json.dump(log_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"📝 [GPT Service] 프롬프트 로그 저장: {log_file}")
        except Exception as e:
            logger.warning(f"⚠️ [GPT Service] 프롬프트 로그 저장 실패: {str(e)}")
    
    def _save_response_log(
        self,
        response: str,
        health_data: Optional[List[Any]] = None,
        prescription_data: Optional[List[Any]] = None
    ):
        """응답 로그 저장"""
        try:
            log_dir = "logs"
            os.makedirs(log_dir, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            log_file = os.path.join(log_dir, f"gpt_response_{timestamp}.json")
            
            log_data = {
                "timestamp": timestamp,
                "response": response,
                "response_length": len(response) if response else 0,
                "health_data_count": len(health_data) if health_data else 0,
                "prescription_data_count": len(prescription_data) if prescription_data else 0
            }
            
            with open(log_file, "w", encoding="utf-8") as f:
                json.dump(log_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"📝 [GPT Service] 응답 로그 저장: {log_file}")
        except Exception as e:
            logger.warning(f"⚠️ [GPT Service] 응답 로그 저장 실패: {str(e)}")

