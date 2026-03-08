"""
파트너 RAG 채팅 서비스

파트너사에서 제공하는 검진 데이터와 웰노 RAG 지식베이스를 통합하여
개인화된 건강 상담을 제공합니다.
"""

import logging
import json
import asyncio
import time
from typing import Dict, Any, Optional, List, AsyncGenerator
from datetime import datetime

from .welno_rag_chat_service import WelnoRagChatService
from ..middleware.partner_auth import PartnerAuthInfo
from ..utils.security_utils import get_encrypted_redis_key, log_partner_access

logger = logging.getLogger(__name__)


class PartnerRagChatService(WelnoRagChatService):
    """파트너 RAG 채팅 서비스 - 기존 WelnoRagChatService 확장"""
    
    def __init__(self):
        super().__init__()
        logger.info("✅ [파트너 RAG 채팅] 서비스 초기화 완료")
    
    async def handle_partner_message_stream(
        self,
        partner_info: PartnerAuthInfo,
        uuid: str,
        hospital_id: str,
        message: str,
        session_id: str,
        partner_health_data: Optional[Dict[str, Any]] = None
    ) -> AsyncGenerator[str, None]:
        """
        파트너 데이터를 통합한 RAG 채팅 응답 스트리밍 생성
        
        Args:
            partner_info: 파트너 인증 정보
            uuid: 사용자 ID
            hospital_id: 병원 ID (파트너별로 다를 수 있음)
            message: 사용자 메시지
            session_id: 세션 ID
            partner_health_data: 파트너가 제공하는 검진 데이터
            
        Yields:
            str: SSE 형식의 스트리밍 응답
        """
        
        logger.info(f"📨 [파트너 RAG] 메시지 수신 - {partner_info.partner_id}: {message[:50]}...")
        
        # [정밀 추적] 시작 시간 및 모든 변수 기록
        trace_data = {
            "timestamp": datetime.now().isoformat(),
            "partner_id": partner_info.partner_id,
            "uuid": uuid,
            "hospital_id": hospital_id,
            "message": message,
            "session_id": session_id,
            "raw_health_data": partner_health_data,
            "timings": {}
        }
        start_time = time.time()
        
        try:
            # 1. 파트너 데이터 전처리 및 검증
            pre_start = time.time()
            processed_data = await self._process_partner_health_data(
                partner_info, partner_health_data
            )
            trace_data["timings"]["preprocess_ms"] = (time.time() - pre_start) * 1000

            # 1-1. health_data 미수신 시 Redis(warmup 저장분) 폴백
            redis_fallback_used = False
            if not processed_data.get("has_data") and self.redis_client:
                try:
                    data_mapping_key = f"welno:partner_rag:mapping:{session_id}:data"
                    partner_data_key = self.redis_client.get(data_mapping_key)
                    if partner_data_key:
                        cached_json = self.redis_client.get(partner_data_key)
                        if cached_json:
                            processed_data = json.loads(cached_json)
                            redis_fallback_used = True
                            logger.info(
                                f"♻️ [파트너 RAG] Redis 폴백 사용 - session={session_id} "
                                f"source={processed_data.get('source')}"
                            )
                except Exception as e:
                    logger.warning(f"⚠️ [파트너 RAG] Redis 폴백 실패: {e}")

            trace_data["processed_data"] = processed_data
            trace_data["redis_fallback"] = redis_fallback_used

            # 2. 병원별 RAG/LLM 설정 로드
            config_start = time.time()
            hospital_config = await self.get_hospital_rag_config(
                partner_info.partner_id, hospital_id
            )
            trace_data["hospital_config"] = hospital_config
            trace_data["partner_info"] = {
                "partner_id": partner_info.partner_id,
                "partner_name": partner_info.partner_name,
                "api_key": partner_info.api_key[:10] + "..." if partner_info.api_key else None,
                "iframe_allowed": partner_info.iframe_allowed,
                "allowed_domains": partner_info.allowed_domains
            }
            trace_data["timings"]["load_config_ms"] = (time.time() - config_start) * 1000

            # 2-0. client_info 구성 (채팅 로그에 환자 메타 정보 저장용)
            patient_info = processed_data.get("patient_info", {})
            trace_data["client_info"] = {
                "patient_name": patient_info.get("name", ""),
                "patient_gender": patient_info.get("gender", ""),
                "patient_birth": patient_info.get("birth_date", ""),
                "patient_contact": patient_info.get("contact", ""),
                "hospital_name": processed_data.get("partner_hospital_name", ""),
                "hospital_tel": processed_data.get("partner_hospital_tel", ""),
            }

            # 2-1. 파트너 데이터에 병원명이 있으면 자동 등록된 병원명 업데이트
            partner_hospital_name = processed_data.get("partner_hospital_name")
            if partner_hospital_name and hospital_id:
                try:
                    from .dynamic_config_service import DynamicConfigService
                    await DynamicConfigService.update_hospital_name(
                        partner_info.partner_id, hospital_id, partner_hospital_name
                    )
                except Exception:
                    pass

            # 3. 세션 메타데이터에 파트너 정보 저장 (Redis 폴백으로 복원한 경우 덮어쓰기 방지)
            meta_start = time.time()
            if not redis_fallback_used:
                await self._store_partner_session_metadata(
                    session_id, partner_info, processed_data
                )
            trace_data["timings"]["metadata_storage_ms"] = (time.time() - meta_start) * 1000
            
            # 3. 기존 RAG 서비스 로직 활용하되 파트너 데이터 통합
            async for chunk in self._generate_partner_response_stream(
                partner_info=partner_info,
                uuid=uuid,
                hospital_id=hospital_id,
                message=message,
                session_id=session_id,
                partner_data=processed_data,
                trace_data=trace_data # 추적 데이터 전달
            ):
                yield chunk
            
            # 최종 추적 보고서 저장
            trace_data["timings"]["total_process_ms"] = (time.time() - start_time) * 1000
            with open(f"/home/workspace/PROJECT_WELNO_BEFE/planning-platform/backend/logs/trace_{uuid}_{int(time.time())}.json", "w", encoding="utf-8") as f:
                json.dump(trace_data, f, ensure_ascii=False, indent=2)
                
        except Exception as e:
            logger.error(f"❌ [파트너 RAG] 응답 생성 실패 - {partner_info.partner_id}: {e}")
            error_response = {
                "error": "응답 생성 중 오류가 발생했습니다.",
                "partner_id": partner_info.partner_id,
                "done": True
            }
            yield f"data: {json.dumps(error_response, ensure_ascii=False)}\n\n"
    
    async def _process_partner_health_data(
        self, 
        partner_info: PartnerAuthInfo, 
        health_data: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        파트너 검진 데이터 전처리 및 표준화
        
        Args:
            partner_info: 파트너 정보
            health_data: 원본 검진 데이터
            
        Returns:
            Dict: 표준화된 검진 데이터
        """
        
        if not health_data:
            logger.warning(
                f"⚠️ [파트너 RAG] 검진 데이터 미수신 - partner={partner_info.partner_id}"
            )
            return {"has_data": False, "source": "partner", "data_missing_reason": "no_data_in_request"}
        
        logger.info(f"[파트너 RAG] 검진 데이터 처리 시작 - {partner_info.partner_id}")
        
        try:
            # 파트너별 데이터 형식에 따른 처리
            if partner_info.partner_id == "kindhabit":
                return await self._process_kindhabit_data(health_data)
            elif partner_info.partner_id == "medilinx":
                return await self._process_medilinx_data(health_data)
            else:
                # 일반적인 표준 형식으로 처리
                return await self._process_standard_health_data(health_data)
                
        except Exception as e:
            logger.error(f"❌ [파트너 RAG] 데이터 처리 실패 - {partner_info.partner_id}: {e}")
            return {"has_data": False, "error": str(e), "source": "partner"}
    
    async def _process_kindhabit_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """KindHabit 파트너 데이터 처리"""
        
        processed = {
            "has_data": True,
            "source": "kindhabit",
            "processed_at": datetime.now().isoformat(),
            "patient_info": {},
            "health_metrics": {},
            "recommendations": []
        }
        
        # KindHabit 필드 누락 경고
        if "user_info" not in data:
            logger.warning("⚠️ [파트너 RAG] kindhabit: user_info 필드 누락")
        if "health_data" not in data:
            logger.warning("⚠️ [파트너 RAG] kindhabit: health_data 필드 누락")

        # KindHabit 특화 데이터 매핑
        if "user_info" in data:
            user_info = data["user_info"]
            processed["patient_info"] = {
                "name": user_info.get("name", "고객"),
                "age": user_info.get("age"),
                "gender": user_info.get("gender"),
                "height": user_info.get("height"),
                "weight": user_info.get("weight")
            }
            # 파트너가 전달한 병원명/전화번호
            if user_info.get("hospital_name"):
                processed["partner_hospital_name"] = user_info["hospital_name"]
            if user_info.get("hospital_tel"):
                processed["partner_hospital_tel"] = user_info["hospital_tel"]
        
        if "health_data" in data:
            health_data = data["health_data"]
            processed["health_metrics"] = {
                "bmi": health_data.get("bmi"),
                "blood_pressure": health_data.get("blood_pressure"),
                "blood_sugar": health_data.get("blood_sugar"),
                "cholesterol": health_data.get("cholesterol"),
                "last_checkup_date": health_data.get("checkup_date")
            }
        
        logger.info(f"✅ [파트너 RAG] KindHabit 데이터 처리 완료")
        return processed
    
    async def _process_medilinx_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """MediLinx 파트너 데이터 처리"""
        
        processed = {
            "has_data": True,
            "source": "medilinx", 
            "processed_at": datetime.now().isoformat(),
            "patient_info": {},
            "health_metrics": {},
            "medical_history": []
        }
        
        # MediLinx 필드 누락 경고
        if "patient" not in data:
            logger.warning("⚠️ [파트너 RAG] medilinx: patient 필드 누락")
        if "checkup_results" not in data:
            logger.warning("⚠️ [파트너 RAG] medilinx: checkup_results 필드 누락")

        # MediLinx 특화 데이터 매핑
        if "patient" in data:
            patient = data["patient"]
            processed["patient_info"] = {
                "name": patient.get("name", "고객"),
                "birth_date": patient.get("birth_date"),
                "gender": patient.get("sex"),
                "contact": patient.get("phone")
            }
            # 파트너가 전달한 병원명/전화번호 (페르소나 치환에 우선 사용)
            if patient.get("hospital_name"):
                processed["partner_hospital_name"] = patient["hospital_name"]
            if patient.get("hospital_tel"):
                processed["partner_hospital_tel"] = patient["hospital_tel"]
        
        if "checkup_results" in data:
            raw_results = data["checkup_results"]
            # API가 list로 보낼 수 있음: [ { ... } ] → 첫 번째 레코드 사용
            results = raw_results[0] if isinstance(raw_results, list) and raw_results else raw_results
            if not isinstance(results, dict):
                results = {}
            # 기존 수치 필드 + 규격 추가 분(판정/정상범위) 반영
            base_metrics = {
                "height": results.get("height"),
                "weight": results.get("weight"),
                "bmi": results.get("bmi"),
                "systolic_bp": results.get("systolic_bp"),
                "diastolic_bp": results.get("diastolic_bp"),
                "fasting_glucose": results.get("fasting_glucose"),
                "total_cholesterol": results.get("total_cholesterol"),
                "hdl_cholesterol": results.get("hdl_cholesterol"),
                "ldl_cholesterol": results.get("ldl_cholesterol"),
                "triglycerides": results.get("triglycerides"),
                "creatinine": results.get("creatinine"),
                "gfr": results.get("gfr"),
                "sgot_ast": results.get("sgot_ast"),
                "sgpt_alt": results.get("sgpt_alt"),
                "gamma_gtp": results.get("gamma_gtp"),
                "hemoglobin": results.get("hemoglobin"),
                "checkup_date": results.get("exam_date"),
            }
            # *_abnormal, *_range 등 선택 필드 통과 (RAG 컨텍스트용)
            for key, value in results.items():
                if value is None or key in base_metrics:
                    continue
                if key.endswith("_abnormal") or key.endswith("_range"):
                    base_metrics[key] = value
            processed["health_metrics"] = {k: v for k, v in base_metrics.items() if v is not None}
        
        if "medical_history" in data:
            processed["medical_history"] = data["medical_history"]
        
        logger.info(f"✅ [파트너 RAG] MediLinx 데이터 처리 완료")
        return processed
    
    async def _process_standard_health_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """표준 형식 검진 데이터 처리"""
        
        processed = {
            "has_data": True,
            "source": "standard",
            "processed_at": datetime.now().isoformat(),
            "raw_data": data
        }
        
        # 표준 필드 누락 경고
        if "patient_info" not in data:
            logger.warning("⚠️ [파트너 RAG] standard: patient_info 필드 누락")
        if "health_metrics" not in data:
            logger.warning("⚠️ [파트너 RAG] standard: health_metrics 필드 누락")

        # 표준 필드 매핑 시도
        if "patient_info" in data:
            processed["patient_info"] = data["patient_info"]
            # 파트너가 전달한 병원명/전화번호 (patient 또는 최상위 레벨)
            patient = data.get("patient") or data.get("patient_info") or {}
            if isinstance(patient, dict):
                if patient.get("hospital_name"):
                    processed["partner_hospital_name"] = patient["hospital_name"]
                if patient.get("hospital_tel"):
                    processed["partner_hospital_tel"] = patient["hospital_tel"]

        # 최상위 레벨에서도 병원 정보 확인
        if data.get("hospital_name") and not processed.get("partner_hospital_name"):
            processed["partner_hospital_name"] = data["hospital_name"]
        if data.get("hospital_tel") and not processed.get("partner_hospital_tel"):
            processed["partner_hospital_tel"] = data["hospital_tel"]

        if "health_metrics" in data:
            processed["health_metrics"] = data["health_metrics"]
        
        logger.info(f"✅ [파트너 RAG] 표준 데이터 처리 완료")
        return processed
    
    async def _store_partner_session_metadata(
        self,
        session_id: str,
        partner_info: PartnerAuthInfo,
        processed_data: Dict[str, Any]
    ) -> None:
        """파트너 세션 메타데이터 저장"""
        
        if not self.redis_client:
            return
        
        try:
            metadata = {
                "partner_id": partner_info.partner_id,
                "partner_name": partner_info.partner_name,
                "has_partner_data": processed_data.get("has_data", False),
                "data_source": processed_data.get("source", "unknown"),
                "session_created_at": datetime.now().isoformat(),
                "processed_data_summary": {
                    "has_patient_info": "patient_info" in processed_data,
                    "has_health_metrics": "health_metrics" in processed_data,
                    "data_fields": list(processed_data.keys())
                }
            }
            
            # 암호화된 Redis 키로 파트너 세션 메타데이터 저장 (24시간 TTL)
            partner_meta_key = get_encrypted_redis_key(
                session_id=session_id,
                key_type="metadata", 
                partner_id=partner_info.partner_id
            )
            self.redis_client.setex(
                partner_meta_key,
                86400,  # 24시간
                json.dumps(metadata, ensure_ascii=False)
            )
            
            # 키 매핑 저장 (복호화용 - 짧은 TTL)
            mapping_key = f"welno:partner_rag:mapping:{session_id}:metadata"
            self.redis_client.setex(mapping_key, 86400, partner_meta_key)
            
            # 파트너 데이터 저장 (필요시 나중에 참조)
            if processed_data.get("has_data"):
                partner_data_key = get_encrypted_redis_key(
                    session_id=session_id,
                    key_type="data",
                    partner_id=partner_info.partner_id
                )
                self.redis_client.setex(
                    partner_data_key,
                    86400,  # 24시간
                    json.dumps(processed_data, ensure_ascii=False)
                )
                
                # 데이터 키 매핑 저장
                data_mapping_key = f"welno:partner_rag:mapping:{session_id}:data"
                self.redis_client.setex(data_mapping_key, 86400, partner_data_key)
            
            logger.info(f"✅ [파트너 RAG] 세션 메타데이터 저장 완료 - {session_id}")
            
        except Exception as e:
            logger.warning(f"⚠️ [파트너 RAG] 메타데이터 저장 실패: {e}")
    
    async def _generate_partner_response_stream(
        self,
        partner_info: PartnerAuthInfo,
        uuid: str,
        hospital_id: str,
        message: str,
        session_id: str,
        partner_data: Dict[str, Any],
        trace_data: Optional[Dict[str, Any]] = None # 추적 데이터 추가
    ) -> AsyncGenerator[str, None]:
        """파트너 데이터를 통합한 응답 스트리밍 생성"""
        
        try:
            # 1. 파트너 데이터를 컨텍스트에 통합
            ctx_start = time.time()
            enhanced_context = await self._build_partner_context(
                partner_info, partner_data, message
            )
            if trace_data:
                trace_data["timings"]["build_context_ms"] = (time.time() - ctx_start) * 1000
                trace_data["enhanced_context"] = enhanced_context
            
            # 2. 기존 RAG 서비스의 스트리밍 로직 활용
            # 단, 파트너 데이터가 있는 경우 briefing_context를 대체
            original_method = self.handle_user_message_stream
            
            # 파트너 컨텍스트를 임시로 주입
            if partner_data.get("has_data"):
                inject_start = time.time()
                await self._inject_partner_context_to_session(
                    uuid, hospital_id, session_id, enhanced_context
                )
                if trace_data:
                    trace_data["timings"]["inject_context_ms"] = (time.time() - inject_start) * 1000
            
            # 기존 스트리밍 로직 실행
            async for chunk in original_method(
                uuid=uuid,
                hospital_id=hospital_id, 
                message=message,
                session_id=session_id,
                trace_data=trace_data # 추적 데이터 전달
            ):
                # 파트너 정보를 응답에 추가
                if chunk.startswith("data: {") and "done" in chunk:
                    try:
                        # JSON 파싱하여 파트너 정보 추가
                        chunk_data = chunk[6:]  # "data: " 제거
                        if chunk_data.strip():
                            response_obj = json.loads(chunk_data)
                            response_obj["partner_id"] = partner_info.partner_id
                            response_obj["has_partner_data"] = partner_data.get("has_data", False)
                            chunk = f"data: {json.dumps(response_obj, ensure_ascii=False)}\n\n"
                    except:
                        pass  # JSON 파싱 실패시 원본 유지
                
                yield chunk
                
        except Exception as e:
            logger.error(f"❌ [파트너 RAG] 응답 스트리밍 실패: {e}")
            error_response = {
                "error": "응답 생성 중 오류가 발생했습니다.",
                "partner_id": partner_info.partner_id,
                "done": True
            }
            yield f"data: {json.dumps(error_response, ensure_ascii=False)}\n\n"
    
    async def _build_partner_context(
        self,
        partner_info: PartnerAuthInfo,
        partner_data: Dict[str, Any],
        message: str
    ) -> str:
        """파트너 데이터를 기반으로 컨텍스트 구성"""
        
        if not partner_data.get("has_data"):
            return f"파트너사({partner_info.partner_name})에서 제공된 검진 데이터가 없습니다."
        
        context_parts = []
        context_parts.append(f"=== {partner_info.partner_name} 제공 검진 데이터 ===")

        # 검진 병원 정보 (클라이언트 전달)
        _hosp_name = partner_data.get("partner_hospital_name", "")
        _hosp_tel = partner_data.get("partner_hospital_tel", "")
        if _hosp_name or _hosp_tel:
            context_parts.append("🏥 검진 병원:")
            if _hosp_name:
                context_parts.append(f"  - 병원명: {_hosp_name}")
            if _hosp_tel:
                context_parts.append(f"  - 연락처: {_hosp_tel}")

        # 환자 정보
        if "patient_info" in partner_data:
            patient_info = partner_data["patient_info"]
            context_parts.append("📋 환자 정보:")
            for key, value in patient_info.items():
                if value:
                    context_parts.append(f"  - {key}: {value}")
        
        # 건강 지표
        if "health_metrics" in partner_data:
            health_metrics = partner_data["health_metrics"]
            # 검진 데이터 부재 감지: 수치 필드가 전부 0이거나 비어있는지 체크
            numeric_fields = ["height", "weight", "bmi", "systolic_bp", "diastolic_bp",
                            "fasting_glucose", "total_cholesterol", "hemoglobin", "sgot_ast", "sgpt_alt"]
            has_meaningful_data = any(
                health_metrics.get(f) and health_metrics.get(f) not in (0, "0", "", None)
                for f in numeric_fields
            )
            if not has_meaningful_data:
                context_parts.append("⚠️ 이 환자의 검진 데이터가 수신되지 않았습니다. "
                                   "일반론 대신 '검진 결과를 모두 불러오지 못했어요. 결과지를 검진기관에 요청해 보시면 좋겠어요 😊' 형태로 응답하세요.")
            else:
                context_parts.append("📊 건강 지표:")
                for key, value in health_metrics.items():
                    if value:
                        context_parts.append(f"  - {key}: {value}")
        else:
            context_parts.append("⚠️ 이 환자의 검진 데이터가 수신되지 않았습니다. "
                               "일반론 대신 '검진 결과를 모두 불러오지 못했어요. 결과지를 검진기관에 요청해 보시면 좋겠어요 😊' 형태로 응답하세요.")
        
        # 의료 이력
        if "medical_history" in partner_data:
            medical_history = partner_data["medical_history"]
            if medical_history:
                context_parts.append("🏥 의료 이력:")
                for history in medical_history[:5]:  # 최대 5개만
                    context_parts.append(f"  - {history}")
        
        context_parts.append("=" * 50)
        
        return "\n".join(context_parts)
    
    async def _inject_partner_context_to_session(
        self,
        uuid: str,
        hospital_id: str,
        session_id: str,
        context: str
    ) -> None:
        """파트너 컨텍스트를 세션에 임시 주입"""
        
        if not self.redis_client:
            return
        
        try:
            # 암호화된 키로 임시 컨텍스트 저장 (1시간 TTL)
            context_key = get_encrypted_redis_key(
                session_id=session_id,
                key_type="context",
                partner_id=uuid  # partner_id가 없으므로 uuid 사용
            )
            self.redis_client.setex(context_key, 3600, context)
            
            # 컨텍스트 키 매핑 저장
            context_mapping_key = f"welno:partner_rag:mapping:{session_id}:context"
            self.redis_client.setex(context_mapping_key, 3600, context_key)
            
            logger.info(f"✅ [파트너 RAG] 컨텍스트 주입 완료 - {len(context)}자")
            
        except Exception as e:
            logger.warning(f"⚠️ [파트너 RAG] 컨텍스트 주입 실패: {e}")
    
    def get_partner_session_metadata(self, session_id: str) -> Optional[Dict[str, Any]]:
        """파트너 세션 메타데이터 조회 (암호화된 키 사용)"""
        
        if not self.redis_client:
            return None
        
        try:
            # 키 매핑을 통해 암호화된 키 조회
            mapping_key = f"welno:partner_rag:mapping:{session_id}:metadata"
            partner_meta_key = self.redis_client.get(mapping_key)
            
            if not partner_meta_key:
                logger.debug(f"[파트너 RAG] 메타데이터 키 매핑 없음: {session_id}")
                return None
            
            # 암호화된 키로 실제 데이터 조회
            metadata_json = self.redis_client.get(partner_meta_key)
            
            if metadata_json:
                return json.loads(metadata_json)
            
        except Exception as e:
            logger.warning(f"⚠️ [파트너 RAG] 메타데이터 조회 실패: {e}")
        
        return None

    async def handle_partner_warmup(
        self,
        partner_info: PartnerAuthInfo,
        uuid: str,
        hospital_id: str,
        session_id: str,
        partner_health_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        세션 웜업: 데이터 전처리, Redis 저장, 개인화 인사말 생성
        """
        logger.info(f"🔥 [파트너 RAG] 웜업 시작 - {partner_info.partner_id}, uuid: {uuid}")
        
        try:
            # 1. 데이터 전처리
            processed_data = await self._process_partner_health_data(partner_info, partner_health_data)
            
            # 2. 세션 메타데이터 및 파트너 데이터 Redis 저장 (상담 시 즉시 사용 가능하도록)
            await self._store_partner_session_metadata(session_id, partner_info, processed_data)
            
            # 3. 후킹 인사말 + 데이터사이언스 인사말 병렬 생성 (Gemini)
            hook_greeting, data_science_greeting = await asyncio.gather(
                self._generate_hook_greeting(partner_info, processed_data),
                self._generate_data_science_greeting(partner_info, processed_data),
            )

            # 4. 백그라운드 태스크: Gemini Context Caching 미리 수행 (의학 지식 로딩)
            asyncio.create_task(self._preload_rag_context_background(partner_info, uuid, hospital_id, session_id, processed_data))

            return {
                "greeting": hook_greeting,
                "chat_greeting": data_science_greeting,
                "hook_greeting": hook_greeting,
                "data_science_greeting": data_science_greeting,
                "has_data": processed_data.get("has_data", False)
            }
            
        except Exception as e:
            logger.error(f"❌ [파트너 RAG] 웜업 처리 실패: {e}")
            return {"greeting": "안녕하세요! 건강 검진 결과에 대해 궁금한 점을 물어보세요.", "has_data": False}

    async def _generate_hook_greeting(
        self, 
        partner_info: PartnerAuthInfo, 
        processed_data: Dict[str, Any]
    ) -> str:
        """개인화된 인사말 생성 (1문장)"""
        
        if not processed_data.get("has_data"):
            return f"안녕하세요! 😊 건강검진 결과에 대해 궁금한 점을 물어보세요."
            
        patient_info = processed_data.get("patient_info", {})
        name = patient_info.get("name", "고객")
        
        # 주요 건강 지표 기반 키워드 추출 (우선순위 순)
        metrics = processed_data.get("health_metrics", {})
        bmi = metrics.get("bmi")
        sbp = metrics.get("systolic_bp")
        dbp = metrics.get("diastolic_bp")
        fasting_glucose = metrics.get("fasting_glucose")
        total_cholesterol = metrics.get("total_cholesterol")
        ldl = metrics.get("ldl_cholesterol")
        gfr = metrics.get("gfr")
        ast = metrics.get("ast")
        alt = metrics.get("alt")

        concern_keyword = "검진 결과"
        risk_tone = "friendly"  # friendly / curious / urgent

        if sbp and sbp >= 140:
            concern_keyword = "혈압"
            risk_tone = "urgent" if sbp >= 160 else "curious"
        elif fasting_glucose and fasting_glucose >= 126:
            concern_keyword = "혈당"
            risk_tone = "urgent"
        elif fasting_glucose and fasting_glucose >= 100:
            concern_keyword = "혈당"
            risk_tone = "curious"
        elif total_cholesterol and total_cholesterol >= 240:
            concern_keyword = "콜레스테롤"
            risk_tone = "curious"
        elif ldl and ldl >= 160:
            concern_keyword = "LDL 콜레스테롤"
            risk_tone = "curious"
        elif (ast and ast >= 40) or (alt and alt >= 40):
            concern_keyword = "간 수치"
            risk_tone = "curious"
        elif bmi and bmi >= 30:
            concern_keyword = "체중 관리"
            risk_tone = "curious"
        elif bmi and bmi >= 25:
            concern_keyword = "체중 관리"
            risk_tone = "friendly"
        elif gfr and gfr < 60:
            concern_keyword = "신장 기능"
            risk_tone = "urgent"

        # 병원명 추출
        hospital_name = processed_data.get("partner_hospital_name", "") or partner_info.partner_name or ""

        # 톤별 프롬프트 가이드
        tone_guide = {
            "friendly": "가볍고 친근한 톤. 호기심을 자극하되 부담 없이.",
            "curious": "살짝 의미심장한 톤. '한번 확인해 보시면 좋을 것 같아요' 느낌.",
            "urgent": "관심을 끄는 톤이되 공포 유발 금지. '꼭 한번 살펴보세요' 느낌.",
        }.get(risk_tone, "가볍고 친근한 톤.")

        # Gemini에게 호기심을 유발하는 후킹 인사말 생성 요청
        from .gemini_service import gemini_service, GeminiRequest
        prompt = f"""
        당신은 '{hospital_name}'에서 검진 결과지를 읽어 드리는 에이전트입니다.
        환자 {name}님의 {concern_keyword} 데이터를 분석했습니다.

        사용자가 "어? 뭔데?" 하고 궁금해서 반드시 클릭하게 만드는 후킹 메시지 1문장을 작성하세요.
        이 메시지는 채팅 아이콘 위 작은 말풍선에 표시됩니다.

        톤 가이드: {tone_guide}

        규칙:
        - 반드시 '{hospital_name}'을 포함하세요.
        - 호기심과 궁금증을 유발하되 공포 유발 금지.
        - 의학적 진단·조언·경고 절대 금지. 의료인 느낌 표현 금지 ('상담사', '전문가', 'Dr.' 등).
        - 가볍고 친근한 말투, 반말X 존댓말O.
        - 이모지 1개 사용.
        - 25자~45자 이내로 짧게.

        좋은 예시:
        - "{name}님, {hospital_name} 검진 결과에서 눈에 띄는 부분이 있어요 👀"
        - "{name}님! {hospital_name} 결과 읽어봤는데, 한번 보실래요? 😊"
        - "{hospital_name} 검진 결과 정리됐어요, {name}님 확인해 보세요 ✨"
        """
        
        try:
            # 빠른 응답을 위해 call_api 사용
            res = await gemini_service.call_api(
                GeminiRequest(prompt=prompt, model="gemini-3-flash-preview", temperature=0.7),
                save_log=False
            )
            if res.success:
                # 말풍선에서 과도한 줄바꿈 방지: 줄바꿈을 공백으로 정규화
                raw = res.content.strip().replace('"', '')
                return ' '.join(raw.split())
        except: pass
        
        return f"{name}님, {hospital_name} {concern_keyword} 결과에서 눈에 띄는 부분이 있어요 👀"

    @staticmethod
    def _classify_data_type(processed_data: Dict[str, Any]) -> str:
        """데이터 유형 분류: with_trends / single_visit / no_abnormal"""
        metrics = processed_data.get("health_metrics", {})
        trends = processed_data.get("trend_data") or processed_data.get("historical_data")
        abnormal_items = [
            k for k, v in metrics.items()
            if k.endswith("_abnormal") and v
        ]
        if trends and len(trends) > 0:
            return "with_trends"
        elif abnormal_items or any([
            (metrics.get("systolic_bp") or 0) >= 140,
            (metrics.get("fasting_glucose") or 0) >= 100,
            (metrics.get("total_cholesterol") or 0) >= 240,
            (metrics.get("ldl_cholesterol") or 0) >= 160,
            (metrics.get("ast") or 0) >= 40,
            (metrics.get("alt") or 0) >= 40,
            (metrics.get("bmi") or 0) >= 25,
        ]):
            return "single_visit"
        else:
            return "no_abnormal"

    async def _generate_data_science_greeting(
        self,
        partner_info: PartnerAuthInfo,
        processed_data: Dict[str, Any],
    ) -> str:
        """데이터사이언스 관점 인사이트 메시지 (2-3문장, LLM)"""
        if not processed_data.get("has_data"):
            return "안녕하세요! 😊 건강검진 결과에 대해 궁금한 점을 물어보세요."

        patient_info = processed_data.get("patient_info", {})
        name = patient_info.get("name", "고객")
        metrics = processed_data.get("health_metrics", {})
        hospital = processed_data.get("partner_hospital_name", "") or partner_info.partner_name or ""
        data_type = self._classify_data_type(processed_data)

        # 주요 수치 요약
        metric_lines = []
        for label, key, unit in [
            ("수축기혈압", "systolic_bp", "mmHg"), ("이완기혈압", "diastolic_bp", "mmHg"),
            ("공복혈당", "fasting_glucose", "mg/dL"), ("총콜레스테롤", "total_cholesterol", "mg/dL"),
            ("LDL", "ldl_cholesterol", "mg/dL"), ("HDL", "hdl_cholesterol", "mg/dL"),
            ("AST", "ast", "U/L"), ("ALT", "alt", "U/L"),
            ("BMI", "bmi", ""), ("GFR", "gfr", "mL/min"),
        ]:
            v = metrics.get(key)
            if v is not None:
                metric_lines.append(f"- {label}: {v}{unit}")
        metrics_summary = "\n".join(metric_lines) if metric_lines else "수치 없음"

        # 이상 항목 개수 파악 (구체적 수치는 숨기고 "몇 가지"만 힌트)
        abnormal_count = sum(1 for k, v in metrics.items() if k.endswith("_abnormal") and v)
        elevated_count = sum(1 for check in [
            (metrics.get("systolic_bp") or 0) >= 140,
            (metrics.get("fasting_glucose") or 0) >= 100,
            (metrics.get("total_cholesterol") or 0) >= 240,
            (metrics.get("ldl_cholesterol") or 0) >= 160,
            (metrics.get("ast") or 0) >= 40 or (metrics.get("alt") or 0) >= 40,
            (metrics.get("bmi") or 0) >= 25,
            (metrics.get("gfr") or 0) > 0 and (metrics.get("gfr") or 999) < 60,
        ] if check)
        attention_count = max(abnormal_count, elevated_count, 1)

        style_guide = {
            "with_trends": (
                "추이 데이터가 있습니다. '지난 검진과 비교해서 변화가 있는 항목이 있다'고만 암시하세요. "
                "어떤 항목이 어떻게 변했는지는 말하지 마세요 — 사용자가 물어보게 만드세요."
            ),
            "single_visit": (
                f"검진 결과에서 {attention_count}가지 정도 눈여겨볼 항목이 있습니다. "
                "어떤 항목인지, 수치가 얼마인지 절대 말하지 마세요. "
                "'확인해 볼 부분이 있다'고만 하고, 어떤 것부터 볼지 사용자에게 선택권을 주세요."
            ),
            "no_abnormal": (
                "이상 항목이 없습니다. 결과가 전반적으로 양호하다고 짧게 언급하고, "
                "'혹시 평소 궁금했던 건강 항목이 있나요?' 같은 열린 질문으로 대화를 유도하세요."
            ),
        }

        from .gemini_service import gemini_service, GeminiRequest
        prompt = f"""당신은 '{hospital}' 검진 결과를 읽어 드리는 건강 도우미입니다.
{name}님의 검진 수치 (내부 참고용, 사용자에게 직접 노출 금지):
{metrics_summary}

대화 유도 전략: {style_guide.get(data_type, style_guide["single_visit"])}

핵심 원칙 — "정보를 주지 말고, 궁금증을 만들어라":
- 수치, 항목명, 진단명을 직접 말하지 마세요.
- "눈여겨볼 부분이 있어요", "같이 살펴볼까요?" 처럼 궁금증만 만드세요.
- 마지막은 반드시 사용자가 대답하게 되는 질문으로 끝내세요.
- 2문장 이내. 이모지 1개. 존댓말.

좋은 예시:
- "{name}님, 검진 결과 살펴봤는데 같이 확인해 보면 좋을 부분이 있어요. 어떤 항목부터 볼까요? 📋"
- "전체적으로 괜찮은데, 한두 가지 눈에 띄는 게 있어요. 궁금하시면 물어봐 주세요 😊"
- "검진 수치 중에 추이가 좀 달라진 게 있는데, 같이 확인해 볼까요? 📊"

나쁜 예시 (절대 하지 말 것):
- "혈압이 142mmHg로 높게 나왔어요" ← 수치 노출
- "공복혈당이 기준치를 넘었습니다" ← 항목+판정 노출
- "콜레스테롤 관리가 필요합니다" ← 결론 노출
"""
        try:
            res = await gemini_service.call_api(
                GeminiRequest(prompt=prompt, model="gemini-3-flash-preview", temperature=0.7),
                save_log=False,
            )
            if res.success:
                raw = res.content.strip().replace('"', '')
                return ' '.join(raw.split())
        except Exception:
            pass

        # 폴백: 대화 유도형
        hp = f"{hospital} " if hospital else ""
        if data_type == "no_abnormal":
            return f"{name}님, {hp}검진 결과 살펴봤어요! 전반적으로 양호한데, 평소 궁금했던 건강 항목이 있으신가요? 😊"
        return f"{name}님, {hp}검진 결과에서 같이 확인해 보면 좋을 부분이 있어요. 어떤 항목부터 볼까요? 📋"

    async def _preload_rag_context_background(
        self, 
        partner_info: PartnerAuthInfo,
        uuid: str, 
        hospital_id: str, 
        session_id: str,
        partner_data: Dict[str, Any]
    ) -> None:
        """백그라운드에서 무거운 컨텍스트를 Gemini 캐시에 로딩"""
        try:
            logger.info(f"⏳ [Cache] 백그라운드 컨텍스트 로딩 시작...")
            
            # 1. 파트너 컨텍스트 빌드
            partner_ctx = await self._build_partner_context(partner_info, partner_data, "")

            
            # 2. RAG 검색 (미리 전체적인 주제로 검색하여 컨텍스트 확보)
            from .checkup_design.rag_service import init_rag_engine
            query_engine = await init_rag_engine(use_local_vector_db=True)
            if query_engine:
                # '건강검진 종합 안내' 성격의 쿼리로 미리 의학 문서 로드
                nodes = await query_engine.aretrieve("고혈압 당뇨 비만 간기능 검진 항목 가이드")
                medical_ctx = "\n".join([n.get("text", "") for n in nodes])
                
                # 3. Gemini Context Caching 수행
                from .gemini_service import gemini_service
                system_instruction = f"너는 검진 결과지를 읽어 드리는 에이전트야. 아래 [Context]를 완벽히 숙지해.\n[Context]\n{partner_ctx}\n{medical_ctx}"
                
                await gemini_service._get_or_create_cache(
                    system_prompt=system_instruction,
                    model_name="gemini-3-flash-preview",
                    cache_key=session_id
                )
                logger.info(f"✅ [Cache] 백그라운드 캐시 준비 완료 - session: {session_id[:8]}")
        except Exception as e:
            logger.warning(f"⚠️ [Cache] 백그라운드 캐시 생성 실패: {e}")
