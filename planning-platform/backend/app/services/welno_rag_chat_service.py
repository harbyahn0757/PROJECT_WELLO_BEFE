"""
웰노 RAG 채팅 서비스
"""
import logging
import json
import redis
import os
import time
from typing import Dict, Any, Optional, List, AsyncGenerator
from datetime import datetime

from ..data.chat_session_manager import chat_session_manager
from ..core.config import settings
from .checkup_design.rag_service import search_checkup_knowledge, clean_html_content
from .checkup_design.lifestyle_rag_service import lifestyle_rag_service, LifestyleAnalysisRequest
from ..services.gemini_service import gemini_service, GeminiRequest
from ..services.welno_data_service import WelnoDataService

logger = logging.getLogger(__name__)


class WelnoRagChatService:
    """RAG 기반 채팅 서비스"""
    
    def __init__(self):
        self.chat_manager = chat_session_manager
        self.welno_data_service = WelnoDataService()
        # Redis 클라이언트 직접 초기화
        try:
            redis_url = settings.REDIS_URL if hasattr(settings, 'REDIS_URL') else "redis://10.0.1.10:6379/0"
            self.redis_client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_timeout=3,
                socket_connect_timeout=3
            )
            self.redis_client.ping()
            logger.info("✅ [RAG 채팅] Redis 연결 성공")
        except Exception as e:
            logger.warning(f"⚠️ [RAG 채팅] Redis 연결 실패: {e}")
            self.redis_client = None
    
    async def handle_user_message(
        self,
        uuid: str,
        hospital_id: str,
        message: str,
        session_id: str
    ) -> Dict[str, Any]:
        """
        사용자 메시지 처리 및 RAG 응답 생성 (단일 응답용 - 최적화 버전)
        """
        start_total = time.time()
        answer = "죄송합니다. 응답 생성 중 오류가 발생했습니다."
        sources = []
        try:
            # 1. 사용자 메시지 저장
            logger.info(f"📨 [RAG 채팅] 메시지 수신: {message[:50]}...")
            self.chat_manager.add_message(uuid, hospital_id, "user", message)
            
            # 2. 히스토리 및 메타데이터 가져오기
            history = self.chat_manager.get_history(uuid, hospital_id)
            meta_key = f"welno:rag_chat:metadata:{uuid}:{hospital_id}:{session_id}"
            metadata_json = self.redis_client.get(meta_key) if self.redis_client else None
            metadata = json.loads(metadata_json) if metadata_json else {"detected_keywords": []}
            
            current_keywords = self._detect_health_keywords(message)
            all_keywords = list(set(metadata.get("detected_keywords", []) + current_keywords))
            
            # 질문이 너무 짧거나 의미 없는 경우 처리
            if len(message.strip()) < 2 or message.strip() in ["?", "!", "ㅇ", "ㄴ"]:
                answer = "안녕하세요! 건강이나 영양제, 혹은 최근 받으신 검진 결과에 대해 구체적으로 말씀해주시면 지침서를 바탕으로 자세히 답변해 드릴게요. 😊"
                self.chat_manager.add_message(uuid, hospital_id, "assistant", answer)
                return {
                    "success": True, "answer": answer, "sources": [], "session_id": session_id,
                    "message_count": len([m for m in history if m.get("role") == "user"]) + 1,
                    "trigger_survey": False, "error": None
                }

            # 3. 특수 명령 감지 (3주 플랜 등)
            if any(kw in message for kw in ["3주", "생활습관 개선", "플랜", "계획"]):
                full_data = await self.welno_data_service.get_patient_health_data(uuid, hospital_id)
                patient_info = full_data.get("patient", {})
                health_data_list = full_data.get("health_data", [])
                
                if patient_info and "error" not in patient_info:
                    health_stats = self._extract_health_stats(health_data_list)
                    request = LifestyleAnalysisRequest(
                        uuid=uuid, hospital_id=hospital_id,
                        patient_name=patient_info.get("name", "고객"),
                        age=self._calculate_age(patient_info.get("birth_date")),
                        gender=patient_info.get("gender", "M"),
                        bmi=health_stats.get("bmi"),
                        chronic_diseases=list(set(health_stats.get("chronic_diseases", []) + [k for k in all_keywords if k in ["고혈압", "당뇨", "비만"]])),
                        concerns=list(set(all_keywords + [message]))
                    )
                    plan = await lifestyle_rag_service.generate_3week_plan(request)
                    answer = f"### [Dr. Welno의 3주 맞춤 플랜]\n\n{plan.summary}\n\n"
                    # ... (상세 내용 생략 - stream 버전과 동일하게 구성)
                    answer += f"📅 **1주차 ({plan.week1.get('title', '인식')})**\n"
                    for act in plan.week1.get('actions', []): answer += f"- {act}\n"
                    answer += f"\n📅 **2주차 ({plan.week2.get('title', '집중')})**\n"
                    for act in plan.week2.get('actions', []): answer += f"- {act}\n"
                    answer += f"\n📅 **3주차 ({plan.week3.get('title', '유지')})**\n"
                    for act in plan.week3.get('actions', []): answer += f"- {act}\n"
                    sources = plan.medical_basis
                else:
                    answer = "죄송합니다. 정보를 찾을 수 없어 맞춤형 플랜 생성이 어렵습니다."
                    sources = []
            else:
                # 일반 RAG 검색 최적화
                search_query = message
                if current_keywords:
                    search_query = f"{', '.join(current_keywords)} 관련: {message}"
                
                start_rag = time.time()
                rag_result = await search_checkup_knowledge(query=search_query, use_local_vector_db=True)
                logger.info(f"⏱️ [RAG 채팅] 검색 소요 시간: {time.time() - start_rag:.2f}s")
                
                if not rag_result.get("success"):
                    answer = "죄송합니다. 현재 정보를 조회할 수 없습니다."
                    sources = []
                else:
                    # RAG 결과를 Context로 사용하여 LLM에게 재구성 요청 (expert persona 적용)
                    from .checkup_design.rag_service import CHAT_SYSTEM_PROMPT
                    context_str = "\n".join([s.get("text", "") for s in rag_result.get("sources", [])])
                    prompt = CHAT_SYSTEM_PROMPT.format(context_str=context_str, query_str=message)
                    
                    start_llm = time.time()
                    gemini_res = await gemini_service.call_api(GeminiRequest(prompt=prompt, model="gemini-3-flash-preview"), save_log=False)
                    logger.info(f"⏱️ [RAG 채팅] 생성 소요 시간: {time.time() - start_llm:.2f}s")
                    
                    answer = gemini_res.content if gemini_res.success else "응답 생성에 실패했습니다."
                    sources = rag_result.get("sources", [])
            
            # 4. 마무리
            self.chat_manager.add_message(uuid, hospital_id, "assistant", answer)
            message_count = len([m for m in history if m.get("role") == "user"]) + 1
            await self._update_chat_metadata(uuid, hospital_id, session_id, current_keywords, message_count)
            trigger_check = await self.should_trigger_survey(uuid, hospital_id, session_id)
            
            logger.info(f"⏱️ [RAG 채팅] 총 처리 시간: {time.time() - start_total:.2f}s")
            
            return {
                "success": True, "answer": answer, "sources": sources, "session_id": session_id,
                "message_count": message_count, "trigger_survey": trigger_check["should_trigger"], "error": None
            }
        
        except Exception as e:
            logger.error(f"❌ [RAG 채팅 서비스] 처리 실패: {str(e)}")
            return {
                "success": False, "answer": "처리 중 오류가 발생했습니다.", "sources": [],
                "session_id": session_id, "message_count": 0, "trigger_survey": False, "error": str(e)
            }

    async def handle_user_message_stream(
        self,
        uuid: str,
        hospital_id: str,
        message: str,
        session_id: str
    ) -> AsyncGenerator[str, None]:
        """
        사용자 메시지 처리 및 RAG 응답 스트리밍 생성 (최적화 버전)
        """
        start_total = time.time()
        full_answer = ""
        sources = []
        try:
            # 1. 사용자 메시지 저장
            self.chat_manager.add_message(uuid, hospital_id, "user", message)
            
            # 2. 히스토리 및 키워드 추출
            history = self.chat_manager.get_history(uuid, hospital_id)
            meta_key = f"welno:rag_chat:metadata:{uuid}:{hospital_id}:{session_id}"
            metadata_json = self.redis_client.get(meta_key) if self.redis_client else None
            metadata = json.loads(metadata_json) if metadata_json else {"detected_keywords": []}
            
            current_keywords = self._detect_health_keywords(message)
            all_keywords = list(set(metadata.get("detected_keywords", []) + current_keywords))
            
            # 3. 특수 명령 감지 (3주 플랜 등)
            if any(kw in message for kw in ["3주", "생활습관 개선", "플랜", "계획"]):
                # ... (생략 - 기존 로직 유지하되 타이밍 로그 추가 가능)
                yield json.dumps({"answer": "맞춤형 3주 플랜을 생성 중입니다...", "done": False}, ensure_ascii=False) + "\n"
                # (기존 로직 수행...)
                full_data = await self.welno_data_service.get_patient_health_data(uuid, hospital_id)
                # ... 3주 플랜 생성 부분 (기존과 동일하되 answer 변수 사용)
                patient_info = full_data.get("patient", {})
                health_data_list = full_data.get("health_data", [])
                if patient_info and "error" not in patient_info:
                    health_stats = self._extract_health_stats(health_data_list)
                    request = LifestyleAnalysisRequest(
                        uuid=uuid, hospital_id=hospital_id,
                        patient_name=patient_info.get("name", "고객"),
                        age=self._calculate_age(patient_info.get("birth_date")),
                        gender=patient_info.get("gender", "M"),
                        bmi=health_stats.get("bmi"),
                        chronic_diseases=list(set(health_stats.get("chronic_diseases", []) + [k for k in all_keywords if k in ["고혈압", "당뇨", "비만"]])),
                        concerns=list(set(all_keywords + [message]))
                    )
                    plan = await lifestyle_rag_service.generate_3week_plan(request)
                    full_answer = f"### [Dr. Welno의 3주 맞춤 플랜]\n\n{plan.summary}\n\n"
                    # ... 상세 내용 구성
                    full_answer += f"📅 **1주차 ({plan.week1.get('title', '인식')})**\n"
                    for act in plan.week1.get('actions', []): full_answer += f"- {act}\n"
                    full_answer += f"\n📅 **2주차 ({plan.week2.get('title', '집중')})**\n"
                    for act in plan.week2.get('actions', []): full_answer += f"- {act}\n"
                    full_answer += f"\n📅 **3주차 ({plan.week3.get('title', '유지')})**\n"
                    for act in plan.week3.get('actions', []): full_answer += f"- {act}\n"
                    sources = plan.medical_basis
                    yield json.dumps({"answer": "\n\n" + full_answer, "done": False}, ensure_ascii=False) + "\n"
                else:
                    full_answer = "죄송합니다. 정보를 찾을 수 없어 플랜 생성이 어렵습니다."
                    yield json.dumps({"answer": full_answer, "done": False}, ensure_ascii=False) + "\n"
            else:
                # 일반 RAG 스트리밍 최적화
                # 현재 질문과 관련된 키워드만 검색어로 사용 (과거 맥락은 LLM에게 맡김)
                search_query = message
                if current_keywords:
                    search_query = f"{', '.join(current_keywords)} 관련: {message}"
                
                # [성능 측정] RAG Retrieval
                start_rag = time.time()
                from .checkup_design.rag_service import init_rag_engine, CHAT_SYSTEM_PROMPT
                query_engine = await init_rag_engine(use_local_vector_db=True)
                
                if query_engine:
                    nodes = await query_engine.aretrieve(search_query)
                    end_rag = time.time()
                    logger.info(f"⏱️ [RAG 채팅] 검색 소요 시간: {end_rag - start_rag:.2f}s")
                    
                    context_str = "\n".join([n.node.get_content() for n in nodes])
                    sources = [{
                        "text": clean_html_content(n.node.get_content())[:500],
                        "score": float(n.score) if hasattr(n, 'score') else None,
                        "metadata": n.node.metadata
                    } for n in nodes]
                    
                    # [성능 측정] LLM Streaming 시작
                    start_llm = time.time()
                    prompt = CHAT_SYSTEM_PROMPT.format(context_str=context_str, query_str=message)
                    gemini_req = GeminiRequest(prompt=prompt, model="gemini-3-flash-preview")
                    
                    first_chunk = True
                    async for chunk in gemini_service.stream_api(gemini_req):
                        if first_chunk:
                            logger.info(f"⏱️ [RAG 채팅] 첫 조각 도착까지: {time.time() - start_llm:.2f}s")
                            first_chunk = False
                        full_answer += chunk
                        yield json.dumps({"answer": chunk, "done": False}, ensure_ascii=False) + "\n"
                    
                    logger.info(f"⏱️ [RAG 채팅] 전체 생성 소요 시간: {time.time() - start_llm:.2f}s")
                else:
                    yield json.dumps({"answer": "죄송합니다. 엔진 초기화에 실패했습니다.", "done": False}, ensure_ascii=False) + "\n"

            # 4. 마무리 및 메타데이터 업데이트
            self.chat_manager.add_message(uuid, hospital_id, "assistant", full_answer)
            message_count = len([m for m in history if m.get("role") == "user"]) + 1
            await self._update_chat_metadata(uuid, hospital_id, session_id, current_keywords, message_count)
            trigger_check = await self.should_trigger_survey(uuid, hospital_id, session_id)
            
            logger.info(f"⏱️ [RAG 채팅] 총 처리 시간: {time.time() - start_total:.2f}s")
            
            yield json.dumps({
                "answer": "",
                "done": True,
                "sources": sources,
                "session_id": session_id,
                "message_count": message_count,
                "trigger_survey": trigger_check["should_trigger"]
            }, ensure_ascii=False) + "\n"

        except Exception as e:
            logger.error(f"❌ [RAG 채팅 서비스] 스트리밍 실패: {str(e)}")
            yield json.dumps({"answer": f"\n\n오류 발생: {str(e)}", "done": True, "error": str(e)}, ensure_ascii=False) + "\n"

    def _calculate_age(self, birth_date_str: Optional[str]) -> int:
        if not birth_date_str: return 40
        try:
            birth_date = datetime.fromisoformat(birth_date_str.replace("Z", "+00:00"))
            return datetime.now().year - birth_date.year
        except:
            return 40

    def _extract_health_stats(self, health_data_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """건강검진 데이터에서 주요 지표 추출"""
        stats = {"bmi": None, "chronic_diseases": []}
        if not health_data_list:
            return stats
            
        # 가장 최근 데이터 사용
        latest = health_data_list[0]
        raw = latest.get("raw_data", {})
        
        # BMI 추출
        for inspection in raw.get("Inspections", []):
            for illness in inspection.get("Illnesses", []):
                for item in illness.get("Items", []):
                    name = item.get("Name", "")
                    value = item.get("Value", "")
                    
                    if "체질량지수" in name or "BMI" in name.upper():
                        try:
                            stats["bmi"] = float(value)
                        except: pass
                    
                    # 만성질환 의심 여부 확인
                    if "정상" not in value and value not in ["음성", "-", ""]:
                        disease_name = illness.get("Name")
                        if disease_name and disease_name not in stats["chronic_diseases"]:
                            # 구체적인 질환명으로 변환
                            mapping = {
                                "고혈압": "고혈압",
                                "당뇨병": "당뇨병",
                                "이상지질혈증": "고지혈증",
                                "간장질환": "간질환",
                                "신장질환": "신장질환"
                            }
                            stats["chronic_diseases"].append(mapping.get(disease_name, disease_name))
        
        return stats

    async def summarize_and_store_persona(self, uuid: str, hospital_id: str) -> Dict[str, Any]:
        """채팅 내용을 요약하여 페르소나 데이터로 DB에 저장"""
        try:
            history = self.chat_manager.get_history(uuid, hospital_id)
            if not history:
                return {"success": False, "message": "채팅 내역이 없습니다."}
            
            # 대화 텍스트 구성
            chat_text = "\n".join([f"{m['role']}: {m['content']}" for m in history])
            
            # LLM 요약 요청
            await gemini_service.initialize()
            prompt = f"""
다음은 사용자와 'Dr. Welno' 건강 봇의 대화 내용입니다. 
사용자의 건강 관심사, 성향, 고민 지점을 분석하여 '페르소나 데이터'를 생성하세요.

[대화 내용]
{chat_text}

[요청 사항]
1. primary_concern: 사용자가 가장 걱정하는 건강 문제
2. health_goal: 사용자가 달성하고자 하는 목표
3. personality: 대화에서 느껴지는 사용자의 성향 (꼼꼼함, 걱정이 많음, 낙천적 등)
4. summary: 대화 요약 (2-3줄)
5. 반드시 JSON 형식으로 반환하세요.
"""
            gemini_request = GeminiRequest(
                prompt=prompt,
                model="gemini-3-flash-preview",
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            
            response = await gemini_service.call_api(gemini_request)
            if not response.success:
                raise Exception(f"LLM 요약 실패: {response.error}")
            
            persona_data = json.loads(response.content)
            
            # DB 저장
            await self.welno_data_service.update_patient_chat_persona(uuid, persona_data)
            
            # 히스토리 삭제 (선택 사항 - 여기선 유지하고 Redis TTL에 맡김)
            
            return {
                "success": True,
                "persona_data": persona_data
            }
        except Exception as e:
            logger.error(f"❌ [Persona] 요약 및 저장 실패: {str(e)}")
            return {"success": False, "error": str(e)}

    def _detect_health_keywords(self, message: str) -> List[str]:
        """건강 관련 키워드 감지"""
        keywords = []
        keyword_map = {
            "영양": ["영양", "영양제", "건기식", "건강기능식품", "비타민", "오메가"],
            "피로": ["피로", "피곤", "지침", "무기력", "졸림"],
            "통증": ["통증", "아프", "아픔", "불편", "두통", "복통"],
            "검진": ["검진", "검사", "진찰", "건강검진", "종합검진"],
            "암": ["암", "종양", "암검진"],
            "가족력": ["가족력", "유전", "가족병력"],
            "당뇨": ["당뇨", "혈당"],
            "고혈압": ["고혈압", "혈압"],
            "비만": ["비만", "체중", "살"],
            "음주": ["술", "음주", "알코올"],
            "흡연": ["담배", "흡연", "금연"]
        }
        
        for category, words in keyword_map.items():
            if any(word in message for word in words):
                if category not in keywords:
                    keywords.append(category)
        
        return keywords
    
    async def _update_chat_metadata(self, uuid: str, hospital_id: str, session_id: str, keywords: List[str], message_count: int):
        if not self.redis_client: return
        key = f"welno:rag_chat:metadata:{uuid}:{hospital_id}:{session_id}"
        existing_json = self.redis_client.get(key)
        existing = json.loads(existing_json) if existing_json else {"detected_keywords": [], "message_count": 0, "survey_triggered": False, "created_at": datetime.now().isoformat()}
        
        for kw in keywords:
            if kw not in existing["detected_keywords"]:
                existing["detected_keywords"].append(kw)
        
        existing["message_count"] = message_count
        existing["updated_at"] = datetime.now().isoformat()
        self.redis_client.setex(key, 86400, json.dumps(existing, ensure_ascii=False))
    
    async def should_trigger_survey(self, uuid: str, hospital_id: str, session_id: str) -> Dict[str, Any]:
        if not self.redis_client: return {"should_trigger": False, "reason": "Redis 연결 실패"}
        meta_key = f"welno:rag_chat:metadata:{uuid}:{hospital_id}:{session_id}"
        metadata_json = self.redis_client.get(meta_key)
        if not metadata_json: return {"should_trigger": False, "reason": "대화 데이터 없음"}
        
        metadata = json.loads(metadata_json)
        if metadata.get("survey_triggered"): return {"should_trigger": False, "reason": "이미 트리거됨"}
        
        message_count = metadata.get("message_count", 0)
        keywords = metadata.get("detected_keywords", [])
        
        if message_count >= 3 and keywords:
            return {"should_trigger": True, "reason": "조건 만족"}
        return {"should_trigger": False, "reason": "조건 미충족"}
