"""
Perplexity AI 서비스 모듈
OpenAI와 유사한 인터페이스로 Perplexity API 호출
"""
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
import json
import logging
import os
import re
import httpx
from datetime import datetime
from ..core.config import settings

logger = logging.getLogger(__name__)

@dataclass
class PerplexityRequest:
    """Perplexity 요청 데이터 클래스 (GPTRequest와 호환)"""
    system_message: str
    user_message: str
    model: str = "sonar"
    temperature: float = 0.3
    max_tokens: int = 2000
    response_format: Optional[Dict[str, Any]] = None

@dataclass
class PerplexityResponse:
    """Perplexity 응답 데이터 클래스 (GPTResponse와 호환)"""
    content: str
    model: str
    usage: Dict[str, int]
    success: bool
    error: Optional[str] = None
    citations: Optional[List[str]] = None  # Perplexity citations (에비던스/링크)
    finish_reason: Optional[str] = None  # finish_reason (length, stop 등)

class PerplexityService:
    """Perplexity AI 서비스 클래스"""
    
    # Perplexity API 엔드포인트
    API_BASE_URL = "https://api.perplexity.ai"
    API_ENDPOINT = "/chat/completions"
    
    def __init__(self):
        self._api_key: Optional[str] = None
        self._client: Optional[httpx.AsyncClient] = None
        
    async def initialize(self):
        """Perplexity API 클라이언트 초기화"""
        self._api_key = settings.perplexity_api_key
        
        if self._api_key and not self._api_key.startswith("dev-perplexity-key") and self._api_key != "pplx-":
            self._client = httpx.AsyncClient(
                base_url=self.API_BASE_URL,
                timeout=300.0,  # 120초 -> 300초(5분)로 증가 (긴 프롬프트 및 응답 처리)
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json"
                }
            )
            logger.info("✅ [Perplexity Service] 클라이언트 초기화 완료")
        else:
            logger.warning("⚠️ [Perplexity Service] Perplexity API 키 없음")
            self._api_key = None
            self._client = None
    
    async def close(self):
        """클라이언트 종료"""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    async def call_api(
        self,
        request: PerplexityRequest,
        save_log: bool = True,
        health_data: Optional[List[Any]] = None,
        prescription_data: Optional[List[Any]] = None
    ) -> PerplexityResponse:
        """Perplexity API 호출 (공용 메서드)"""
        try:
            # 클라이언트 초기화 확인
            if self._client is None:
                await self.initialize()
            
            # API 키 확인
            if not self._api_key or self._api_key.startswith("dev-perplexity-key") or self._api_key == "pplx-":
                logger.info("🔄 [Perplexity Service] API 키 없음 - 폴백 필요")
                return PerplexityResponse(
                    content="",
                    model=request.model,
                    usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                    success=False,
                    error="API 키 없음",
                    citations=None,
                    finish_reason=None
                )
            
            # 프롬프트 로그 저장 (옵션)
            if save_log:
                self._save_prompt_log(request, health_data, prescription_data)
            
            logger.info(f"🤖 [Perplexity Service] API 호출 시작 - 모델: {request.model}, 프롬프트 길이: {len(request.user_message)}")
            
            # Perplexity API 요청 형식 구성
            # system_message와 user_message를 하나의 messages 배열로 구성
            messages = []
            if request.system_message:
                messages.append({"role": "system", "content": request.system_message})
            messages.append({"role": "user", "content": request.user_message})
            
            request_data = {
                "model": request.model,
                "messages": messages,
                "max_tokens": request.max_tokens,
                "temperature": request.temperature
            }
            
            # JSON 응답 형식이 요청된 경우 (Perplexity는 response_format을 지원하지 않을 수 있음)
            # 프롬프트에 JSON 형식 요청을 명시적으로 포함
            if request.response_format:
                # JSON 형식 요청을 user_message에 추가
                if "JSON 형식으로만 응답" not in request.user_message:
                    request_data["messages"][-1]["content"] += "\n\n반드시 JSON 형식으로만 응답하고, 다른 설명이나 주석은 포함하지 마세요."
            
            # API 호출
            response = await self._client.post(
                self.API_ENDPOINT,
                json=request_data
            )
            
            # 응답 확인
            response.raise_for_status()
            response_data = response.json()
            
            # 응답 파싱
            if "choices" not in response_data or len(response_data["choices"]) == 0:
                raise ValueError("Perplexity API 응답에 choices가 없습니다")
            
            choice = response_data["choices"][0]
            result = choice["message"]["content"]
            
            # finish_reason 확인 (응답이 완전한지 체크)
            finish_reason = choice.get("finish_reason", "")
            if finish_reason == "length":
                logger.warning(f"⚠️ [Perplexity Service] finish_reason이 'length'입니다 - 응답이 잘렸을 수 있음")
                logger.warning(f"⚠️ [Perplexity Service] 현재 max_tokens: {request.max_tokens}, 응답 길이: {len(result)}")
                # 하지만 일단 응답을 반환하고, JSON 파싱 단계에서 실제로 잘렸는지 확인
            elif finish_reason:
                logger.info(f"ℹ️ [Perplexity Service] finish_reason: {finish_reason}")
            
            # finish_reason이 "length"여도 일단 응답을 받아서 JSON 파싱 시도
            # 실제로 잘렸는지는 JSON 파싱 결과로 판단
            
            # Citations 추출 (Perplexity는 citations를 제공함)
            citations = []
            if "citations" in response_data:
                citations = response_data["citations"]
            elif "choices" in response_data and len(response_data["choices"]) > 0:
                # 일부 응답 형식에서는 citations가 choices 내부에 있을 수 있음
                if "citations" in choice:
                    citations = choice["citations"]
            
            # 사용량 정보 추출
            usage = {
                "prompt_tokens": response_data.get("usage", {}).get("prompt_tokens", 0),
                "completion_tokens": response_data.get("usage", {}).get("completion_tokens", 0),
                "total_tokens": response_data.get("usage", {}).get("total_tokens", 0)
            }
            
            if citations:
                logger.info(f"📚 [Perplexity Service] Citations 발견: {len(citations)}개")
            else:
                logger.info(f"ℹ️ [Perplexity Service] Citations 없음")
            
            logger.info(f"✅ [Perplexity Service] 응답 수신 완료 - 응답 길이: {len(result) if result else 0}, 토큰 사용: {usage['total_tokens']}, finish_reason: {finish_reason}")
            
            # 응답 로그 저장 (옵션)
            if save_log:
                self._save_response_log(result, health_data, prescription_data)
            
            return PerplexityResponse(
                content=result or "",
                model=request.model,
                usage=usage,
                success=True,
                citations=citations if citations else None,
                finish_reason=finish_reason if finish_reason else None
            )
            
        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP 오류: {e.response.status_code} - {e.response.text}"
            logger.error(f"❌ [Perplexity Service] HTTP 오류: {error_msg}")
            return PerplexityResponse(
                content="",
                model=request.model,
                usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                success=False,
                error=error_msg,
                citations=None,
                finish_reason=None
            )
        except Exception as e:
            logger.error(f"❌ [Perplexity Service] API 호출 실패: {str(e)}", exc_info=True)
            return PerplexityResponse(
                content="",
                model=request.model,
                usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                success=False,
                error=str(e),
                citations=None,
                finish_reason=None
            )
    
    async def call_with_json_response(
        self,
        request: PerplexityRequest,
        save_log: bool = True
    ) -> Dict[str, Any]:
        """JSON 형식 응답을 기대하는 Perplexity 호출"""
        # JSON 응답 형식 설정
        request.response_format = {"type": "json_object"}
        
        response = await self.call_api(request, save_log=save_log)
        
        if not response.success:
            logger.error(f"❌ [Perplexity Service] API 호출 실패: {response.error}")
            return {}
        
        # JSON 파싱
        try:
            parsed = self.parse_json_response(response.content)
            return parsed
        except Exception as e:
            logger.error(f"❌ [Perplexity Service] JSON 파싱 실패: {str(e)}")
            return {}
    
    def parse_json_response(self, response: str, raise_on_incomplete: bool = False) -> Dict[str, Any]:
        """JSON 응답 파싱 (코드블록 제거 및 불완전한 JSON 처리)
        
        Args:
            response: JSON 문자열
            raise_on_incomplete: True면 불완전한 JSON일 때 ValueError 발생 (재시도 유도)
        """
        if not response:
            return {}
        
        # JSON 코드블록 제거 (```json ... ``` 또는 ``` ... ```)
        cleaned = response.strip()
        
        # 정규표현식으로 코드블록 제거 (더 정확하게)
        # ```json ... ``` 패턴 제거 (시작 부분)
        cleaned = re.sub(r'^```json\s*\n?', '', cleaned, flags=re.MULTILINE)
        # ``` ... ``` 패턴 제거 (시작 부분)
        cleaned = re.sub(r'^```\s*\n?', '', cleaned, flags=re.MULTILINE)
        # 끝 부분 ``` 제거 (여러 줄에 걸쳐 있을 수 있음)
        cleaned = re.sub(r'\n?```\s*$', '', cleaned, flags=re.MULTILINE | re.DOTALL)
        
        # 앞뒤 공백 및 줄바꿈 제거
        cleaned = cleaned.strip()
        
        # 디버깅: 파싱 전 내용 확인 (처음 200자만)
        if len(cleaned) > 0:
            logger.debug(f"🔍 [Perplexity Service] 파싱 전 내용 (처음 200자): {cleaned[:200]}")
            logger.debug(f"🔍 [Perplexity Service] 파싱 전 내용 (마지막 200자): {cleaned[-200:] if len(cleaned) > 200 else cleaned}")
        
        try:
            parsed = json.loads(cleaned)
            # 파싱 결과가 딕셔너리인지 확인
            if not isinstance(parsed, dict):
                logger.error(f"❌ [Perplexity Service] 파싱된 결과가 딕셔너리가 아님: {type(parsed)}")
                logger.error(f"❌ [Perplexity Service] 파싱된 결과: {parsed}")
                raise ValueError(f"JSON 파싱 결과가 딕셔너리가 아닙니다: {type(parsed)}. 응답은 반드시 JSON 객체 형태여야 합니다.")
            return parsed
        except json.JSONDecodeError as e:
            # 불완전한 JSON 처리 시도
            logger.warning(f"⚠️ [Perplexity Service] JSON 파싱 오류: {str(e)}, 복구 시도 중...")
            
            # 에러 위치 확인
            error_pos = getattr(e, 'pos', None)
            error_msg = str(e)
            
            # finish_reason이 "length"이고 JSON 파싱이 실패하면 재시도 필요
            if raise_on_incomplete:
                logger.warning(f"⚠️ [Perplexity Service] finish_reason이 'length'이고 JSON 파싱 실패 - 재시도 필요")
                raise ValueError(f"응답이 max_tokens로 인해 잘렸습니다. max_tokens를 늘려 재시도하세요.")
            
            # JSON 복구 시도 (raise_on_incomplete가 False인 경우만)
            if error_pos and error_pos < len(cleaned):
                try:
                    # 더 정교한 복구 로직
                    # 1. 에러 위치 이전까지의 텍스트 추출
                    fixed = cleaned[:error_pos]
                    
                    # 2. 불완전한 문자열 찾기 및 닫기
                    # 마지막 따옴표 위치 찾기
                    last_quote_pos = fixed.rfind('"')
                    if last_quote_pos != -1:
                        # 따옴표가 홀수 개면 불완전한 문자열
                        quote_count = fixed.count('"')
                        if quote_count % 2 == 1:
                            # 마지막 따옴표 이후의 텍스트 확인
                            after_last_quote = fixed[last_quote_pos+1:]
                            # 이스케이프되지 않은 따옴표인지 확인
                            if not after_last_quote.rstrip().endswith('\\'):
                                fixed += '"'
                    
                    # 3. 중괄호/대괄호 닫기
                    open_braces = fixed.count('{') - fixed.count('}')
                    if open_braces > 0:
                        fixed += '}' * open_braces
                    
                    open_brackets = fixed.count('[') - fixed.count(']')
                    if open_brackets > 0:
                        fixed += ']' * open_brackets
                    
                    logger.info(f"🔧 [Perplexity Service] JSON 복구 시도: {len(fixed)} 문자 (원본: {len(cleaned)} 문자)")
                    parsed = json.loads(fixed)
                    # 파싱 결과가 딕셔너리인지 확인
                    if not isinstance(parsed, dict):
                        logger.error(f"❌ [Perplexity Service] 복구 후 파싱 결과가 딕셔너리가 아님: {type(parsed)}")
                        raise ValueError(f"JSON 파싱 결과가 딕셔너리가 아닙니다: {type(parsed)}. 응답은 반드시 JSON 객체 형태여야 합니다.")
                    return parsed
                    
                except json.JSONDecodeError as fix_error:
                    logger.error(f"❌ [Perplexity Service] JSON 복구 실패: {str(fix_error)}")
                except Exception as fix_error:
                    logger.error(f"❌ [Perplexity Service] JSON 복구 중 예외 발생: {str(fix_error)}")
            
            # 복구 실패 시 상세 로그
            logger.error(f"❌ [Perplexity Service] JSON 파싱 오류: {error_msg}")
            logger.error(f"❌ [Perplexity Service] 원본 (처음 500자): {cleaned[:500]}")
            logger.error(f"❌ [Perplexity Service] 원본 (마지막 500자): {cleaned[-500:] if len(cleaned) > 500 else cleaned}")
            raise
    
    def _save_prompt_log(
        self,
        request: PerplexityRequest,
        health_data: Optional[List[Any]] = None,
        prescription_data: Optional[List[Any]] = None
    ):
        """프롬프트 로그 저장"""
        try:
            log_dir = "logs"
            os.makedirs(log_dir, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            log_file = os.path.join(log_dir, f"perplexity_prompt_{timestamp}.json")
            
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
            
            logger.info(f"📝 [Perplexity Service] 프롬프트 로그 저장: {log_file}")
        except Exception as e:
            logger.warning(f"⚠️ [Perplexity Service] 프롬프트 로그 저장 실패: {str(e)}")
    
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
            log_file = os.path.join(log_dir, f"perplexity_response_{timestamp}.json")
            
            log_data = {
                "timestamp": timestamp,
                "response": response,
                "response_length": len(response) if response else 0,
                "health_data_count": len(health_data) if health_data else 0,
                "prescription_data_count": len(prescription_data) if prescription_data else 0
            }
            
            with open(log_file, "w", encoding="utf-8") as f:
                json.dump(log_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"📝 [Perplexity Service] 응답 로그 저장: {log_file}")
        except Exception as e:
            logger.warning(f"⚠️ [Perplexity Service] 응답 로그 저장 실패: {str(e)}")

