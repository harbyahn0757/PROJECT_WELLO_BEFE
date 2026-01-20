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
        
        # PNT 서비스 초기화 (WelnoDataService의 DB 설정 재사용)
        from ..services.pnt_data_service import PNTDataService
        self.pnt_data_service = PNTDataService(self.welno_data_service.db_config)
        logger.info("✅ [RAG 채팅] PNT 서비스 초기화 완료")
        
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
        사용자 메시지 처리 및 RAG 응답 스트리밍 생성 (단계별 상담 로직 포함)
        """
        start_total = time.time()
        full_answer = ""
        sources = []
        suggestions = []
        
        try:
            # 1. 사용자 메시지 저장
            self.chat_manager.add_message(uuid, hospital_id, "user", message)
            
            # 2. 히스토리 및 메타데이터 추출
            history = self.chat_manager.get_history(uuid, hospital_id)
            user_messages = [m for m in history if m.get("role") == "user"]
            message_count = len(user_messages)
            is_first_message = message_count <= 1
            
            meta_key = f"welno:rag_chat:metadata:{uuid}:{hospital_id}:{session_id}"
            metadata_json = self.redis_client.get(meta_key) if self.redis_client else None
            metadata = json.loads(metadata_json) if metadata_json else {
                "detected_keywords": [], 
                "chat_stage": "initial",
                "is_stale_data": False,
                "stale_year": None
            }
            
            chat_stage = metadata.get("chat_stage", "initial")
            current_keywords = self._detect_health_keywords(message)
            all_keywords = list(set(metadata.get("detected_keywords", []) + current_keywords))
            
            # 3. 환자 건강 데이터 및 기존 문진(페르소나) 데이터 로드
            briefing_context = ""
            is_stale_data = metadata.get("is_stale_data", False)
            stale_year = metadata.get("stale_year")
            
            # 기존 문진 정보 로드 (Context 보강용)
            past_survey_info = ""
            if self.redis_client:
                survey_key = f"welno:survey:{uuid}:{hospital_id}"
                past_survey_json = self.redis_client.get(survey_key)
                if past_survey_json:
                    try:
                        past_survey = json.loads(past_survey_json)
                        responses = past_survey.get("survey_responses", {})
                        if responses:
                            from .checkup_design.survey_mapping import generate_survey_section
                            past_survey_info = f"\n[기본 문진 정보 (페르소나)]\n{generate_survey_section(responses)}\n"
                    except: pass

            if is_first_message:
                try:
                    health_info = await self.welno_data_service.get_patient_health_data(uuid, hospital_id)
                    if "error" not in health_info:
                        patient_name = health_info.get("patient", {}).get("name", "고객")
                        health_data = health_info.get("health_data", [])
                        prescription_data = health_info.get("prescription_data", [])
                        
                        # 최근 3년간 데이터 필터링
                        filtered_health, filtered_prescription = self._filter_recent_3years_data(health_data, prescription_data)
                        
                        if filtered_health:
                            latest = filtered_health[0]
                            year_str = latest.get("year", "0").replace("년", "")
                            try:
                                checkup_year = int(year_str)
                                current_year = datetime.now().year
                                if current_year - checkup_year >= 2:
                                    is_stale_data = True
                                    stale_year = checkup_year
                                    chat_stage = "awaiting_current_concerns"
                            except:
                                pass
                                
                            stats = self._extract_health_stats(filtered_health)
                            trends = self._analyze_health_trends(filtered_health)
                            chronic = ", ".join(stats.get("chronic_diseases", []))
                            
                            # 최근 3년간 주요 요소 정리
                            briefing_context = f"\n[환자 최근 건강 상태 (최근 3년간 데이터 분석)]\n- 이름: {patient_name}\n"
                            briefing_context += f"- 분석 기간: 최근 3년간 ({len(filtered_health)}건 검진, {len(filtered_prescription)}건 복약)\n"
                            
                            if stats.get("bmi"): briefing_context += f"- BMI: {stats['bmi']}\n"
                            if stats.get("bp"): briefing_context += f"- 혈압: {stats['bp']}\n"
                            if chronic: briefing_context += f"- 주의 필요 질환: {chronic}\n"
                            
                            # 추이 분석 추가
                            if trends.get("bmi_trend") and len(trends["bmi_trend"]) >= 2:
                                bmi_values = [t["value"] for t in trends["bmi_trend"]]
                                if bmi_values[0] > bmi_values[-1]:
                                    briefing_context += f"- BMI 추이: {bmi_values[-1]:.1f} → {bmi_values[0]:.1f} (증가 추세)\n"
                                elif bmi_values[0] < bmi_values[-1]:
                                    briefing_context += f"- BMI 추이: {bmi_values[-1]:.1f} → {bmi_values[0]:.1f} (감소 추세)\n"
                            
                            if trends.get("blood_sugar_trend") and len(trends["blood_sugar_trend"]) >= 2:
                                sugar_values = [t["value"] for t in trends["blood_sugar_trend"]]
                                if sugar_values[0] > sugar_values[-1]:
                                    briefing_context += f"- 공복혈당 추이: {sugar_values[-1]:.0f} → {sugar_values[0]:.0f}mg/dL (증가 추세)\n"
                                elif sugar_values[0] < sugar_values[-1]:
                                    briefing_context += f"- 공복혈당 추이: {sugar_values[-1]:.0f} → {sugar_values[0]:.0f}mg/dL (감소 추세)\n"
                            
                            if trends.get("risk_assessment"):
                                risks = ", ".join(trends["risk_assessment"])
                                briefing_context += f"- 위험도 평가: {risks}\n"
                            
                            # 복약 데이터 요약
                            if filtered_prescription:
                                med_names = set()
                                for pres in filtered_prescription[:5]:  # 최근 5건만
                                    raw = pres.get("raw_data", {})
                                    if isinstance(raw, dict):
                                        meds = raw.get("medications", [])
                                        for med in meds:
                                            name = med.get("name") or med.get("drug_name") or med.get("ChoBangYakPumMyung", "")
                                            if name:
                                                med_names.add(name)
                                
                                if med_names:
                                    briefing_context += f"- 최근 복약: {', '.join(list(med_names)[:5])}\n"
                            
                            if is_stale_data:
                                briefing_context += f"\n**주의**: 이 데이터는 {stale_year}년 데이터로 2년 이상 경과되었습니다. 이를 언급하고 현재 상태를 물어보세요."
                            else:
                                briefing_context += "\n이 정보를 바탕으로 다각도로 분석하여 상담을 시작하세요. 추이, 패턴, 위험도를 종합적으로 언급하세요."
                                chat_stage = "normal"
                            
                            # Redis에 검진/복약 데이터 요약 저장 (이후 메시지에서 참조)
                            if self.redis_client:
                                summary_key = f"welno:rag_chat:data_summary:{uuid}:{hospital_id}:{session_id}"
                                summary_data = {
                                    "patient_name": patient_name,
                                    "health_summary": briefing_context,
                                    "filtered_health_count": len(filtered_health),
                                    "filtered_prescription_count": len(filtered_prescription),
                                    "is_stale_data": is_stale_data,
                                    "stale_year": stale_year
                                }
                                self.redis_client.setex(summary_key, 86400, json.dumps(summary_data, ensure_ascii=False))
                except Exception as e:
                    logger.warning(f"⚠️ [브리핑] 데이터 로드 실패: {e}")

            # 4. 응답 생성 분기
            # 일반 RAG 스트리밍
            search_query = message
            if current_keywords:
                search_query = f"{', '.join(current_keywords)} 관련: {message}"
            
            from .checkup_design.rag_service import init_rag_engine, CHAT_SYSTEM_PROMPT
            query_engine = await init_rag_engine(use_local_vector_db=True)
            
            if query_engine:
                nodes = await query_engine.aretrieve(search_query)
                context_str = "\n".join([n.node.get_content() for n in nodes])
                
                # 소스 추출 강화 (메타데이터 포함, 중복 제거)
                sources = []
                seen_sources = set()  # 중복 제거용 (file_name + page)
                for n in nodes:
                    meta = n.node.metadata or {}
                    file_name = meta.get("file_name") or meta.get("title") or "참고 문헌"
                    page = meta.get("page_label") or meta.get("page") or ""
                    
                    # 중복 체크 (file_name + page 조합)
                    source_key = f"{file_name}|{page}"
                    if source_key in seen_sources:
                        continue  # 이미 추가된 소스는 건너뛰기
                    seen_sources.add(source_key)
                    
                    sources.append({
                        "text": clean_html_content(n.node.get_content())[:500],
                        "score": float(n.score) if hasattr(n, 'score') else None,
                        "title": file_name,
                        "page": page
                    })
                
                # 세션 히스토리 준비 (첫 메시지가 아닌 경우)
                chat_history = None
                if not is_first_message:
                    # 이전 대화 히스토리 가져오기
                    history = self.chat_manager.get_history(uuid, hospital_id)
                    if history and len(history) >= 2:  # 최소 user + assistant 한 쌍
                        # Gemini Chat 형식으로 변환 (전체 히스토리)
                        chat_history = gemini_service._format_chat_history(history)
                        logger.info(f"📜 [세션 히스토리] {len(chat_history)}개 메시지 로드")
                
                # 프롬프트 구성
                if is_first_message:
                    # 첫 메시지: 검진/복약 데이터 포함
                    enhanced_prompt = CHAT_SYSTEM_PROMPT
                    combined_context = briefing_context + past_survey_info + f"\n[의학 지식 문서 (참고 문헌)]\n{context_str}"
                    if combined_context:
                        enhanced_prompt = enhanced_prompt.replace("[Context]", f"[Context]{combined_context}")
                    
                    # 단계별 지침 추가
                    stage_instruction = ""
                    logger.info(f"🔍 [PNT] 첫 메시지 chat_stage: {chat_stage}, message: {message[:50]}")
                    if chat_stage == "awaiting_current_concerns":
                        stage_instruction = "\n\n**상담 단계**: 간략히 조언 후 '최근 걱정되거나 불편한 곳이 있는지' 질문하세요."
                    elif any(kw in message for kw in ["영양제", "건기식", "비타민", "추천"]):
                        # 첫 메시지에서 영양제 관련 질문 시 PNT 유도
                        logger.info(f"✅ [PNT] 영양제 키워드 감지! chat_stage를 pnt_ready로 변경")
                        stage_instruction = "\n\n**상담 지침**: 답변 끝에 PNT 문진 제안."
                        chat_stage = "pnt_ready"
                    else:
                        stage_instruction = "\n추이, 패턴을 분석하되 상담사 연결을 유도하세요."
                        chat_stage = "normal"
                    logger.info(f"🔍 [PNT] 최종 chat_stage: {chat_stage}")
                    
                    enhanced_prompt += stage_instruction
                    enhanced_prompt += "\n\n**중요**: 답변이 끝난 후 반드시 빈 줄을 하나 두고, 사용자가 이어서 물어볼 법한 짧은 질문 2~3개를 '[SUGGESTIONS] 질문1, 질문2, 질문3 [/SUGGESTIONS]' 형식으로 포함하세요."
                    
                    prompt = enhanced_prompt.format(context_str=context_str, query_str=message)
                    gemini_req = GeminiRequest(prompt=prompt, model="gemini-3-flash-preview", chat_history=None)
                else:
                    # 이후 메시지: 히스토리 + 검진/복약/문진 데이터 요약 포함
                    # Redis에서 저장된 검진/복약 데이터 요약 가져오기
                    data_summary = ""
                    if self.redis_client:
                        summary_key = f"welno:rag_chat:data_summary:{uuid}:{hospital_id}:{session_id}"
                        summary_json = self.redis_client.get(summary_key)
                        if summary_json:
                            try:
                                summary_data = json.loads(summary_json)
                                data_summary = summary_data.get("health_summary", "")
                                if data_summary:
                                    data_summary = f"\n[환자 건강 데이터 요약 (과거 내역 참고용)]\n{data_summary}\n"
                            except:
                                pass
                    
                    # 문진 내역도 함께 전달 (이후 메시지에서도)
                    past_survey_info_subsequent = ""
                    if self.redis_client:
                        survey_key = f"welno:survey:{uuid}:{hospital_id}"
                        past_survey_json = self.redis_client.get(survey_key)
                        if past_survey_json:
                            try:
                                past_survey = json.loads(past_survey_json)
                                responses = past_survey.get("survey_responses", {})
                                if responses:
                                    from .checkup_design.survey_mapping import generate_survey_section
                                    past_survey_info_subsequent = f"\n[기본 문진 정보 (페르소나)]\n{generate_survey_section(responses)}\n"
                            except: pass
                    
                    # 히스토리와 검진/복약/문진 데이터 요약을 함께 전달
                    prompt = f"{data_summary}{past_survey_info_subsequent}[의학 지식 문서 (참고 문헌)]\n{context_str}\n\n사용자 질문: {message}\n전문가 답변:"
                    
                    # 단계별 지침 추가
                    stage_instruction = ""
                    if chat_stage == "awaiting_current_concerns":
                        stage_instruction = "\n\n**상담 단계**: 현재 고민과 과거 데이터 연결, 상담사 유도."
                        # 건기식 질문인 경우 PNT 유도 멘트 추가
                        if any(kw in message for kw in ["영양제", "건기식", "비타민", "추천", "상담"]):
                            stage_instruction += " 답변 끝에 PNT 문진 제안."
                            chat_stage = "pnt_ready"
                        else:
                            chat_stage = "normal"
                    elif any(kw in message for kw in ["영양제", "건기식", "비타민", "추천", "상담"]):
                        stage_instruction = "\n\n**상담 지침**: 답변 끝에 PNT 문진 제안."
                        chat_stage = "pnt_ready"
                    else:
                        # 복잡한 증상이나 의학적 판단이 필요한 경우 상담사 연결 유도
                        if any(kw in message for kw in ["피로", "통증", "증상", "아픔", "불편", "걱정"]):
                            stage_instruction = "\n\n**상담 지침**: 답변 끝에 상담사 연결 권장."
                    
                    prompt += stage_instruction
                    prompt += "\n\n**중요**: 답변이 끝난 후 반드시 빈 줄을 하나 두고, 사용자가 이어서 물어볼 법한 짧은 질문 2~3개를 '[SUGGESTIONS] 질문1, 질문2, 질문3 [/SUGGESTIONS]' 형식으로 포함하세요."
                    
                    gemini_req = GeminiRequest(prompt=prompt, model="gemini-3-flash-preview", chat_history=chat_history)
                
                async for chunk in gemini_service.stream_api(gemini_req, session_id=session_id):
                    full_answer += chunk
                    display_chunk = chunk
                    if "[SUGGESTIONS]" in full_answer and "[SUGGESTIONS]" in chunk:
                        display_chunk = chunk.split("[SUGGESTIONS]")[0]
                    elif "[SUGGESTIONS]" in full_answer:
                        display_chunk = ""
                        
                    if display_chunk:
                        yield json.dumps({"answer": display_chunk, "done": False}, ensure_ascii=False) + "\n"
                
                # 예상 질문 파싱
                if "[SUGGESTIONS]" in full_answer:
                    try:
                        sug_part = full_answer.split("[SUGGESTIONS]")[1].split("[/SUGGESTIONS]")[0]
                        suggestions = [s.strip() for s in sug_part.split(",") if s.strip()][:3]
                        full_answer = full_answer.split("[SUGGESTIONS]")[0].strip()
                    except:
                        pass
            else:
                yield json.dumps({"answer": "죄송합니다. 엔진 초기화에 실패했습니다.", "done": False}, ensure_ascii=False) + "\n"

            # 5. 마무리 및 메타데이터 업데이트
            self.chat_manager.add_message(uuid, hospital_id, "assistant", full_answer)
            
            # PNT 문진 트리거 조건: pnt_ready 단계이거나 영양 관련 키워드가 포함된 3회 이상 대화 시
            has_nutrition_kw = any(kw in all_keywords for kw in ["영양", "건기식", "비타민"])
            trigger_pnt = (chat_stage == "pnt_ready") or (message_count >= 3 and has_nutrition_kw)
            
            # PNT 문진 시작 제안 플래그 추가 (영양제 관련 키워드 직접 체크)
            has_nutrition_keyword_in_message = any(kw in message for kw in ["영양제", "건기식", "비타민", "추천", "상담"])
            suggest_pnt = (chat_stage == "pnt_ready") or has_nutrition_keyword_in_message
            print(f"🔍 DEBUG: chat_stage={chat_stage}, has_keyword={has_nutrition_keyword_in_message}, suggest_pnt={suggest_pnt}, message={message[:30]}")
            
            # 메타데이터 업데이트
            metadata.update({
                "detected_keywords": all_keywords,
                "chat_stage": chat_stage,
                "is_stale_data": is_stale_data,
                "stale_year": stale_year,
                "message_count": message_count,
                "survey_triggered": metadata.get("survey_triggered", False) or trigger_pnt
            })
            if self.redis_client:
                self.redis_client.setex(meta_key, 86400, json.dumps(metadata, ensure_ascii=False))
            
            yield json.dumps({
                "answer": "",
                "done": True,
                "sources": sources,
                "suggestions": suggestions,
                "session_id": session_id,
                "message_count": message_count,
                "trigger_survey": trigger_pnt,
                "suggest_pnt": suggest_pnt  # PNT 문진 시작 제안
            }, ensure_ascii=False) + "\n"

        except Exception as e:
            logger.error(f"❌ [RAG 채팅 서비스] 스트리밍 실패: {str(e)}")
            import traceback
            traceback.print_exc()
            error_data = {"answer": f"\n\n상담 중 오류가 발생했습니다. ({str(e)[:50]})", "done": True, "error": str(e)}
            yield json.dumps(error_data, ensure_ascii=False) + "\n"

        except Exception as e:
            logger.error(f"❌ [RAG 채팅 서비스] 스트리밍 실패: {str(e)}")
            import traceback
            traceback.print_exc()
            # ERR_EMPTY_RESPONSE 방지를 위해 최소한의 에러 메시지 전송
            error_data = {
                "answer": f"\n\n상담 서비스 연결에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요. (오류: {str(e)[:50]})", 
                "done": True, 
                "error": str(e)
            }
            yield json.dumps(error_data, ensure_ascii=False) + "\n"

    def _calculate_age(self, birth_date_str: Optional[str]) -> int:
        if not birth_date_str: return 40
        try:
            birth_date = datetime.fromisoformat(birth_date_str.replace("Z", "+00:00"))
            return datetime.now().year - birth_date.year
        except:
            return 40

    def _extract_health_stats(self, health_data_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """건강검진 데이터에서 주요 지표 추출 (정밀도 개선)"""
        stats = {"bmi": None, "bp": None, "chronic_diseases": []}
        if not health_data_list:
            return stats
            
        # 가장 최근 데이터 사용
        latest = health_data_list[0]
        raw = latest.get("raw_data", {})
        
        for inspection in raw.get("Inspections", []):
            for illness in inspection.get("Illnesses", []):
                disease_name = illness.get("Name", "")
                for item in illness.get("Items", []):
                    name = item.get("Name", "")
                    value = str(item.get("Value", ""))
                    
                    # 1. BMI 추출 및 판정
                    if "체질량지수" in name or "BMI" in name.upper():
                        try:
                            bmi_val = float(value)
                            stats["bmi"] = bmi_val
                            if bmi_val >= 25.0 and "비만" not in stats["chronic_diseases"]:
                                stats["chronic_diseases"].append("비만")
                        except: pass
                    
                    # 2. 혈압 판정
                    if "혈압" in name and "/" in value:
                        stats["bp"] = value
                        try:
                            parts = value.split("/")
                            sys = int(parts[0].strip())
                            dia = int(parts[1].strip())
                            if (sys >= 140 or dia >= 90) and "고혈압" not in stats["chronic_diseases"]:
                                stats["chronic_diseases"].append("고혈압")
                        except: pass
                    
                    # 3. 텍스트 기반 이상 징후 (질환의심, 양성 등)
                    if any(word in value for word in ["의심", "이상", "양성", "+", "높음", "낮음"]):
                        if disease_name and disease_name not in stats["chronic_diseases"]:
                            stats["chronic_diseases"].append(disease_name)
        
        # 매핑 처리
        mapping = {
            "당뇨병": "당뇨",
            "이상지질혈증": "고지혈증",
            "간장질환": "간질환",
            "신장질환": "신장질환",
            "비만": "비만/과체중"
        }
    
    def _filter_recent_3years_data(self, health_data_list: List[Dict[str, Any]], prescription_data_list: List[Dict[str, Any]]) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """최근 3년간 검진/복약 데이터 필터링"""
        current_year = datetime.now().year
        three_years_ago = current_year - 3
        
        # 검진 데이터 필터링
        filtered_health = []
        for data in health_data_list:
            year_str = data.get("year", "0").replace("년", "").strip()
            try:
                year = int(year_str)
                if year >= three_years_ago:
                    filtered_health.append(data)
            except:
                # 연도 파싱 실패 시 포함하지 않음
                continue
        
        # 복약 데이터 필터링
        filtered_prescription = []
        for data in prescription_data_list:
            # treatment_date 또는 prescription_date 확인
            date_str = data.get("treatment_date") or data.get("prescription_date") or data.get("date", "")
            if not date_str:
                continue
            
            try:
                # 날짜 파싱 (다양한 형식 지원)
                if isinstance(date_str, str):
                    if len(date_str) == 10 and "-" in date_str:  # YYYY-MM-DD
                        year = int(date_str.split("-")[0])
                    elif len(date_str) == 8:  # YYYYMMDD
                        year = int(date_str[:4])
                    else:
                        # 다른 형식 시도
                        year = datetime.fromisoformat(date_str.replace("Z", "+00:00")).year
                else:
                    year = date_str.year if hasattr(date_str, 'year') else current_year
                
                if year >= three_years_ago:
                    filtered_prescription.append(data)
            except:
                continue
        
        return filtered_health, filtered_prescription
    
    def _analyze_health_trends(self, health_data_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """건강검진 데이터 추이 분석 (최근 3년)"""
        trends = {
            "bmi_trend": [],
            "bp_trend": [],
            "blood_sugar_trend": [],
            "cholesterol_trend": [],
            "risk_assessment": []
        }
        
        if not health_data_list or len(health_data_list) < 2:
            return trends
        
        # 최근 3년 데이터 필터링
        filtered_data, _ = self._filter_recent_3years_data(health_data_list, [])
        if not filtered_data:
            return trends
        
        # 최근 3개 데이터만 사용 (최대 3년)
        recent_data = filtered_data[:3]
        
        for data in recent_data:
            year = data.get("year", "").replace("년", "")
            raw = data.get("raw_data", {})
            
            bmi_val = None
            bp_val = None
            blood_sugar = None
            cholesterol = None
            
            for inspection in raw.get("Inspections", []):
                for illness in inspection.get("Illnesses", []):
                    for item in illness.get("Items", []):
                        name = item.get("Name", "")
                        value = str(item.get("Value", ""))
                        
                        if "체질량지수" in name or "BMI" in name.upper():
                            try:
                                bmi_val = float(value)
                            except: pass
                        
                        if "혈압" in name and "/" in value:
                            bp_val = value
                        
                        if "공복혈당" in name or "혈당" in name:
                            try:
                                blood_sugar = float(value.replace("mg/dL", "").strip())
                            except: pass
                        
                        if "총콜레스테롤" in name or "콜레스테롤" in name:
                            try:
                                cholesterol = float(value.replace("mg/dL", "").strip())
                            except: pass
            
            if bmi_val:
                trends["bmi_trend"].append({"year": year, "value": bmi_val})
            if bp_val:
                trends["bp_trend"].append({"year": year, "value": bp_val})
            if blood_sugar:
                trends["blood_sugar_trend"].append({"year": year, "value": blood_sugar})
            if cholesterol:
                trends["cholesterol_trend"].append({"year": year, "value": cholesterol})
        
        # 위험도 평가
        if trends["bmi_trend"]:
            latest_bmi = trends["bmi_trend"][0]["value"]
            if latest_bmi >= 30:
                trends["risk_assessment"].append("고도 비만")
            elif latest_bmi >= 25:
                trends["risk_assessment"].append("비만/과체중")
        
        if trends["bp_trend"]:
            latest_bp = trends["bp_trend"][0]["value"]
            try:
                parts = latest_bp.split("/")
                sys = int(parts[0].strip())
                if sys >= 140:
                    trends["risk_assessment"].append("고혈압")
                elif sys >= 130:
                    trends["risk_assessment"].append("경계 고혈압")
            except: pass
        
        if trends["blood_sugar_trend"]:
            latest_sugar = trends["blood_sugar_trend"][0]["value"]
            if latest_sugar >= 126:
                trends["risk_assessment"].append("당뇨 의심")
            elif latest_sugar >= 100:
                trends["risk_assessment"].append("공복혈당장애")
        
        return trends
        stats["chronic_diseases"] = list(set([mapping.get(d, d) for d in stats["chronic_diseases"]]))
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
    
    async def start_pnt_survey(
        self,
        uuid: str,
        hospital_id: str,
        session_id: str
    ) -> Dict[str, Any]:
        """
        PNT 문진 시작 - 첫 질문 반환
        """
        try:
            # 1. PNT 그룹 조회 (영양상태평가만)
            groups = await self.pnt_data_service.get_all_groups()
            nutrition_groups = [g for g in groups if 'nutrition' in g.get('group_id', '')]
            
            if not nutrition_groups:
                return {
                    "success": False,
                    "error": "PNT 질문을 찾을 수 없습니다.",
                    "question": None
                }
            
            # 2. 첫 번째 그룹의 첫 번째 질문 조회
            first_group = nutrition_groups[0]
            questions = await self.pnt_data_service.get_questions_by_group(first_group['group_id'])
            
            if not questions:
                return {
                    "success": False,
                    "error": "질문이 없습니다.",
                    "question": None
                }
            
            first_question = questions[0]
            
            # 3. 진행 상태 저장 (Redis)
            pnt_state_key = f"welno:pnt_survey:state:{uuid}:{hospital_id}:{session_id}"
            pnt_state = {
                "current_group_index": 0,
                "current_question_index": 0,
                "group_ids": [g['group_id'] for g in nutrition_groups],
                "answered_questions": [],
                "started_at": datetime.now().isoformat()
            }
            if self.redis_client:
                self.redis_client.setex(pnt_state_key, 3600, json.dumps(pnt_state, ensure_ascii=False))
            
            return {
                "success": True,
                "question": {
                    "question_id": first_question['question_id'],
                    "question_text": first_question['question_text'],
                    "question_type": first_question['question_type'],
                    "options": first_question.get('options', []),
                    "group_name": first_group['group_name'],
                    "question_index": 1,
                    "total_questions": sum(len(await self.pnt_data_service.get_questions_by_group(gid)) for gid in [g['group_id'] for g in nutrition_groups])
                }
            }
        except Exception as e:
            logger.error(f"❌ [PNT 문진] 시작 실패: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "question": None
            }
    
    async def submit_pnt_answer(
        self,
        uuid: str,
        hospital_id: str,
        session_id: str,
        question_id: str,
        answer_value: str,
        answer_score: int
    ) -> Dict[str, Any]:
        """
        PNT 답변 제출 - 다음 질문 또는 추천 반환
        """
        try:
            # 1. 답변 저장
            await self.pnt_data_service.save_user_response(
                patient_uuid=uuid,
                hospital_id=hospital_id,
                session_id=session_id,
                question_id=question_id,
                answer_value=answer_value,
                answer_score=answer_score
            )
            
            # 2. 진행 상태 로드
            pnt_state_key = f"welno:pnt_survey:state:{uuid}:{hospital_id}:{session_id}"
            if not self.redis_client:
                return {"success": False, "error": "Redis 연결 실패"}
            
            state_json = self.redis_client.get(pnt_state_key)
            if not state_json:
                return {"success": False, "error": "진행 상태를 찾을 수 없습니다."}
            
            state = json.loads(state_json)
            state["answered_questions"].append(question_id)
            
            # 3. 다음 질문 조회
            group_ids = state["group_ids"]
            current_group_idx = state["current_group_index"]
            current_q_idx = state["current_question_index"]
            
            # 그룹 정보 조회 (group_name을 위해)
            all_groups = await self.pnt_data_service.get_all_groups()
            group_map = {g['group_id']: g for g in all_groups}
            
            # 현재 그룹의 다음 질문
            current_group_id = group_ids[current_group_idx]
            questions = await self.pnt_data_service.get_questions_by_group(current_group_id)
            current_group = group_map.get(current_group_id, {})
            
            next_q_idx = current_q_idx + 1
            
            if next_q_idx < len(questions):
                # 같은 그룹 내 다음 질문
                next_question = questions[next_q_idx]
                state["current_question_index"] = next_q_idx
                
                if self.redis_client:
                    self.redis_client.setex(pnt_state_key, 3600, json.dumps(state, ensure_ascii=False))
                
                # 총 질문 수 계산
                total_q = sum(len(await self.pnt_data_service.get_questions_by_group(gid)) for gid in group_ids)
                
                return {
                    "success": True,
                    "question": {
                        "question_id": next_question['question_id'],
                        "question_text": next_question['question_text'],
                        "question_type": next_question['question_type'],
                        "options": next_question.get('options', []),
                        "group_name": current_group.get('group_name', ''),
                        "question_index": len(state["answered_questions"]) + 1,
                        "total_questions": total_q
                    },
                    "is_complete": False
                }
            else:
                # 다음 그룹으로 이동
                next_group_idx = current_group_idx + 1
                if next_group_idx < len(group_ids):
                    next_group_id = group_ids[next_group_idx]
                    next_questions = await self.pnt_data_service.get_questions_by_group(next_group_id)
                    next_group = group_map.get(next_group_id, {})
                    
                    if next_questions:
                        next_question = next_questions[0]
                        state["current_group_index"] = next_group_idx
                        state["current_question_index"] = 0
                        
                        if self.redis_client:
                            self.redis_client.setex(pnt_state_key, 3600, json.dumps(state, ensure_ascii=False))
                        
                        # 총 질문 수 계산
                        total_q = sum(len(await self.pnt_data_service.get_questions_by_group(gid)) for gid in group_ids)
                        
                        return {
                            "success": True,
                            "question": {
                                "question_id": next_question['question_id'],
                                "question_text": next_question['question_text'],
                                "question_type": next_question['question_type'],
                                "options": next_question.get('options', []),
                                "group_name": next_group.get('group_name', ''),
                                "question_index": len(state["answered_questions"]) + 1,
                                "total_questions": total_q
                            },
                            "is_complete": False
                        }
            
            # 4. 모든 질문 완료 - 추천 생성
            recommendation_id = await self.pnt_data_service.generate_final_recommendations(
                patient_uuid=uuid,
                hospital_id=hospital_id,
                session_id=session_id
            )
            
            recommendation = await self.pnt_data_service.get_final_recommendation(
                patient_uuid=uuid,
                session_id=session_id
            )
            
            # Redis 상태 삭제
            if self.redis_client:
                self.redis_client.delete(pnt_state_key)
            
            # 추천 데이터를 딕셔너리로 변환 (JSON 문자열인 경우)
            recommendations_dict = {}
            if recommendation:
                import json as json_lib
                if isinstance(recommendation.get('recommended_tests'), str):
                    recommendations_dict['recommended_tests'] = json_lib.loads(recommendation['recommended_tests'])
                else:
                    recommendations_dict['recommended_tests'] = recommendation.get('recommended_tests', [])
                
                if isinstance(recommendation.get('recommended_supplements'), str):
                    recommendations_dict['recommended_supplements'] = json_lib.loads(recommendation['recommended_supplements'])
                else:
                    recommendations_dict['recommended_supplements'] = recommendation.get('recommended_supplements', [])
                
                if isinstance(recommendation.get('recommended_foods'), str):
                    recommendations_dict['recommended_foods'] = json_lib.loads(recommendation['recommended_foods'])
                else:
                    recommendations_dict['recommended_foods'] = recommendation.get('recommended_foods', [])
            
            return {
                "success": True,
                "question": None,
                "is_complete": True,
                "recommendations": recommendations_dict
            }
            
        except Exception as e:
            logger.error(f"❌ [PNT 문진] 답변 제출 실패: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e),
                "question": None
            }
