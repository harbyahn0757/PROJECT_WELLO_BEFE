"""
파트너 RAG 채팅 서비스

파트너사에서 제공하는 검진 데이터와 웰노 RAG 지식베이스를 통합하여
개인화된 건강 상담을 제공합니다.
"""

import logging
import json
import asyncio
import time
import random
from typing import Dict, Any, Optional, List, AsyncGenerator
from datetime import datetime

from .welno_rag_chat_service import WelnoRagChatService
from ..middleware.partner_auth import PartnerAuthInfo
from ..utils.security_utils import get_encrypted_redis_key, log_partner_access
from ..core.config import settings

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
            with open(f"/home/welno/workspace/PROJECT_WELNO_BEFE/planning-platform/backend/logs/trace_{uuid}_{int(time.time())}.json", "w", encoding="utf-8") as f:
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
                METRIC_LABELS = {
                    "height": "키", "weight": "체중", "bmi": "BMI",
                    "systolic_bp": "수축기 혈압", "diastolic_bp": "이완기 혈압",
                    "fasting_glucose": "공복혈당", "hemoglobin": "헤모글로빈",
                    "total_cholesterol": "총콜레스테롤", "hdl_cholesterol": "HDL",
                    "ldl_cholesterol": "LDL", "triglycerides": "중성지방",
                    "sgot_ast": "AST(SGOT)", "sgpt_alt": "ALT(SGPT)",
                    "gamma_gtp": "감마GTP", "creatinine": "크레아티닌", "gfr": "GFR",
                }
                METRIC_UNITS = {
                    "systolic_bp": "mmHg", "diastolic_bp": "mmHg",
                    "fasting_glucose": "mg/dL", "hemoglobin": "g/dL",
                    "total_cholesterol": "mg/dL", "hdl_cholesterol": "mg/dL",
                    "ldl_cholesterol": "mg/dL", "triglycerides": "mg/dL",
                    "sgot_ast": "U/L", "sgpt_alt": "U/L", "gamma_gtp": "U/L",
                    "creatinine": "mg/dL", "gfr": "mL/min",
                    "height": "cm", "weight": "kg",
                }
                abnormal_lines = []
                normal_lines = []
                for key, value in health_metrics.items():
                    if not value or key.endswith("_abnormal") or key.endswith("_range") or key in ("exam_date", "checkup_date"):
                        continue
                    label = METRIC_LABELS.get(key, key)
                    unit = METRIC_UNITS.get(key, "")
                    ab_val = health_metrics.get(f"{key}_abnormal", "")
                    if ab_val and ab_val != "정상":
                        abnormal_lines.append(f"  ⚠️ {label}: {value}{unit} ({ab_val})")
                    else:
                        normal_lines.append(f"  ✅ {label}: {value}{unit}")
                if abnormal_lines:
                    context_parts.append("📊 주의 필요 항목:")
                    context_parts.extend(abnormal_lines)
                if normal_lines:
                    context_parts.append(f"✅ 정상 항목: {len(normal_lines)}개")
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
            # 0. Redis 캐시 체크 — 같은 uuid+hospital이면 Gemini 스킵
            cache_key = f"warmup:{uuid}:{hospital_id}"
            if self.redis_client:
                try:
                    import json as _json
                    cached = await asyncio.get_event_loop().run_in_executor(
                        None, self.redis_client.get, cache_key
                    )
                    if cached:
                        logger.info(f"✅ [웜업] 캐시 히트 — Gemini 스킵 ({cache_key})")
                        return _json.loads(cached)
                except Exception:
                    pass

            # 1. 데이터 전처리
            processed_data = await self._process_partner_health_data(partner_info, partner_health_data)

            # 2. 세션 메타데이터 및 파트너 데이터 Redis 저장
            await self._store_partner_session_metadata(session_id, partner_info, processed_data)

            # 3. 데이터 유형 분류 (정상인/이상소견/추이)
            data_type = self._classify_data_type(processed_data)

            # 4. 재접속 감지: 같은 uuid+hospital의 이전 대화가 있는지 확인
            is_returning = False
            previous_message_count = 0
            previous_topics = []
            if self.chat_manager and self.chat_manager.redis_client:
                try:
                    history_key = f"welno:chat:history:{partner_info.partner_id}:{uuid}:{hospital_id}"
                    history_len = self.chat_manager.redis_client.llen(history_key)
                    if history_len > 0:
                        is_returning = True
                        previous_message_count = history_len
                        # 마지막 대화에서 주제 추출 (최근 2개)
                        recent = self.chat_manager.redis_client.lrange(history_key, -2, -1)
                        for item in recent:
                            try:
                                msg = json.loads(item)
                                if msg.get('role') == 'user':
                                    previous_topics.append(msg.get('content', '')[:30])
                            except Exception:
                                pass
                except Exception:
                    pass

            # 5. 후킹 인사말 + 채팅 인사말 통합 생성 (맥락 연결)
            # 재접속: 재방문 인사말 우선 / 정상인: 쌍 템플릿에서 즉시 반환, 이상소견: 단일 모델 호출로 동시 생성
            hook_greeting, data_science_greeting = await self._generate_greetings(
                partner_info, processed_data, is_returning=is_returning, previous_topics=previous_topics
            )
            abnormal_items = self._scan_all_abnormals(processed_data.get("health_metrics", {}))

            # 6. 수치 데이터 유무 판별 (0건 감지)
            metrics = processed_data.get("health_metrics", {})
            numeric_fields = ["height", "weight", "bmi", "systolic_bp", "diastolic_bp",
                              "fasting_glucose", "total_cholesterol", "hemoglobin", "sgot_ast", "sgpt_alt"]
            has_meaningful_data = any(
                metrics.get(f) and metrics.get(f) not in (0, "0", "", None)
                for f in numeric_fields
            )

            # 7. 인사말 + 메타정보를 Redis에 저장 (대화 로그 첫 행에 포함시키기 위해)
            if self.redis_client:
                greeting_data = {
                    "hook_greeting": hook_greeting,
                    "data_science_greeting": data_science_greeting,
                    "data_type": data_type,
                    "has_meaningful_data": has_meaningful_data,
                    "model": "template" if len(abnormal_items) == 0 else settings.google_gemini_fast_model,
                    "timestamp": datetime.now().isoformat(),
                }
                greeting_key = f"welno:partner_rag:mapping:{session_id}:greetings"
                self.redis_client.setex(greeting_key, 86400, json.dumps(greeting_data, ensure_ascii=False))

            logger.info(
                f"✅ [파트너 RAG] 웜업 완료 - data_type={data_type}, "
                f"hook={hook_greeting[:40]}..., greeting={data_science_greeting[:40]}..."
            )

            # 8. 백그라운드 프리페치 비활성화
            # NOTE: _preload_rag_context_background의 system_instruction이 실제 채팅의
            # system_instruction(상세 규칙+환자데이터)과 다른데 같은 session_id cache_key를 사용하여
            # 프리페치 성공 시 채팅이 간략한 프롬프트로 동작하는 버그가 있음. Phase 3에서 재설계 예정.
            # asyncio.create_task(self._preload_rag_context_background(...))

            result = {
                "greeting": hook_greeting,
                "chat_greeting": data_science_greeting,
                "hook_greeting": hook_greeting,
                "data_science_greeting": data_science_greeting,
                "data_type": data_type,
                "has_data": processed_data.get("has_data", False),
                "session_id": session_id,
                "is_returning": is_returning,
                "previous_message_count": previous_message_count,
            }

            # 9. Redis에 warmup 결과 캐시 (1시간, 같은 환자 재호출 시 Gemini 스킵)
            if self.redis_client:
                try:
                    import json as _json
                    self.redis_client.setex(cache_key, 3600, _json.dumps(result, ensure_ascii=False))
                    logger.info(f"✅ [웜업] 캐시 저장 완료 ({cache_key}, TTL=1h)")
                except Exception:
                    pass

            return result
            
        except Exception as e:
            logger.error(f"❌ [파트너 RAG] 웜업 처리 실패: {e}")
            return {"greeting": "안녕하세요! 건강 검진 결과에 대해 궁금한 점을 물어보세요.", "has_data": False}

    # 후킹/인사말 톤 angle pool — 매 호출마다 random.choice (LLM 다양성 강제)
    # prompt에 구체 예시 문장 박으면 LLM이 베껴서 똑같은 출력 → angle 추상 가이드만
    HOOK_ANGLES = [
        "검진 결과가 정리됐다는 사실을 알리며 같이 보자고 권유. 담백한 초대 톤. 슬로건 X.",
        "구체적 검진 항목(혈압/혈당/콜레스테롤/간수치 등) 중 하나를 짧게 언급하면서 같이 보자고 권유. 진단 강요 X.",
        "병원 이름을 자연스럽게 녹여서 결과 도착을 알리는 차분한 안내 톤.",
        "환자가 평소 신경 썼을 만한 부분을 짚어주는 진중한 관심 표현. 부담스럽지 않게.",
        "이번 검진에서 함께 살펴볼 부분이 있다는 정보 전달. 짧고 담백, 슬로건/캠페인 어조 X.",
        "환자 이름을 부르며 결과를 안내해 드리겠다는 도우미 입장. 친근하지만 진중하게.",
        "결과 중 짚어드릴 게 있다는 짧고 담백한 안내. 호기심 살짝 자극, 광고 어조 X.",
        "환자의 걱정/궁금증을 먼저 묻는 공감 톤. 의문형으로 마무리(~있으세요?). {name}님 호칭 + 부드러운 권유. 친구가 안부 묻듯, 부담 없이.",
    ]

    GREETING_ANGLES = [
        "후킹의 자연스러운 연장 + 어디부터 볼지 묻는 차분한 초대 톤.",
        "구체 항목 1~2개를 짧게 언급 + 무엇이 궁금한지 묻는 도움 톤.",
        "결과 정리됐다는 사실 + 가볍지 않게 시작하자는 자연 톤.",
        "환자 감정/걱정을 먼저 살피며 마음 열게 하는 공감 톤. 의문형 권유.",
    ]

    @staticmethod
    def _is_safe_greeting(text: str) -> bool:
        """후킹/인사말이 금지 표현 포함하는지 검증 (사용자 노출 전 가드)"""
        if not text or len(text) < 10:
            return False
        forbidden = [
            "확인할 항목", "N가지", "가지 있어요",  # 사무 베끼기
            "위험", "이상소견", "주의", "경고", "심각", "긴급", "즉시 병원",  # 공포
            "프리미엄", "전문가", "맞춤", "특별히", "VIP", "엄선",  # 장사
            "차 한잔", "한잔", "신기", "재미", "흥미", "어머", "와우",  # 작위
            # 모호 슬로건/캠페인 표현 (LLM이 자주 만드는 어색한 표현)
            "건강한 변화", "변화에 대해", "체크인", "첫걸음", "도약",
            "새로운 시작", "캠페인", "프로젝트", "솔루션", "하이라이트",
            # 광고/긴장감 유발 표현
            "중요한 결과", "주목할", "주목해", "특별 안내", "놓치면", "필독",
        ]
        return not any(f in text for f in forbidden)

    # 정상인용 (hook, chat_greeting) 쌍 템플릿 — 맥락 연결 보장
    NORMAL_GREETING_PAIRS = [
        (
            "{name}님, {hospital} 검진 결과 정리해 드렸어요! 😊",
            "{name}님, {hospital} 검진 결과 살펴봤어요! 전반적으로 양호한데, 평소 궁금했던 건강 항목이 있으신가요? 😊",
        ),
        (
            "{hospital} 검진 결과 도착했어요, {name}님 확인해 보세요 ✨",
            "{name}님, {hospital} 결과 전체적으로 좋아요! 혹시 관심 있는 건강 주제가 있으세요? 🏥",
        ),
        (
            "{name}님! {hospital} 결과 깔끔하게 정리됐어요 📋",
            "{hospital} 검진 결과가 깔끔하게 나왔어요, {name}님! 더 알고 싶은 항목이 있으면 물어보세요 ✨",
        ),
        (
            "{name}님, {hospital} 검진 결과 한눈에 볼 수 있게 준비했어요 🎯",
            "{name}님, 검진 결과 전체적으로 양호해요! 어떤 부분이 궁금하세요? 😊",
        ),
    ]

    async def _generate_greetings(
        self,
        partner_info: PartnerAuthInfo,
        processed_data: Dict[str, Any],
        is_returning: bool = False,
        previous_topics: Optional[List[str]] = None,
    ) -> tuple:
        """후킹 메시지 + 채팅 인사말을 한 번에 생성 (맥락 연결)
        Returns: (hook_greeting, chat_greeting)
        """
        if not processed_data.get("has_data"):
            fallback = "안녕하세요! 😊 건강검진 결과에 대해 궁금한 점을 물어보세요."
            return (fallback, fallback)

        patient_info = processed_data.get("patient_info", {})
        name = patient_info.get("name", "고객")
        hospital = processed_data.get("partner_hospital_name", "") or partner_info.partner_name or ""
        metrics = processed_data.get("health_metrics", {})
        abnormal_items = self._scan_all_abnormals(metrics)
        concern_count = len(abnormal_items)
        data_type = self._classify_data_type(processed_data)

        # 재접속: 정상인/이상소견 관계없이 재방문 인사말 우선
        if is_returning:
            topic_hint = previous_topics[0] if previous_topics else ""
            hook = f"{name}님, 다시 오셨네요! 😊"
            if topic_hint:
                greeting = f"{name}님, 반가워요! 이전에 말씀하신 내용 이어서 살펴볼까요? 궁금한 점이 있으시면 편하게 물어보세요 🩺"
            else:
                greeting = f"{name}님, 다시 찾아주셨네요! 이전 대화를 이어갈 수도 있고, 새로운 궁금한 점을 물어보셔도 좋아요 😊"
            return (hook, greeting)

        # 정상인: 쌍 템플릿에서 랜덤 선택 (모델 호출 없음)
        if concern_count == 0:
            pair = random.choice(self.NORMAL_GREETING_PAIRS)
            hook = pair[0].format(name=name, hospital=hospital)
            greeting = pair[1].format(name=name, hospital=hospital)
            return (hook, greeting)

        # 이상소견: 단일 모델 호출로 hook + greeting 동시 생성
        primary = abnormal_items[0]
        age = patient_info.get("age")
        age_group = f"{(age // 10) * 10}대" if age and isinstance(age, (int, float)) and age > 0 else ""
        concern_summary = ", ".join(item["keyword"] for item in abnormal_items[:3])

        # data_type에 따라 비교 지시 분기 (할루시네이션 방지)
        if data_type == "with_trends":
            context_hint = "지난 검진과 비교 가능합니다. 변화가 있다고만 암시하세요."
            hook_example_extra = f'\n- 비교: "지난 검진과 달라진 부분을 발견했어요 📊"'
            greeting_example_extra = f'\n- "지난 검진과 비교해서 달라진 부분이 있는데, 같이 확인해 볼까요? 📊"'
        else:
            context_hint = "이번 검진 결과 관점으로만 안내하세요. 지난 검진과 비교하는 표현 금지."
            hook_example_extra = ""
            greeting_example_extra = ""

        from .gemini_service import gemini_service, GeminiRequest
        from .llm_router import llm_router

        # 매 호출마다 random angle 주입 (zero-shot, 베낄 예시 없음)
        hook_angle = random.choice(self.HOOK_ANGLES)
        greeting_angle = random.choice(self.GREETING_ANGLES)

        prompt = f"""당신은 '{hospital}'의 건강 도우미입니다. {name}님 검진 결과를 안내합니다.

[검진 데이터 — 내부 참고용, 수치 직접 노출 금지]
- 확인 필요 항목: {concern_count}가지 ({concern_summary})
- 가장 주요: {primary["keyword"]}
{f"- 연령대: {age_group}" if age_group else ""}
- 맥락: {context_hint}

두 개의 메시지를 작성하세요:

**후킹 메시지** (티저 말풍선 — 사용자가 먼저 보는 짧은 한 줄):
- 35~60자, 이모지 1개 (📋 💬 💡 ✨ 중에서)
- {name}님 호칭을 자연스럽게
- ⚠️ 이번 응답에 사용할 톤 (반드시 이 방향만 사용):
  {hook_angle}

**채팅 인사말** (사용자가 후킹 클릭 후 채팅창에 나타나는 첫 메시지):
- 후킹의 자연스러운 **이어받기** — 대화 흐름이 끊기지 않게
- 2문장 이내, 이모지 1개 (📋 💬 💡 ✨ 중에서)
- 수치/진단명 직접 노출 금지
- ⚠️ 이번 응답에 사용할 톤 (반드시 이 방향만 사용):
  {greeting_angle}

**⚠️ 맥락 연결 원칙 (후킹 ↔ 인사말)**
후킹과 인사말은 **하나의 대화 흐름**입니다. 따로 놀면 안 됩니다.
- 후킹이 "~걱정되시나요?" 같은 의문형이면
  → 인사말은 그 걱정에 공감하며 같이 보자고 제안
  ("네, 이 부분 같이 살펴볼까요?" 같은 어조)
- 후킹이 "결과 정리됐어요" 같은 진술형이면
  → 인사말은 그 결과를 어떻게 볼지 권유/질문
  ("어디부터 보고 싶으세요?" 같은 어조)
- 후킹에서 언급한 주제/방향을 인사말이 **이어받아** 구체화
- 완전히 다른 주제로 뛰지 마세요 (예: 후킹 "걱정되시나요?" → 인사말 "콜레스테롤/체중..." ❌)
- 후킹에서 구체 항목을 언급했으면 인사말도 그 항목 흐름 유지

[필수]
- 의료 데이터를 다루는 친근한 도우미 어조 (가볍지 않게, 진중하게)
- 환자 입장 공감, 부담 X
- 매번 다르게, 같은 표현 절대 반복 금지

[금지 표현 — 사용 시 응답 즉시 무효 처리됨]
- 사무 베끼기: "확인할 항목이 N가지 있어요" / "N가지 있어요" / "결과에서 N가지" 같은 패턴 절대 금지
- 공포: 위험/이상소견/주의/경고/심각/긴급/즉시
- 장사: 프리미엄/맞춤/특별히/VIP/엄선/전문가
- 작위적 일상: 차/한잔/신기/재미/흥미/어머/와우

⚠️ JSON 응답 규칙:
- 키 이름은 반드시 영문 소문자 "hook"과 "greeting" 두 개만
- 마크다운/코드블록/주석/추가 텍스트 절대 금지
- 응답은 오직 다음 형식의 JSON 객체 하나:

{{"hook": "후킹 메시지 본문", "greeting": "채팅 인사말 본문"}}"""

        # LLM 호출 — 최대 2회 시도 (첫 응답이 금지 패턴 포함하면 1회 retry)
        for attempt in range(2):
            try:
                res = await llm_router.call_api(
                    GeminiRequest(
                        prompt=prompt,
                        model=settings.google_gemini_fast_model,
                        temperature=0.9,
                        response_format={"type": "json_object"},
                    ),
                    endpoint="rag_chat",
                    save_log=False,
                )
                logger.info("[greetings] attempt=%d success=%s err=%s len=%s angle_hook=%s",
                            attempt + 1,
                            res.success if res else None,
                            res.error if res else None,
                            len(res.content) if res and res.content else 0,
                            hook_angle[:30])
                if res and res.success and res.content:
                    raw = res.content.strip()
                    if raw.startswith("```"):
                        raw = raw.split("\n", 1)[-1] if "\n" in raw else raw[3:]
                        if raw.endswith("```"):
                            raw = raw[:-3]
                        raw = raw.strip()
                    try:
                        data = json.loads(raw)

                        def _pick(d: dict, *keys):
                            for k in keys:
                                v = d.get(k)
                                if v and isinstance(v, str) and v.strip():
                                    return v.strip()
                            return ""
                        hook = _pick(data, "hook", "HOOK", "Hook", "후킹", "후킹메시지", "teaser", "title").replace('"', '')
                        greeting = _pick(data, "greeting", "GREETING", "Greeting", "인사말", "채팅인사말", "message").replace('"', '')

                        # 검증: 금지 표현 포함 시 retry 또는 폴백
                        if hook and greeting:
                            if self._is_safe_greeting(hook) and self._is_safe_greeting(greeting):
                                logger.info("[greetings] OK attempt=%d hook=%s", attempt + 1, hook[:60])
                                return (hook, greeting)
                            logger.warning("[greetings] 금지 패턴 감지 attempt=%d hook=%s greeting=%s",
                                           attempt + 1, hook[:80], greeting[:80])
                            # retry 위해 다음 angle 재선택
                            hook_angle = random.choice(self.HOOK_ANGLES)
                            greeting_angle = random.choice(self.GREETING_ANGLES)
                            continue
                        logger.warning("[greetings] hook/greeting 누락 keys=%s",
                                       list(data.keys()) if isinstance(data, dict) else None)
                    except json.JSONDecodeError as e:
                        logger.warning("[greetings] JSON 파싱 실패: %s | raw=%s", e, raw[:200])
                elif res and not res.success:
                    logger.warning("[greetings] LLM 호출 실패: %s", res.error)
            except Exception as e:
                logger.warning("[greetings] 예외 attempt=%d: %s", attempt + 1, e)

        # 모든 시도 실패 시 폴백 (자연스러운 톤으로)
        hp = f"{hospital} " if hospital else ""
        natural_fallbacks = [
            (
                f"{name}님, {hp}검진 결과 정리됐어요. 같이 살펴볼까요? 💬",
                f"{name}님, 결과 보면서 이야기 나눠봐요. 어떤 부분이 궁금하세요? 💡",
            ),
            (
                f"{name}님, 검진 결과 안내해 드릴게요 📋",
                f"{name}님, 결과 정리됐어요. 궁금하거나 신경 쓰이는 부분 있으세요? 💬",
            ),
            (
                f"{name}님, 결과 중에 짚어드릴 부분이 있어요 💡",
                f"{name}님, 결과 보면서 같이 이야기해 봐요. 어떤 부분부터 볼까요? 💬",
            ),
        ]
        return random.choice(natural_fallbacks)

    async def _generate_hook_greeting(
        self,
        partner_info: PartnerAuthInfo,
        processed_data: Dict[str, Any]
    ) -> str:
        """[Deprecated] _generate_greetings()로 통합됨. 하위 호환 래퍼."""
        hook, _ = await self._generate_greetings(partner_info, processed_data)
        return hook

    @staticmethod
    def _scan_all_abnormals(metrics: Dict[str, Any]) -> List[Dict[str, str]]:
        """전수 스캔: 모든 이상 건강 지표를 수집 (if-elif 단일 매칭 대신)"""
        items = []
        sbp = metrics.get("systolic_bp")
        fasting_glucose = metrics.get("fasting_glucose")
        total_cholesterol = metrics.get("total_cholesterol")
        ldl = metrics.get("ldl_cholesterol")
        ast = metrics.get("ast") or metrics.get("sgot_ast")  # medilinx: sgot_ast
        alt = metrics.get("alt") or metrics.get("sgpt_alt")  # medilinx: sgpt_alt
        bmi = metrics.get("bmi")
        gfr = metrics.get("gfr")

        if sbp and sbp >= 140:
            items.append({"keyword": "혈압", "tone": "urgent" if sbp >= 160 else "curious"})
        if fasting_glucose and fasting_glucose >= 100:
            items.append({"keyword": "혈당", "tone": "urgent" if fasting_glucose >= 126 else "curious"})
        if total_cholesterol and total_cholesterol >= 240:
            items.append({"keyword": "콜레스테롤", "tone": "curious"})
        if ldl and ldl >= 160:
            items.append({"keyword": "LDL 콜레스테롤", "tone": "curious"})
        if (ast and ast >= 40) or (alt and alt >= 40):
            items.append({"keyword": "간 수치", "tone": "curious"})
        if bmi and bmi >= 25:
            items.append({"keyword": "체중 관리", "tone": "curious" if bmi >= 30 else "friendly"})
        if gfr is not None and gfr < 60:
            items.append({"keyword": "신장 기능", "tone": "urgent"})

        # urgent → curious → friendly 순으로 정렬 (가장 심각한 것 우선)
        tone_order = {"urgent": 0, "curious": 1, "friendly": 2}
        items.sort(key=lambda x: tone_order.get(x["tone"], 2))
        return items

    @staticmethod
    def _classify_data_type(processed_data: Dict[str, Any]) -> str:
        """데이터 유형 분류: with_trends / single_visit / no_abnormal"""
        metrics = processed_data.get("health_metrics", {})
        trends = processed_data.get("trend_data") or processed_data.get("historical_data")
        abnormal_items = [
            k for k, v in metrics.items()
            if k.endswith("_abnormal") and v and v != "정상"
        ]
        if trends and len(trends) > 0:
            return "with_trends"
        elif abnormal_items:
            return "single_visit"
        else:
            return "no_abnormal"

    async def _generate_data_science_greeting(
        self,
        partner_info: PartnerAuthInfo,
        processed_data: Dict[str, Any],
    ) -> str:
        """[Deprecated] _generate_greetings()로 통합됨. 하위 호환 래퍼."""
        _, greeting = await self._generate_greetings(partner_info, processed_data)
        return greeting

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
                system_instruction = f"너는 검진 결과를 안내하는 건강 도우미야. 아래 [Context]를 완벽히 숙지해.\n[Context]\n{partner_ctx}\n{medical_ctx}"
                
                await gemini_service._get_or_create_cache(
                    system_prompt=system_instruction,
                    model_name="gemini-3-flash-preview",
                    cache_key=session_id
                )
                logger.info(f"✅ [Cache] 백그라운드 캐시 준비 완료 - session: {session_id[:8]}")
        except Exception as e:
            logger.warning(f"⚠️ [Cache] 백그라운드 캐시 생성 실패: {e}")
