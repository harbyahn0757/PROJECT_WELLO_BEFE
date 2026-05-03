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
from .session_logger import get_session_logger

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
    chat_history: Optional[List[Dict[str, str]]] = None  # 멀티턴 히스토리 (role, content)

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
        prescription_data: Optional[List[Any]] = None,
        # 세션 로깅 추가
        patient_uuid: Optional[str] = None,
        session_id: Optional[str] = None,
        step_number: Optional[str] = None,
        step_name: Optional[str] = None
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
                self._save_prompt_log(request, health_data, prescription_data, session_id)
            
            logger.info(f"🤖 [GPT Service] API 호출 시작 - 모델: {request.model}, 프롬프트 길이: {len(request.user_message)}")
            
            # 시작 시간 기록
            start_time = datetime.now()
            
            # GPT API 호출
            messages = [{"role": "system", "content": request.system_message}]
            # chat_history 삽입 (system → history → user 순서)
            if request.chat_history:
                for h in request.chat_history:
                    role = h.get("role", "user")
                    content = h.get("content", "")
                    if role in ("user", "assistant", "system") and content:
                        messages.append({"role": role, "content": content})
            messages.append({"role": "user", "content": request.user_message})
            
            api_params = {
                "model": request.model,
                "messages": messages,
                "max_tokens": request.max_tokens,
                "temperature": request.temperature
            }
            
            # JSON 응답 형식이 요청된 경우
            if request.response_format:
                api_params["response_format"] = request.response_format
            
            # Phase 3: Prompt Caching 최적화 (OpenAI 자동 캐싱 활용)
            # System Message가 첫 번째 메시지에 있으면 자동으로 캐싱됨
            # prompt_cache_key는 선택사항이지만, 동일한 System Message를 사용하는 요청들의 캐시 히트율 향상
            if request.system_message and len(request.system_message) > 100:
                # System Message 해시를 기반으로 캐시 키 생성 (선택사항)
                import hashlib
                cache_key = hashlib.md5(request.system_message.encode()).hexdigest()[:16]
                # OpenAI는 자동으로 캐싱하므로 명시적 키는 선택사항
                # api_params["prompt_cache_key"] = f"welno_{cache_key}"  # 필요시 활성화
            
            response = await self._client.chat.completions.create(**api_params)
            
            result = response.choices[0].message.content
            usage = {
                "input_tokens": response.usage.prompt_tokens,
                "output_tokens": response.usage.completion_tokens,
                "cached_tokens": getattr(getattr(response.usage, "prompt_tokens_details", None), "cached_tokens", 0) or 0,
                "total_tokens": response.usage.total_tokens,
            }
            
            logger.info(f"✅ [GPT Service] 응답 수신 완료 - 응답 길이: {len(result) if result else 0}, 토큰 사용: {usage['total_tokens']}")
            
            # 소요 시간 계산
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # 세션 로깅 (patient_uuid와 session_id가 있을 때만)
            if patient_uuid and session_id and step_number and step_name:
                try:
                    session_logger = get_session_logger()
                    
                    # 요청 데이터 준비
                    request_data = {
                        "model": request.model,
                        "system_message": request.system_message,
                        "user_message": request.user_message,
                        "temperature": request.temperature,
                        "max_tokens": request.max_tokens,
                        "health_data_count": len(health_data) if health_data else 0,
                        "prescription_data_count": len(prescription_data) if prescription_data else 0
                    }
                    
                    # 응답 데이터 준비 (JSON 파싱 시도)
                    try:
                        response_data = json.loads(result) if result else {}
                    except:
                        response_data = {"raw_response": result}
                    
                    # 세션 로그에 기록
                    session_logger.log_step(
                        patient_uuid=patient_uuid,
                        session_id=session_id,
                        step_number=step_number,
                        step_name=step_name,
                        request_data=request_data,
                        response_data=response_data,
                        duration_ms=duration_ms
                    )
                    
                    logger.info(f"📝 [SessionLogger] 세션 로그 기록 완료: STEP {step_number}")
                except Exception as e:
                    logger.warning(f"⚠️ [SessionLogger] 세션 로그 기록 실패: {str(e)}")
            
            # 응답 로그 저장 (기존 방식, 옵션)
            if save_log:
                self._save_response_log(result, health_data, prescription_data, session_id)
            
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
    
    async def stream_api(
        self,
        request: GPTRequest,
        session_id: Optional[str] = None,
    ):
        """OpenAI 스트리밍. Gemini stream_api와 호환 (yield str)."""
        if self._client is None:
            await self.initialize()
        if self._client is None:
            yield "GPT 서비스가 초기화되지 않았습니다."
            return

        messages = [{"role": "system", "content": request.system_message or ""}]
        if request.chat_history:
            for h in request.chat_history:
                role = h.get("role", "user")
                content = h.get("content", "")
                if role in ("user", "assistant", "system") and content:
                    messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": request.user_message})

        try:
            stream = await self._client.chat.completions.create(
                model=request.model,
                messages=messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                stream=True,
            )
            async for event in stream:
                if event.choices and event.choices[0].delta and event.choices[0].delta.content:
                    yield event.choices[0].delta.content
        except Exception as e:
            logger.error(f"❌ [GPT Service] 스트리밍 실패: {str(e)}")
            raise

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
        prescription_data: Optional[List[Any]] = None,
        session_id: Optional[str] = None
    ):
        """프롬프트 로그 저장"""
        try:
            # 세션 ID가 있으면 통합 로그 폴더 사용, 없으면 루트 logs 폴더
            if session_id:
                today = datetime.now().strftime("%Y%m%d")
                # logs/planning_YYYYMMDD/SESSION_ID_UUID/... 형식에 맞춤 (하지만 UUID는 여기서 모름)
                # SessionLogger와 맞추기 위해 검색해서 해당 세션 폴더를 찾거나,
                # 단순히 planning_YYYYMMDD 아래에 session_id 폴더를 만듦
                # 여기서는 session_id 자체에 이미 UUID가 포함된 경우가 많으므로 (예: HHMMSS_UUID)
                # 그대로 사용하거나, 날짜 폴더 아래에 둠
                
                # SessionLogger의 규칙: logs/planning_{DATE}/{SESSION_ID}
                # 여기서 session_id는 보통 "HHMMSS_UUID" 형식이거나 "YYYYMMDD_HHMMSS" 형식임
                # Step 1에서 생성된 session_id는 "YYYYMMDD_HHMMSS" 형식
                
                log_dir = os.path.join("logs", f"planning_{today}", session_id)
            else:
                log_dir = "logs"
                
            os.makedirs(log_dir, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            
            # JSON 저장 제거, txt 파일만 저장
            txt_file = os.path.join(log_dir, f"gpt_prompt_{timestamp}.txt")
            with open(txt_file, "w", encoding="utf-8") as f:
                f.write("=" * 80 + "\n")
                f.write("SYSTEM MESSAGE\n")
                f.write("=" * 80 + "\n")
                f.write(request.system_message)
                f.write("\n\n")
                f.write("=" * 80 + "\n")
                f.write("USER MESSAGE\n")
                f.write("=" * 80 + "\n")
                f.write(request.user_message)
                f.write("\n\n")
                f.write("=" * 80 + "\n")
                f.write("METADATA\n")
                f.write("=" * 80 + "\n")
                f.write(f"Model: {request.model}\n")
                f.write(f"Temperature: {request.temperature}\n")
                f.write(f"Max Tokens: {request.max_tokens}\n")
                f.write(f"Timestamp: {timestamp}\n")
            
            logger.info(f"📝 [GPT Service] 프롬프트 텍스트 로그 저장: {txt_file}")
        except Exception as e:
            logger.warning(f"⚠️ [GPT Service] 프롬프트 로그 저장 실패: {str(e)}")
    
    def _save_response_log(
        self,
        response: str,
        health_data: Optional[List[Any]] = None,
        prescription_data: Optional[List[Any]] = None,
        session_id: Optional[str] = None
    ):
        """응답 로그 저장"""
        try:
            # 세션 ID가 있으면 통합 로그 폴더 사용
            if session_id:
                today = datetime.now().strftime("%Y%m%d")
                log_dir = os.path.join("logs", f"planning_{today}", session_id)
            else:
                log_dir = "logs"
            
            os.makedirs(log_dir, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            
            # JSON 저장 제거, txt 파일만 저장
            txt_file = os.path.join(log_dir, f"gpt_response_{timestamp}.txt")
            with open(txt_file, "w", encoding="utf-8") as f:
                f.write("=" * 80 + "\n")
                f.write("GPT RESPONSE\n")
                f.write("=" * 80 + "\n")
                f.write(response)
                f.write("\n\n")
                f.write("=" * 80 + "\n")
                f.write("METADATA\n")
                f.write("=" * 80 + "\n")
                f.write(f"Response Length: {len(response) if response else 0}\n")
                f.write(f"Timestamp: {timestamp}\n")
            
            logger.info(f"📝 [GPT Service] 응답 텍스트 로그 저장: {txt_file}")
        except Exception as e:
            logger.warning(f"⚠️ [GPT Service] 응답 로그 저장 실패: {str(e)}")


# 전역 싱글턴 인스턴스
gpt_service = GPTService()
