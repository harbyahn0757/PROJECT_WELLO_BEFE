"""
검진 설계 관련 API 엔드포인트
GPT 기반 검진 설계 생성
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, HTTPException, Query, Path, Depends, Request
from starlette.requests import Request
from pydantic import BaseModel, Field
import logging
from datetime import datetime
import os
import json
import time
import asyncpg

from ....services.exceptions import PatientNotFoundError, CheckupDesignError
from ....repositories.implementations import PatientRepository, CheckupDesignRepository
from ....core.security import get_current_user
from ....core.config import settings
from ....services.gpt_service import GPTService, GPTRequest
from ....services.gemini_service import gemini_service, GeminiRequest
from ....services.llm_router import llm_router
from ....services.checkup_design import (
    create_checkup_design_prompt_step1,
    create_checkup_design_prompt_step2_priority1,
    create_checkup_design_prompt_step2_upselling,
    CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP1,
    CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP2
)
from ....services.welno_data_service import WelnoDataService
from ....services.session_logger import get_session_logger
from ....services.worry_service import worry_service # 추가
from ....services.checkup_design import rag_service

logger = logging.getLogger(__name__)

router = APIRouter()
welno_data_service = WelnoDataService()
gpt_service = GPTService()


def _build_generic_hospital_fallback() -> Dict[str, Any]:
    """[v10] hospital_id 없거나 환자 last_auth hospital 미발견 시 일반검진 폴백 정보.

    국가 일반검진 기본 항목으로 priority_1 생성 가능하게 한다.
    priority_2/priority_3 (병원 추천/외부 검사) 는 빈 배열 → prompt.py 의 else 분기가
    "담당 병원에서 추가 안내" 일반 문구를 작성하도록 지시한다.
    """
    return {
        "hospital_id": "_GENERIC_",
        "hospital_name": "WELNO 일반 검진 안내",
        "name": "WELNO 일반 검진 안내",
        "phone": "",
        "address": "",
        "supported_checkup_types": ["basic"],
        "checkup_items": [],
        "national_checkup_items": [
            {
                "category": "기본검진",
                "items": [
                    "혈압",
                    "공복혈당",
                    "총콜레스테롤",
                    "HDL",
                    "LDL",
                    "중성지방",
                    "AST",
                    "ALT",
                    "감마GTP",
                    "혈색소",
                    "요단백",
                    "혈청크레아티닌",
                    "체질량지수(BMI)",
                    "허리둘레",
                ],
            }
        ],
        "recommended_items": [],
        "external_checkup_items": [],
        "is_active": True,
    }


# JSON 파싱 복구 함수
def parse_json_with_recovery(content: str, step_name: str = "STEP", session_id: Optional[str] = None) -> Dict[str, Any]:
    """
    JSON 문자열을 안전하게 파싱하고, 실패 시 복구 시도
    
    Args:
        content: 파싱할 JSON 문자열
        step_name: 단계 이름 (로깅용)
    
    Returns:
        파싱된 딕셔너리
    """
    import re
    
    # 1. 코드블록 제거 (정규식으로 개선)
    cleaned = content.strip()
    
    # ```json ... ``` 제거
    cleaned = re.sub(r'^```json\s*\n?', '', cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r'^```\s*\n?', '', cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r'\n?```\s*$', '', cleaned, flags=re.MULTILINE | re.DOTALL)
    cleaned = cleaned.strip()
    
    # 2. 응답 길이 체크 (너무 짧으면 불완전한 응답)
    if len(cleaned) < 500:
        logger.error(f"❌ [{step_name}] 응답이 너무 짧음 ({len(cleaned)}자) - Gemini 응답 불완전")
        raise ValueError(f"{step_name} 응답 불완전: 길이 {len(cleaned)}자 (최소 500자 필요)")
    
    # 3. 첫 번째 JSON 파싱 시도
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.warning(f"⚠️ [{step_name}] JSON 파싱 실패, 복구 시도 중...")
        logger.warning(f"⚠️ [{step_name}] 에러 위치: line {e.lineno}, column {e.colno}, pos {getattr(e, 'pos', 'unknown')}")
        
        # 4. JSON 복구 시도
        error_pos = getattr(e, 'pos', None)
        if not error_pos or error_pos >= len(cleaned):
            error_pos = len(cleaned)
        
        # 에러 위치 이전까지의 텍스트 추출
        fixed = cleaned[:error_pos]
        
        # 불완전한 문자열 찾기 및 닫기 (개선된 로직)
        # 문자열 내부인지 확인 (따옴표 개수 세기)
        quote_count = 0
        in_escape = False
        for char in fixed:
            if char == '\\' and not in_escape:
                in_escape = True
                continue
            if char == '"' and not in_escape:
                quote_count += 1
            in_escape = False
        
        # 홀수 개의 따옴표 = 문자열이 열린 상태
        if quote_count % 2 == 1:
            fixed += '"'
            logger.info(f"🔧 [{step_name}] 종료되지 않은 문자열 닫기 추가")
        
        # 배열이 열린 상태면 닫기
        open_brackets = fixed.count('[') - fixed.count(']')
        if open_brackets > 0:
            # 배열이 완전히 비어있는지 확인
            last_bracket = fixed.rfind('[')
            after_bracket = fixed[last_bracket+1:].strip()
            if not after_bracket or after_bracket == ',':
                # 빈 배열 요소 추가
                fixed += '""' * open_brackets
            fixed += ']' * open_brackets
            logger.info(f"🔧 [{step_name}] 열린 배열 {open_brackets}개 닫기")
        
        # 객체가 열린 상태면 닫기
        open_braces = fixed.count('{') - fixed.count('}')
        if open_braces > 0:
            fixed += '}' * open_braces
            logger.info(f"🔧 [{step_name}] 열린 객체 {open_braces}개 닫기")
        
        # 4. 복구된 JSON 파싱 시도
        try:
            logger.info(f"🔧 [{step_name}] JSON 복구 시도: {len(fixed)} 문자 (원본: {len(cleaned)} 문자)")
            parsed = json.loads(fixed)
            if not isinstance(parsed, dict):
                raise ValueError(f"JSON 파싱 결과가 딕셔너리가 아닙니다: {type(parsed)}")
            return parsed
        except json.JSONDecodeError as e2:
            logger.error(f"❌ [{step_name}] JSON 복구 실패: {str(e2)}")
            
            # 디버깅용 부분 응답 저장
            if session_id:
                try:
                    date_str = session_id.split('_')[0]
                    partial_file = f"/data/wello_logs/planning_{date_str}/{session_id}/partial_{step_name}.txt"
                    os.makedirs(os.path.dirname(partial_file), exist_ok=True)
                    with open(partial_file, 'w', encoding='utf-8') as f:
                        f.write(f"=== 원본 응답 (전체) ===\n{content}\n\n")
                        f.write(f"=== 복구 시도 결과 ===\n{fixed}\n\n")
                        f.write(f"=== 에러 메시지 ===\n{str(e2)}\n\n")
                        f.write(f"=== 에러 위치 ===\nLine: {e2.lineno}, Column: {e2.colno}, Position: {e2.pos}\n")
                    logger.info(f"💾 [{step_name}] 부분 응답 저장: {partial_file}")
                except Exception as save_err:
                    logger.error(f"❌ [{step_name}] 부분 응답 저장 실패: {str(save_err)}")
            
            logger.error(f"❌ [{step_name}] 원본 응답 (처음 2000자): {content[:2000]}")
            logger.error(f"❌ [{step_name}] 복구 시도 내용 (처음 2000자): {fixed[:2000]}")
            raise ValueError(f"{step_name} JSON 파싱 실패: {str(e2)}")
        except Exception as e2:
            logger.error(f"❌ [{step_name}] JSON 복구 중 예외 발생: {str(e2)}")
            raise ValueError(f"{step_name} JSON 파싱 실패: {str(e2)}")

# 의존성 주입 (추후 DI 컨테이너로 대체)
def get_repositories():
    return PatientRepository(), CheckupDesignRepository()


def normalize_survey_responses(responses: Optional[Any]) -> Dict[str, Any]:
    """
    survey_responses는 클라이언트에서 딕셔너리 또는 JSON 문자열로 전달될 수 있으므로
    안전하게 dict로 변환하여 반환합니다.
    """
    if isinstance(responses, dict):
        return dict(responses)
    if isinstance(responses, str):
        try:
            parsed = json.loads(responses)
            if isinstance(parsed, dict):
                return dict(parsed)
        except json.JSONDecodeError:
            logger.warning(f"⚠️ [검진설계] survey_responses JSON 파싱 실패: {responses}")
    return {}


class ConcernItem(BaseModel):
    """염려 항목 모델"""
    type: str = Field(..., description="항목 유형: checkup, hospital, medication")
    id: str = Field(..., description="항목 ID")
    name: Optional[str] = Field(None, description="항목명 (검진 항목 또는 약물명)")
    date: Optional[str] = Field(None, description="검진일 또는 처방일")
    value: Optional[float] = Field(None, description="검진 수치")
    unit: Optional[str] = Field(None, description="단위")
    status: Optional[str] = Field(None, description="상태: warning, abnormal")
    location: Optional[str] = Field(None, description="병원명")
    hospitalName: Optional[str] = Field(None, description="병원명 (병원 항목용)")
    checkupDate: Optional[str] = Field(None, description="검진일 (병원 항목용)")
    abnormalCount: Optional[int] = Field(None, description="이상 항목 수 (병원 항목용)")
    warningCount: Optional[int] = Field(None, description="경계 항목 수 (병원 항목용)")
    medicationName: Optional[str] = Field(None, description="약물명 (약물 항목용)")
    period: Optional[str] = Field(None, description="복용 기간 (약물 항목용)")
    medicationText: Optional[str] = Field(None, description="약물 복용 패턴 설명 (사용자 친화적 텍스트, 프롬프트용)")

class CheckupDesignRequest(BaseModel):
    """검진 설계 요청 모델 (GPT 기반)"""
    uuid: str = Field(..., description="환자 UUID")
    hospital_id: str = Field(..., description="병원 ID")
    partner_id: str = Field("welno", description="파트너 ID")  # 파트너 ID 추가
    selected_concerns: Optional[List[ConcernItem]] = Field(None, description="선택한 염려 항목 리스트 (None이면 자동 추출)")
    survey_responses: Optional[Dict[str, Any]] = Field(None, description="설문 응답 (체중 변화, 운동, 가족력 등)")
    additional_info: Optional[Dict[str, Any]] = Field(None, description="추가 정보")
    # 약품 분석 결과 텍스트 (전체 처방 데이터 대신 사용)
    prescription_analysis_text: Optional[str] = Field(None, description="약품 분석 결과 텍스트 (프롬프트용)")
    selected_medication_texts: Optional[List[str]] = Field(None, description="선택된 약품의 사용자 친화적 텍스트 (프롬프트용)")
    events: Optional[List[Dict[str, Any]]] = Field(None, description="사용자 행동 로그 (체류 시간, 클릭 등)") # 추가


class CheckupDesignResponse(BaseModel):
    """검진 설계 응답 모델 (GPT 기반)"""
    success: bool
    data: Dict[str, Any]  # GPT 응답 JSON 구조
    message: Optional[str] = None


class Step1Result(BaseModel):
    """STEP 1 분석 결과 모델"""
    patient_summary: str = Field(..., description="환자 상태 3줄 요약")
    analysis: str = Field(..., description="종합 분석")
    persona: Optional[Dict[str, Any]] = Field(None, description="환자 페르소나 분석 결과")  # 🔥 추가됨
    risk_profile: Optional[List[Dict[str, Any]]] = Field(None, description="위험도 계층화 결과 (각 장기별 위험도 분류)")
    chronic_analysis: Optional[Dict[str, Any]] = Field(None, description="만성질환 연쇄 반응 분석")
    survey_reflection: str = Field(..., description="문진 내용 반영 예고")
    selected_concerns_analysis: List[Dict[str, Any]] = Field(..., description="선택한 염려 항목별 분석")
    basic_checkup_guide: Dict[str, Any] = Field(..., description="기본 검진 가이드")


class CheckupDesignStep2Request(BaseModel):
    """STEP 2 검진 설계 요청 모델"""
    uuid: str = Field(..., description="환자 UUID")
    hospital_id: str = Field(..., description="병원 ID")
    step1_result: Step1Result = Field(..., description="STEP 1 분석 결과")
    selected_concerns: List[ConcernItem] = Field(..., description="선택한 염려 항목 리스트")
    survey_responses: Optional[Dict[str, Any]] = Field(None, description="설문 응답")
    additional_info: Optional[Dict[str, Any]] = Field(None, description="추가 정보")
    prescription_analysis_text: Optional[str] = Field(None, description="약품 분석 결과 텍스트")
    selected_medication_texts: Optional[List[str]] = Field(None, description="선택된 약품의 사용자 친화적 텍스트")
    session_id: Optional[str] = Field(None, description="세션 ID (로깅용)")


class TrendAnalysisResponse(BaseModel):
    """추이 분석 응답 모델"""
    patient_uuid: str
    analysis: str
    recommendations: List[str]
    risk_factors: List[str]
    next_checkup_date: Optional[str]


@router.post("/create", response_model=CheckupDesignResponse)
async def create_checkup_design(
    request: CheckupDesignRequest
):
    """
    GPT 기반 검진 설계 생성
    사용자가 선택한 염려 항목을 기반으로 맞춤형 검진 계획 생성
    """
    import time
    overall_start = time.time()
    
    try:
        concerns_count = len(request.selected_concerns) if request.selected_concerns else 0
        logger.info(f"🔍 [검진설계] 요청 시작 - UUID: {request.uuid}, 선택 항목: {concerns_count}개")
        logger.info(f"⏱️  [타이밍] 전체 시작: 0.0초")
        logger.info(f"🔍 [검진설계] request 타입: {type(request)}")
        logger.info(f"🔍 [검진설계] request.uuid 타입: {type(request.uuid)}")
        logger.info(f"🔍 [검진설계] request.hospital_id 타입: {type(request.hospital_id)}")
        
        # 1. 환자 정보 조회
        data_start = time.time()
        logger.info(f"🔍 [검진설계] 환자 정보 조회 시작...")
        patient_info = await welno_data_service.get_patient_by_uuid(request.uuid)
        logger.info(f"🔍 [검진설계] patient_info 타입: {type(patient_info)}")
        
        if not isinstance(patient_info, dict):
            logger.error(f"❌ [검진설계] patient_info가 딕셔너리가 아님: {type(patient_info)}")
            logger.error(f"❌ [검진설계] patient_info 내용: {patient_info}")
            raise ValueError(f"환자 정보 조회 결과가 딕셔너리가 아닙니다: {type(patient_info)}")
        
        if "error" in patient_info:
            raise HTTPException(status_code=404, detail=patient_info["error"])
        
        patient_name = patient_info.get("name", "환자")
        patient_age = None
        if patient_info.get("birth_date"):
            from datetime import datetime
            birth_date = datetime.fromisoformat(patient_info["birth_date"].replace("Z", "+00:00"))
            patient_age = datetime.now().year - birth_date.year
        patient_gender = patient_info.get("gender", "M")
        
        # 1-1. 병원 정보 조회 (검진 항목 포함)
        # [v10] hospital_id 누락 시 환자 last_auth hospital 자동 조회 → 그래도 없으면 일반검진 폴백
        resolved_hospital_id = request.hospital_id
        if not resolved_hospital_id:
            resolved_hospital_id = await welno_data_service.find_hospital_id_by_uuid(request.uuid)
            logger.info(f"🔍 [v10] hospital_id 자동 조회: {resolved_hospital_id or 'None (폴백)'}")

        logger.info(f"🏥 [검진설계] 병원 정보 조회 시작 - hospital_id: {resolved_hospital_id}")
        hospital_info: Dict[str, Any] = {}
        if resolved_hospital_id:
            hospital_info = await welno_data_service.get_hospital_by_id(resolved_hospital_id)
        logger.info(f"🔍 [검진설계] hospital_info 타입: {type(hospital_info)}")

        # [v10] 병원 정보 없거나 error 시 일반검진 폴백 (HTTPException 대신)
        if not isinstance(hospital_info, dict) or not hospital_info or "error" in hospital_info:
            logger.warning(f"⚠️ [v10] 병원 정보 없음 ({resolved_hospital_id}) — 일반검진 폴백 모드")
            hospital_info = _build_generic_hospital_fallback()
            resolved_hospital_id = resolved_hospital_id or hospital_info["hospital_id"]
        
        hospital_checkup_items = hospital_info.get("checkup_items")
        hospital_national_checkup = hospital_info.get("national_checkup_items")
        hospital_recommended = hospital_info.get("recommended_items")
        hospital_external_checkup = hospital_info.get("external_checkup_items", [])  # 외부 검사 항목 (매핑 테이블에서 조회)
        
        logger.info(f"✅ [검진설계] 병원 정보 조회 완료 - {hospital_info.get('hospital_name', 'N/A')}")
        logger.info(f"📊 [검진설계] 검진 항목 통계:")
        logger.info(f"  - 기본 검진 항목: {len(hospital_national_checkup) if hospital_national_checkup else 0}개")
        logger.info(f"  - 병원 추천 항목: {len(hospital_recommended) if hospital_recommended else 0}개")
        logger.info(f"  - 프리미엄 항목 (외부 검사): {len(hospital_external_checkup)}개")
        
        if hospital_external_checkup:
            # 난이도별 통계
            difficulty_stats = {}
            for item in hospital_external_checkup:
                level = item.get('difficulty_level', 'Unknown')
                difficulty_stats[level] = difficulty_stats.get(level, 0) + 1
            logger.info(f"📊 [검진설계] 프리미엄 항목 난이도별 통계: {difficulty_stats}")
            # 처음 3개 항목만 로그 출력
            for idx, item in enumerate(hospital_external_checkup[:3]):
                algorithm_info = f" [{item.get('algorithm_class', 'N/A')}]" if item.get('algorithm_class') else ""
                target_info = f" - {item.get('target', 'N/A')}" if item.get('target') else ""
                logger.info(f"  [{idx+1}] {item.get('item_name', 'N/A')} ({item.get('difficulty_level', 'N/A')}){algorithm_info}{target_info} - {item.get('category', 'N/A')}")
            if len(hospital_external_checkup) > 3:
                logger.info(f"  ... 외 {len(hospital_external_checkup) - 3}개 항목")
        
        # 2. 건강 데이터 조회
        logger.info(f"⏱️  [타이밍] 환자/병원 정보 조회: {time.time() - data_start:.2f}초")
        health_start = time.time()
        logger.info(f"🔍 [검진설계] 건강 데이터 조회 시작...")
        health_data_result = await welno_data_service.get_patient_health_data(request.uuid, resolved_hospital_id)
        logger.info(f"🔍 [검진설계] health_data_result 타입: {type(health_data_result)}")
        
        if not isinstance(health_data_result, dict):
            logger.error(f"❌ [검진설계] health_data_result가 딕셔너리가 아님: {type(health_data_result)}")
            logger.error(f"❌ [검진설계] health_data_result 내용: {health_data_result}")
            logger.warning(f"⚠️ [검진설계] 건강 데이터 조회 실패 - 딕셔너리가 아님, 빈 리스트 사용")
            health_data = []
        elif "error" in health_data_result:
            logger.warning(f"⚠️ [검진설계] 건강 데이터 조회 실패: {health_data_result['error']}")
            health_data = []
        else:
            health_data = health_data_result.get("health_data", [])
        
        # 3. 처방전 데이터 조회 (분석 결과 텍스트가 있으면 스킵)
        prescription_data = []
        if not request.prescription_analysis_text:
            # 분석 결과 텍스트가 없을 때만 원본 데이터 조회 (하위 호환성)
            logger.info(f"🔍 [검진설계] 처방전 데이터 조회 시작...")
            prescription_data_result = await welno_data_service.get_patient_prescription_data(request.uuid, resolved_hospital_id)
            logger.info(f"🔍 [검진설계] prescription_data_result 타입: {type(prescription_data_result)}")
            
            if not isinstance(prescription_data_result, dict):
                logger.error(f"❌ [검진설계] prescription_data_result가 딕셔너리가 아님: {type(prescription_data_result)}")
                logger.error(f"❌ [검진설계] prescription_data_result 내용: {prescription_data_result}")
                logger.warning(f"⚠️ [검진설계] 처방전 데이터 조회 실패 - 딕셔너리가 아님, 빈 리스트 사용")
                prescription_data = []
            elif "error" in prescription_data_result:
                logger.warning(f"⚠️ [검진설계] 처방전 데이터 조회 실패: {prescription_data_result['error']}")
                prescription_data = []
            else:
                prescription_data = prescription_data_result.get("prescription_data", [])
        else:
            logger.info(f"📝 [검진설계] 약품 분석 결과 텍스트 사용 (원본 데이터 스킵)")
        
        # 4. 선택한 염려 항목 변환 (없으면 자동 추출)
        selected_concerns = []

        if not request.selected_concerns:
            # 자동 추출 모드
            from ....services.checkup_design.auto_concerns import auto_extract_concerns
            patient_gender = patient_info.get("gender", "M")
            auto_concerns = auto_extract_concerns(
                health_data, prescription_data, patient_gender
            )
            logger.info(f"🤖 [검진설계] 자동 추출 concerns: {len(auto_concerns)}개")
            selected_concerns = auto_concerns

        for concern in (request.selected_concerns or []):
            concern_dict = {
                "type": concern.type,
                "id": concern.id
            }
            if concern.type == "checkup":
                concern_dict.update({
                    "name": concern.name,
                    "date": concern.date,
                    "value": concern.value,
                    "unit": concern.unit,
                    "status": concern.status,
                    "location": concern.location
                })
            elif concern.type == "hospital":
                concern_dict.update({
                    "hospital_name": concern.hospitalName or concern.location,
                    "checkup_date": concern.checkupDate or concern.date,
                    "abnormal_count": concern.abnormalCount or 0,
                    "warning_count": concern.warningCount or 0
                })
            elif concern.type == "medication":
                concern_dict.update({
                    "medication_name": concern.medicationName or concern.name,
                    "period": concern.period,
                    "hospital_name": concern.hospitalName or concern.location,
                    "medication_text": getattr(concern, "medicationText", None)  # 사용자 친화적 텍스트 (Pydantic 모델에 없을 수 있음)
                })
            selected_concerns.append(concern_dict)
        
        # 병원 정보는 이미 101번 라인에서 조회했으므로 중복 조회 제거
        # hospital_national_checkup, hospital_recommended는 위에서 이미 조회됨
        
        # 5. 2단계 파이프라인 실행: STEP 1 → STEP 2 순차 호출
        logger.info(f"⏱️  [타이밍] 데이터 조회 완료: {time.time() - health_start:.2f}초")
        logger.info(f"⏱️  [타이밍] 누적 (데이터 조회까지): {time.time() - overall_start:.2f}초")
        logger.info(f"🔄 [검진설계] 2단계 파이프라인 시작...")
        
        # survey_responses에서 약품 분석 텍스트 추출
        survey_responses_clean = normalize_survey_responses(request.survey_responses)
        prescription_analysis_text = survey_responses_clean.pop("prescription_analysis_text", None) or request.prescription_analysis_text
        selected_medication_texts = survey_responses_clean.pop("selected_medication_texts", None) or request.selected_medication_texts
        
        # STEP 1: 빠른 분석 수행
        step1_start = time.time()
        logger.info(f"📊 [검진설계] STEP 1: 빠른 분석 시작...")
        step1_response = await create_checkup_design_step1(request)
        if not step1_response.success:
            logger.error(f"❌ [검진설계] STEP 1 실패")
            raise ValueError("STEP 1 분석 실패")
        
        step1_result = step1_response.data
        step1_elapsed = time.time() - step1_start
        logger.info(f"✅ [검진설계] STEP 1 완료 - 분석 결과 수신")
        logger.info(f"⏱️  [타이밍] STEP 1 소요: {step1_elapsed:.2f}초")
        logger.info(f"⏱️  [타이밍] 누적 (STEP 1까지): {time.time() - overall_start:.2f}초")
        logger.info(f"🔍 [검진설계] STEP 1 결과 타입: {type(step1_result)}")
        logger.info(f"🔍 [검진설계] step1_response 타입: {type(step1_response)}")
        logger.info(f"🔍 [검진설계] step1_response.data 타입: {type(step1_response.data)}")
        
        # step1_result가 딕셔너리인지 확인
        if not isinstance(step1_result, dict):
            logger.error(f"❌ [검진설계] STEP 1 결과가 딕셔너리가 아님: {type(step1_result)}")
            logger.error(f"❌ [검진설계] STEP 1 결과 내용 (처음 500자): {str(step1_result)[:500]}")
            raise ValueError(f"STEP 1 결과 형식 오류: 딕셔너리가 아닌 {type(step1_result)}")
        
        logger.info(f"📊 [검진설계] STEP 1 결과 키: {list(step1_result.keys())}")
        
        # STEP 2: 설계 및 근거 확보 (STEP 1 결과를 구조체로 전달)
        step2_start = time.time()
        logger.info(f"🔧 [검진설계] STEP 2: 설계 및 근거 확보 시작...")
        try:
            # STEP 1 결과를 Step1Result 구조체로 변환
            step1_result_model = Step1Result(**step1_result)
            
            # session_id 추출 (STEP 1에서 생성됨)
            session_id = step1_result.get('session_id')
            
            # STEP 2 요청 생성
            step2_request = CheckupDesignStep2Request(
                uuid=request.uuid,
                hospital_id=request.hospital_id,
                step1_result=step1_result_model,
                selected_concerns=request.selected_concerns,
                survey_responses=survey_responses_clean,
                additional_info=request.additional_info,
                prescription_analysis_text=prescription_analysis_text,
                selected_medication_texts=selected_medication_texts,
                session_id=session_id  # 세션 ID 전달
            )
            
            # STEP 2 호출
            step2_response = await create_checkup_design_step2(step2_request)
            step2_result = None
            if not step2_response.success:
                logger.error(f"❌ [검진설계] STEP 2 실패")
                # STEP 2 실패 시 STEP 1 결과라도 반환 (부분 성공)
                logger.warning(f"⚠️ [검진설계] STEP 2 실패 - STEP 1 결과만 반환")
                ai_response = step1_result
            else:
                step2_result = step2_response.data
                step2_elapsed = time.time() - step2_start
                logger.info(f"✅ [검진설계] STEP 2 완료 - 설계 및 근거 결과 수신")
                logger.info(f"⏱️  [타이밍] STEP 2 소요: {step2_elapsed:.2f}초")
                logger.info(f"⏱️  [타이밍] 누적 (STEP 2까지): {time.time() - overall_start:.2f}초")
                
                # step2_result 타입 검증
                logger.info(f"🔍 [검진설계] STEP 2 결과 타입: {type(step2_result)}")
                if not isinstance(step2_result, dict):
                    logger.error(f"❌ [검진설계] STEP 2 결과가 딕셔너리가 아님: {type(step2_result)}")
                    logger.error(f"❌ [검진설계] STEP 2 결과 내용 (처음 500자): {str(step2_result)[:500]}")
                    raise ValueError(f"STEP 2 결과 형식 오류: 딕셔너리가 아닌 {type(step2_result)}")
                
                logger.info(f"📊 [검진설계] STEP 2 결과 키: {list(step2_result.keys())}")
                
                # STEP 1과 STEP 2 결과 병합
                logger.info(f"🔗 [검진설계] STEP 1과 STEP 2 결과 병합 중...")
                ai_response = merge_checkup_design_responses(
                    step1_result, 
                    step2_result, 
                    hospital_recommended=hospital_recommended,
                    hospital_external_checkup=hospital_external_checkup
                )
                logger.info(f"✅ [검진설계] 병합 완료 - 최종 결과 키: {list(ai_response.keys())}")
                
                # priority_1 검증: hospital_national_checkup의 일반 카테고리만 포함되는지 확인
                try:
                    summary = ai_response.get("summary", {})
                    if isinstance(summary, dict):
                        priority_1 = summary.get("priority_1", {})
                        if isinstance(priority_1, dict) and priority_1.get("items"):
                            priority_1_items = priority_1.get("items", [])
                            if priority_1_items and hospital_national_checkup:
                                # hospital_national_checkup에서 일반/기본검진 카테고리 항목만 추출
                                general_items = []
                                for item in hospital_national_checkup:
                                    if isinstance(item, dict):
                                        category = item.get("category", "").lower()
                                        # 일반 또는 기본검진 카테고리만 포함
                                        if category in ["일반", "기본검진", "basic", "general"]:
                                            item_name = item.get("name", "") or item.get("item_name", "")
                                            if item_name:
                                                general_items.append(item_name)
                                            # items 배열이 있으면 그 안의 항목들도 포함
                                            if item.get("items"):
                                                for sub_item in item.get("items", []):
                                                    if isinstance(sub_item, str):
                                                        general_items.append(sub_item)
                                
                                # priority_1.items가 일반 카테고리에 포함되는지 검증
                                invalid_items = []
                                for p1_item in priority_1_items:
                                    if isinstance(p1_item, str):
                                        # 정확히 일치하거나 부분 일치하는지 확인
                                        found = False
                                        for gen_item in general_items:
                                            if p1_item == gen_item or gen_item in p1_item or p1_item in gen_item:
                                                found = True
                                                break
                                        if not found:
                                            invalid_items.append(p1_item)
                                
                                if invalid_items:
                                    logger.warning(f"⚠️ [검진설계] priority_1에 일반 카테고리가 아닌 항목 발견: {invalid_items}")
                                    logger.warning(f"⚠️ [검진설계] 일반 카테고리 항목 목록: {general_items}")
                                    # 경고만 하고 계속 진행 (GPT가 프롬프트를 따르지 않았을 수 있음)
                except Exception as validation_error:
                    logger.warning(f"⚠️ [검진설계] priority_1 검증 중 오류 (무시): {str(validation_error)}")
                
                # Citations 추출 (STEP 2에서 온 citations 사용)
                citations = []
                if "_citations" in step2_result:
                    citations = step2_result.get("_citations", [])
                logger.info(f"📚 [검진설계] Citations: {len(citations)}개")
                
                # Citations를 응답에 추가
                if citations:
                    ai_response["_citations"] = citations
                    logger.info(f"📚 [검진설계] Citations를 응답에 추가: {len(citations)}개")
        except Exception as step2_error:
            logger.error(f"❌ [검진설계] STEP 2 실행 중 오류: {str(step2_error)}", exc_info=True)
            # STEP 2 실패 시 STEP 1 결과라도 반환 (부분 성공)
            logger.warning(f"⚠️ [검진설계] STEP 2 실패 - STEP 1 결과만 반환")
            ai_response = step1_result
        
        # 응답 검증
        logger.info(f"🔍 [검진설계] 응답 검증 중...")
        if not ai_response:
            logger.error(f"❌ [검진설계] ai_response가 None")
            raise ValueError("ai_response가 None입니다.")
        
        # recommended_items는 STEP 2에서 생성되므로, STEP 2가 실패한 경우 없을 수 있음
        if not ai_response.get("recommended_items"):
            logger.warning(f"⚠️ [검진설계] recommended_items가 없음 (STEP 2 실패 가능성)")
            logger.warning(f"⚠️ [검진설계] 응답 키: {list(ai_response.keys())}")
            # STEP 2 실패 시에는 에러를 발생시키지 않고 계속 진행 (부분 성공)
        
        logger.info(f"✅ [검진설계] 2단계 파이프라인 완료")
        
        # 7. 검진 설계 요청 저장 (업셀링용)
        try:
            save_result = await welno_data_service.save_checkup_design_request(
                uuid=request.uuid,
                hospital_id=request.hospital_id,
                selected_concerns=selected_concerns,
                survey_responses=survey_responses_clean,
                design_result=ai_response
            )
            if save_result.get("success"):
                logger.info(f"✅ [검진설계] 요청 저장 완료 - ID: {save_result.get('request_id')}")
            else:
                logger.warning(f"⚠️ [검진설계] 요청 저장 실패: {save_result.get('error')}")
        except Exception as e:
            logger.warning(f"⚠️ [검진설계] 요청 저장 중 오류 (무시): {str(e)}")
        
        # 8. 검진설계 완료 → Mediarc 리포트 자동 생성 (케이스 1)
        # ─────────────────────────────────────────────────────────────────
        # 사용자가 검진설계를 완료했을 때, Mediarc 질병예측 리포트가 아직
        # 생성되지 않았다면 백그라운드에서 자동으로 생성합니다.
        #
        # 흐름:
        # 1. Mediarc 리포트 존재 여부 확인
        # 2. 없으면: 검진설계 문진 → Mediarc 코드 변환
        # 3. 백그라운드에서 Mediarc 생성 (문진 포함)
        # 4. WebSocket 알림: "질병예측 리포트가 생성되었습니다!"
        #
        # 장점:
        # - 사용자가 추가 액션 없이 자동으로 질병예측 리포트 확보
        # - 검진설계 문진 데이터를 즉시 활용하여 정확도 향상
        # ─────────────────────────────────────────────────────────────────
        try:
            from ....services.dynamic_config_service import dynamic_config
            partner_id = request.headers.get("X-Partner-ID", "welno")
            mediarc_config = await dynamic_config.get_mediarc_config(partner_id)
            MEDIARC_ENABLED = mediarc_config["enabled"]
            
            if MEDIARC_ENABLED:
                import asyncpg
                import asyncio
                
                # Mediarc 리포트 존재 여부 확인
                conn = await asyncpg.connect(
                    host=settings.DB_HOST if hasattr(settings, 'DB_HOST') else '10.0.1.10',
                    port=settings.DB_PORT if hasattr(settings, 'DB_PORT') else 5432,
                    database=settings.DB_NAME if hasattr(settings, 'DB_NAME') else 'p9_mkt_biz',
                    user=settings.DB_USER if hasattr(settings, 'DB_USER') else 'peernine',
                    password=settings.DB_PASSWORD if hasattr(settings, 'DB_PASSWORD') else 'autumn3334!'
                )
                
                existing_report = await conn.fetchrow(
                    "SELECT id FROM welno.welno_mediarc_reports WHERE patient_uuid = $1 AND hospital_id = $2 LIMIT 1",
                    request.uuid, request.hospital_id
                )
                await conn.close()
                
                if not existing_report:
                    logger.info(f"📊 [검진설계 완료] Mediarc 리포트 없음 → 백그라운드 생성 시작")
                    
                    # 검진설계 문진 → Mediarc 코드 변환
                    from ....services.mediarc.questionnaire_mapper import map_checkup_design_survey_to_mediarc
                    questionnaire_codes = map_checkup_design_survey_to_mediarc(survey_responses_clean)
                    
                    # 백그라운드에서 Mediarc 리포트 생성
                    from ....services.mediarc import generate_mediarc_report_async
                    asyncio.create_task(
                        generate_mediarc_report_async(
                            patient_uuid=request.uuid,
                            hospital_id=request.hospital_id,
                            session_id=request.session_id,
                            partner_id=request.partner_id,  # ⭐ 파트너 ID 전달 (보안 강화)
                            service=welno_data_service,
                            questionnaire_data=questionnaire_codes  # 검진설계 문진 포함
                        )
                    )
                    
                    logger.info(f"✅ [검진설계 완료] Mediarc 생성 트리거 완료 (백그라운드)")
                else:
                    logger.info(f"ℹ️ [검진설계 완료] Mediarc 리포트 이미 존재 → 생성 생략")
        except Exception as mediarc_error:
            logger.warning(f"⚠️ [검진설계 완료] Mediarc 생성 트리거 실패 (무시): {mediarc_error}")
        
        # 9. 응답 반환
        total_elapsed = time.time() - overall_start
        logger.info(f"✅ [검진설계] 검진 설계 완료")
        logger.info(f"⏱️  [타이밍] ========================================")
        logger.info(f"⏱️  [타이밍] 전체 완료: {total_elapsed:.2f}초")
        logger.info(f"⏱️  [타이밍] ========================================")
        
        return CheckupDesignResponse(
            success=True,
            data=ai_response,
            message="검진 설계가 완료되었습니다."
        )
        
    except HTTPException:
        raise
    except HTTPException:
        raise
    except Exception as e:
        error_type = type(e).__name__
        error_message = str(e)
        logger.error(f"❌ [검진설계] 오류 발생: {error_type}: {error_message}", exc_info=True)
        logger.error(f"❌ [검진설계] 에러 타입: {error_type}")
        logger.error(f"❌ [검진설계] 에러 메시지: {error_message}")
        import traceback
        logger.error(f"❌ [검진설계] 트레이스백:\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"검진 설계 생성 중 오류: {error_message}"
        )


@router.get("/patient/{patient_uuid}/analysis", response_model=TrendAnalysisResponse)
async def analyze_patient_trends(
    patient_uuid: UUID = Path(..., description="환자 UUID"),
    current_user: dict = Depends(get_current_user)
):
    """환자의 검진 결과 추이 분석"""
    try:
        patient_repo, _ = get_repositories()
        
        # 환자 정보 조회
        patient = await patient_repo.get_by_uuid(patient_uuid)
        if not patient:
            raise PatientNotFoundError(f"환자를 찾을 수 없습니다: {patient_uuid}")
        
        if not patient.last_checkup_results:
            return TrendAnalysisResponse(
                patient_uuid=str(patient_uuid),
                analysis="기존 검진 결과가 없어 추이 분석이 제한적입니다.",
                recommendations=["정기 건강검진을 시작해보시기 바랍니다."],
                risk_factors=["검진 이력 부족"],
                next_checkup_date="2024-12-31"
            )
        
        # 간단한 추이 분석
        normal_count = sum(1 for item in patient.last_checkup_results if item.is_normal())
        total_count = len(patient.last_checkup_results)
        
        if normal_count / total_count >= 0.8:
            analysis = "대부분의 검진 결과가 정상 범위로 양호한 건강 상태를 보이고 있습니다."
            recommendations = ["현재 건강 상태를 유지하시기 바랍니다.", "1년 후 정기 검진을 권장합니다."]
            risk_factors = ["특별한 위험 요소 없음"]
        else:
            analysis = "일부 검진 결과에서 주의가 필요한 항목들이 확인됩니다."
            recommendations = ["전문의 상담을 받아보시기 바랍니다.", "3-6개월 후 추적 검사를 권장합니다."]
            risk_factors = ["일부 지표 이상", "추적 관찰 필요"]
        
        return TrendAnalysisResponse(
            patient_uuid=str(patient_uuid),
            analysis=analysis,
            recommendations=recommendations,
            risk_factors=risk_factors,
            next_checkup_date="2024-06-30"
        )
        
    except PatientNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"추이 분석 중 오류: {str(e)}")


@router.get("/patient/{patient_uuid}/recommendations")
async def get_recommendations(
    patient_uuid: UUID = Path(..., description="환자 UUID"),
    include_cost: bool = Query(True, description="비용 정보 포함 여부"),
    current_user: dict = Depends(get_current_user)
):
    """환자별 검진 추천 정보"""
    try:
        patient_repo, _ = get_repositories()
        
        # 환자 정보 조회
        patient = await patient_repo.get_by_uuid(patient_uuid)
        if not patient:
            raise PatientNotFoundError(f"환자를 찾을 수 없습니다: {patient_uuid}")
        
        age = patient.info.get_age()
        
        # 연령별 맞춤 검진 추천
        recommended_items = []
        
        # 기본 검진
        recommended_items.append({
            "name": "기본 혈액검사",
            "description": "혈압, 혈당, 콜레스테롤 등 기본 검사",
            "type": "basic",
            "cost": 80000
        })
        
        # 연령별 추가 검진
        if age >= 40:
            recommended_items.append({
                "name": "종합건강검진",
                "description": "연례 종합 건강 상태 점검",
                "type": "comprehensive",
                "cost": 300000
            })
        
        if age >= 50:
            recommended_items.extend([
                {
                    "name": "위내시경",
                    "description": "위암 조기 발견을 위한 검사",
                    "type": "cancer",
                    "cost": 150000
                },
                {
                    "name": "심장 초음파",
                    "description": "심혈관 질환 예방 검사",
                    "type": "heart",
                    "cost": 200000
                }
            ])
        
        # 비용 정보 제외 옵션
        if not include_cost:
            for item in recommended_items:
                item.pop("cost", None)
        
        total_cost = sum(item.get("cost", 0) for item in recommended_items) if include_cost else None
        
        return {
            "patient_uuid": str(patient_uuid),
            "recommendations": recommended_items,
            "total_estimated_cost": total_cost,
            "priority": 1 if age >= 50 else 2,
            "generated_at": datetime.now().isoformat()
        }
        
    except PatientNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"추천 정보 조회 중 오류: {str(e)}")


@router.post("/create-step1", response_model=CheckupDesignResponse)
async def create_checkup_design_step1(
    request: CheckupDesignRequest
):
    """
    STEP 1: 빠른 분석 전용 검진 설계 생성
    검진 항목 추천 없이 분석만 수행합니다 (patient_summary, analysis, survey_reflection, selected_concerns_analysis, basic_checkup_guide)
    빠른 응답을 위해 빠른 모델 사용 (GPT-4o-mini)
    """
    try:
        logger.info(f"🔍 [STEP1-분석] 요청 시작 - UUID: {request.uuid}, 선택 항목: {len(request.selected_concerns) if request.selected_concerns else 0}개")
        
        # 세션 로거 시작
        session_logger = get_session_logger()
        session_id = session_logger.start_session(
            patient_uuid=request.uuid,
            patient_name="",  # 환자 정보 조회 후 업데이트
            hospital_id=request.hospital_id
        )
        logger.info(f"🎬 [SessionLogger] 세션 시작: {session_id}")
        
        # 1. 환자 정보 조회
        patient_info = await welno_data_service.get_patient_by_uuid(request.uuid)
        if "error" in patient_info:
            raise HTTPException(status_code=404, detail=patient_info["error"])
        
        patient_name = patient_info.get("name", "환자")
        patient_age = None
        if patient_info.get("birth_date"):
            from datetime import datetime
            birth_date = datetime.fromisoformat(patient_info["birth_date"].replace("Z", "+00:00"))
            today = datetime.now()
            patient_age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        
        patient_gender = patient_info.get("gender")
        
        # 2. 병원 정보 조회 (검진 항목 포함)
        # [v10] hospital_id 자동 조회 + 일반검진 폴백
        resolved_hospital_id = request.hospital_id
        if not resolved_hospital_id:
            resolved_hospital_id = await welno_data_service.find_hospital_id_by_uuid(request.uuid)
            logger.info(f"🔍 [v10 STEP1] hospital_id 자동 조회: {resolved_hospital_id or 'None'}")

        logger.info(f"🏥 [STEP1-분석] 병원 정보 조회 시작 - hospital_id: {resolved_hospital_id}")
        hospital_info: Dict[str, Any] = {}
        if resolved_hospital_id:
            hospital_info = await welno_data_service.get_hospital_by_id(resolved_hospital_id)
        if not isinstance(hospital_info, dict) or not hospital_info or "error" in hospital_info:
            logger.warning(f"⚠️ [v10 STEP1] 병원 정보 없음 — 일반검진 폴백")
            hospital_info = _build_generic_hospital_fallback()
            resolved_hospital_id = resolved_hospital_id or hospital_info["hospital_id"]

        hospital_national_checkup = hospital_info.get("national_checkup_items")
        logger.info(f"✅ [STEP1-분석] 병원 정보 조회 완료 - {hospital_info.get('hospital_name', 'N/A')}")
        logger.info(f"📊 [STEP1-분석] 기본 검진 항목: {len(hospital_national_checkup) if hospital_national_checkup else 0}개")

        # 3. 건강 데이터 조회 (기존 방식과 동일) — resolved_hospital_id 사용
        health_data_result = await welno_data_service.get_patient_health_data(request.uuid, resolved_hospital_id)
        if "error" in health_data_result:
            logger.warning(f"⚠️ [STEP1-분석] 건강 데이터 조회 실패: {health_data_result['error']}")
            health_data = []
        else:
            health_data = health_data_result.get("health_data", [])
        logger.info(f"📊 [STEP1-분석] 건강 데이터: {len(health_data)}건")
        
        # 4. 처방전 데이터 조회 (기존 방식과 동일)
        prescription_data = []
        if not request.prescription_analysis_text:
            prescription_data_result = await welno_data_service.get_patient_prescription_data(request.uuid, resolved_hospital_id)
            if "error" in prescription_data_result:
                logger.warning(f"⚠️ [STEP1-분석] 처방전 데이터 조회 실패: {prescription_data_result['error']}")
                prescription_data = []
            else:
                prescription_data = prescription_data_result.get("prescription_data", [])
        logger.info(f"💊 [STEP1-분석] 처방전 데이터: {len(prescription_data)}건")

        # 5. 선택한 염려 항목 변환 (없으면 자동 추출)
        selected_concerns = []
        if not request.selected_concerns:
            from ....services.checkup_design.auto_concerns import auto_extract_concerns
            patient_gender = patient_info.get("gender", "M") if isinstance(patient_info, dict) else "M"
            selected_concerns = auto_extract_concerns(health_data, prescription_data, patient_gender)
            logger.info(f"🤖 [STEP1-분석] 자동 추출 concerns: {len(selected_concerns)}개")
        for concern in (request.selected_concerns or []):
            concern_dict = {
                "type": concern.type,
                "id": concern.id,
                "name": concern.name,
                "date": concern.date or concern.checkupDate,
                "value": concern.value,
                "unit": concern.unit,
                "status": concern.status,
                "location": concern.location or concern.hospitalName,
                "medication_name": concern.medicationName,
                "period": concern.period,
                "medication_text": concern.medicationText
            }
            selected_concerns.append(concern_dict)
        
        # 6. 설문 응답 정리
        survey_responses_clean = normalize_survey_responses(request.survey_responses)
        prescription_analysis_text = survey_responses_clean.pop("prescription_analysis_text", None) or request.prescription_analysis_text
        selected_medication_texts = survey_responses_clean.pop("selected_medication_texts", None) or request.selected_medication_texts
        
        # ====================================================================
        # [신규] 사용자 행동 속성 분석 및 주입
        # ====================================================================
        user_attributes = worry_service.analyze_user_attributes(
            events=request.events or [],
            survey_responses=survey_responses_clean
        )
        logger.info(f"🔍 [STEP1-분석] 사용자 행동 속성 분석 완료: {len(user_attributes)}개")
        
        # 속성 정보를 프롬프트에 주입하기 위해 survey_responses에 추가
        if user_attributes:
            survey_responses_clean['user_attributes'] = [attr.dict() for attr in user_attributes]
            
        # 7. STEP 1 프롬프트 생성 (페르소나 판정 포함)
        logger.info(
            f"🧠 [STEP1-분석] 프롬프트 입력 샘플 - patient_name={patient_name}, "
            f"patient_age={patient_age}, patient_gender={patient_gender}, "
            f"selected_concerns={len(selected_concerns)}건, "
            f"survey_responses_keys={list(survey_responses_clean.keys())}, "
            f"prescription_analysis_text={'있음' if prescription_analysis_text else '없음'}"
        )
        step1_result = await create_checkup_design_prompt_step1(
            patient_name=patient_name,
            patient_age=patient_age,
            patient_gender=patient_gender,
            health_data=health_data,
            prescription_data=prescription_data,
            selected_concerns=selected_concerns,
            survey_responses=survey_responses_clean,
            hospital_national_checkup=hospital_national_checkup,
            prescription_analysis_text=prescription_analysis_text,
            selected_medication_texts=selected_medication_texts,
            events=request.events
        )
        
        # 프롬프트와 페르소나 결과 분리
        user_message = step1_result["prompt"]
        persona_result = step1_result["persona_result"]
        structured_evidences_step1 = step1_result.get("structured_evidences", [])
        rag_evidence_context_step1 = step1_result.get("rag_evidence_context", "")
        
        # 페르소나 정보 로깅
        logger.info(f"👤 [STEP1-페르소나] Primary Persona: {persona_result['primary_persona']}")
        logger.info(f"🎯 [STEP1-페르소나] Bridge Strategy: {persona_result['bridge_strategy']}")
        logger.info(f"💬 [STEP1-페르소나] 톤앤매너: {persona_result['tone']}")
        
        # 8. 빠른 모델 선택 (STEP 1은 분석만 하므로 토큰 수 제한)
        # gpt-4o-mini 대신 Gemini Flash 사용 (빠르고 저렴한 모델)
        fast_model = getattr(settings, 'google_gemini_fast_model', 'gemini-3-flash-preview')
        max_tokens = 5000  # STEP 1은 분석만 하므로 토큰 수 제한
        
        logger.info(f"🤖 [STEP1-분석] Gemini API 호출 시작... (모델: {fast_model}, max_tokens: {max_tokens})")
        logger.info(f"📊 [STEP1-분석] 프롬프트 길이: {len(user_message)} 문자")
        
        # 검진설계 전용 키 (JERRY_PLANNING) — 미설정 시 None → gemini_service 가 default 키 사용
        planning_key = settings.google_gemini_planning_api_key or None
        gemini_request = GeminiRequest(
            prompt=user_message,
            model=fast_model,
            temperature=0.3,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
            system_instruction=CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP1,  # Phase 4: System Message 적용
            api_key=planning_key,
        )
        
        # Gemini 서비스 초기화
        logger.info(f"🔧 [STEP1-분석] Gemini 서비스 초기화 중...")
        await gemini_service.initialize()
        logger.info(f"✅ [STEP1-분석] Gemini 서비스 초기화 완료")
        
        # LLM API 호출 (llm_router: Gemini 우선, 실패 시 자동 폴백)
        logger.info(f"📡 [STEP1-분석] LLM API 호출 중...")
        gemini_api_response = await llm_router.call_api(
            gemini_request,
            save_log=True,
            patient_uuid=request.uuid,
            session_id=session_id,
            step_number="1",
            step_name="건강 분석"
        )
        logger.info(f"📥 [STEP1-분석] LLM API 응답 수신 완료")
        
        # 응답 상태 확인
        if not gemini_api_response.success:
            logger.error(f"❌ [STEP1-분석] Gemini API 호출 실패: {gemini_api_response.error}")
            raise ValueError(f"Gemini API 호출 실패: {gemini_api_response.error}")
        
        if not gemini_api_response.content:
            logger.error(f"❌ [STEP1-분석] Gemini 응답 내용이 비어있음")
            raise ValueError("Gemini 응답 내용이 비어있습니다.")
        
        # JSON 파싱 (GPTService의 유틸리티 재사용 또는 직접 파싱)
        logger.info(f"🔍 [STEP1-분석] JSON 파싱 시작...")
        try:
            # JSON 파싱 (복구 로직 포함)
            ai_response = parse_json_with_recovery(
                gemini_api_response.content,
                step_name="STEP1-분석",
                session_id=request.session_id if hasattr(request, 'session_id') else None
            )
            
            logger.info(f"✅ [STEP1-분석] JSON 파싱 성공")
            logger.info(f"📊 [STEP1-분석] 파싱된 응답 키: {list(ai_response.keys())}")
        except Exception as parse_error:
            logger.error(f"❌ [STEP1-분석] JSON 파싱 실패: {str(parse_error)}")
            logger.error(f"❌ [STEP1-분석] 원본 응답 (처음 500자): {gemini_api_response.content[:500] if gemini_api_response.content else 'None'}")
            raise ValueError(f"JSON 파싱 실패: {str(parse_error)}")
        
        # STEP 1 응답 반환 (분석 결과만)
        logger.info(f"✅ [STEP1-분석] STEP 1 완료 - 분석 결과 반환")
        
        # 응답에 session_id 포함
        ai_response['session_id'] = session_id

        # [CRITICAL FIX] 모델이 persona를 누락할 수 있으므로, 백엔드에서 계산한 정확한 값을 강제 주입
        # 이를 통해 Step 2에서 'NoneType' 오류가 발생하는 것을 원천 차단함
        if persona_result:
            ai_response['persona'] = persona_result
            logger.info(f"✅ [STEP1-분석] 백엔드 페르소나 정보 강제 주입 완료: {persona_result.get('primary_persona')}")
        
        # 📝 [LOGGING] STEP 1 프롬프트 및 응답 txt 파일 저장
        # session_dir을 try 블록 밖에서 정의하여 두 저장 모두에서 사용 가능하도록 함
        import os
        from datetime import datetime
        
        today = datetime.now().strftime("%Y%m%d")
        log_base_dir = f"logs/planning_{today}"
        session_dir = os.path.join(log_base_dir, session_id)
        os.makedirs(session_dir, exist_ok=True)
        
        # STEP 1 프롬프트 저장
        try:
            prompt_txt_file = os.path.join(session_dir, "step1_prompt.txt")
            with open(prompt_txt_file, "w", encoding="utf-8") as f:
                f.write("=" * 80 + "\n")
                f.write("STEP 1 PROMPT\n")
                f.write("=" * 80 + "\n\n")
                f.write(user_message)
                f.write("\n\n")
                f.write("=" * 80 + "\n")
                f.write("METADATA\n")
                f.write("=" * 80 + "\n")
                f.write(f"Model: {fast_model}\n")
                f.write(f"Temperature: 0.3\n")
                f.write(f"Max Tokens: {max_tokens}\n")
                f.write(f"Session ID: {session_id}\n")
                f.write(f"Timestamp: {datetime.now().isoformat()}\n")
            
            logger.info(f"💾 [STEP1] 프롬프트 txt 저장 완료: {prompt_txt_file}")
        except Exception as e:
            logger.warning(f"⚠️ [STEP1] 프롬프트 txt 저장 실패: {str(e)}")
        
        # STEP 1 응답 저장
        try:
            response_txt_file = os.path.join(session_dir, "step1_result.txt")
            with open(response_txt_file, "w", encoding="utf-8") as f:
                f.write("=" * 80 + "\n")
                f.write("STEP 1 RESPONSE\n")
                f.write("=" * 80 + "\n\n")
                f.write(gemini_api_response.content)
                f.write("\n\n")
                f.write("=" * 80 + "\n")
                f.write("PARSED JSON\n")
                f.write("=" * 80 + "\n\n")
                f.write(json.dumps(ai_response, ensure_ascii=False, indent=2))
                f.write("\n\n")
                f.write("=" * 80 + "\n")
                f.write("METADATA\n")
                f.write("=" * 80 + "\n")
                f.write(f"Response Length: {len(gemini_api_response.content) if gemini_api_response.content else 0}\n")
                f.write(f"Timestamp: {datetime.now().isoformat()}\n")
            
            logger.info(f"💾 [STEP1] 응답 txt 저장 완료: {response_txt_file}")
        except Exception as e:
            logger.warning(f"⚠️ [STEP1] 응답 txt 저장 실패: {str(e)}")
        
        # ✅ STEP1 완료 즉시 부분 저장 (재시도 가능하도록)
        try:
            save_result = await welno_data_service.save_checkup_design_request(
                uuid=request.uuid,
                hospital_id=request.hospital_id,
                selected_concerns=selected_concerns,
                survey_responses=survey_responses_clean,
                step1_result=ai_response,
                prescription_analysis_text=prescription_analysis_text,
                selected_medication_texts=selected_medication_texts,
                session_id=session_id,
                status='step1_completed'  # ✅ 부분 성공 상태
            )
            
            if save_result.get("success"):
                request_id = save_result.get('request_id')
                logger.info(f"✅ [STEP1-저장] 부분 저장 완료 - ID: {request_id}")
                # ✅ request_id를 응답에 포함하여 STEP2에서 사용
                ai_response['design_request_id'] = request_id
            else:
                logger.warning(f"⚠️ [STEP1-저장] 부분 저장 실패: {save_result.get('error')}")
        except Exception as e:
            logger.warning(f"⚠️ [STEP1-저장] 부분 저장 중 오류 (무시): {str(e)}")
        
        return CheckupDesignResponse(
            success=True,
            data=ai_response,
            message="STEP 1 분석 완료"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [STEP1-분석] 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"검진 설계 생성 중 오류: {str(e)}")


@router.get("/latest/{patient_uuid}")
async def get_latest_checkup_design(
    request: Request,
    patient_uuid: str = Path(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID")
):
    """
    최신 검진 설계 결과 조회 (조건부 요청 지원)
    설계가 완료된 경우 결과를 반환하고, 없으면 null 반환
    """
    from fastapi import Response
    import hashlib
    import json
    from datetime import datetime
    
    try:
        logger.info(f"🔍 [검진설계조회] 최신 설계 조회 - UUID: {patient_uuid}, hospital_id: {hospital_id}")
        
        design_result = await welno_data_service.get_latest_checkup_design(
            uuid=patient_uuid,
            hospital_id=hospital_id
        )
        
        if not design_result:
            logger.info(f"📭 [검진설계조회] 설계 결과 없음 - UUID: {patient_uuid}")
            return {
                "success": False,
                "data": None,
                "message": "설계 결과가 없습니다."
            }
        
        # 데이터 해시 생성 (ETag용)
        data_str = json.dumps(design_result, sort_keys=True, ensure_ascii=False)
        data_hash = hashlib.sha256(data_str.encode('utf-8')).hexdigest()
        etag = f'"{data_hash}"'
        
        # Last-Modified 헤더 (updated_at 사용)
        updated_at = design_result.get('updated_at')
        if updated_at:
            if isinstance(updated_at, str):
                last_modified = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
            else:
                last_modified = updated_at
        else:
            last_modified = datetime.now()
        
        # 조건부 요청 처리
        if request:
            if_none_match = request.headers.get('If-None-Match')
            if_modified_since = request.headers.get('If-Modified-Since')
            
            # ETag 비교 (304 Not Modified)
            if if_none_match and if_none_match == etag:
                return Response(status_code=304)
            
            # Last-Modified 비교 (304 Not Modified)
            if if_modified_since and updated_at:
                try:
                    if_modified_dt = datetime.strptime(if_modified_since, '%a, %d %b %Y %H:%M:%S %Z')
                    if last_modified <= if_modified_dt:
                        return Response(status_code=304)
                except:
                    pass  # 파싱 실패 시 무시하고 전체 데이터 반환
        
        logger.info(f"✅ [검진설계조회] 설계 결과 조회 완료")
        
        # 응답 생성 (헤더 포함)
        # ✅ design_result는 이미 welno_data_service에서 json.loads된 전체 내용
        response_data = {
            "success": True,
            "data": {
                **design_result,  # ✅ 중첩 제거: design_result가 이미 최종 데이터
                "last_update": updated_at,  # ✅ 업데이트 시간 포함
            },
            "message": "최신 설계 결과를 조회했습니다."
        }
        
        response = Response(
            content=json.dumps(response_data, ensure_ascii=False),
            media_type="application/json",
            headers={
                "ETag": etag,
                "Last-Modified": last_modified.strftime('%a, %d %b %Y %H:%M:%S GMT'),
                "Cache-Control": "private, max-age=3600",  # 1시간 캐시
            }
        )
        
        return response
        
    except Exception as e:
        logger.error(f"❌ [검진설계조회] 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"검진 설계 조회 중 오류: {str(e)}")


class DesignConsultationRequest(BaseModel):
    uuid: str = Field(..., description="환자 UUID")
    hospital_id: str = Field(..., description="병원 ID")


@router.post("/consultation-request")
async def design_consultation_request(req: DesignConsultationRequest):
    """검진설계 결과 페이지에서 상담 요청"""
    try:
        conn = await asyncpg.connect(**welno_data_service.db_config)
        row = await conn.fetchrow("""
            SELECT id, status FROM welno.welno_checkup_design_requests
            WHERE uuid = $1 AND hospital_id = $2
              AND design_result IS NOT NULL
            ORDER BY created_at DESC LIMIT 1
        """, req.uuid, req.hospital_id)

        if not row:
            await conn.close()
            raise HTTPException(status_code=404, detail="설계 결과를 찾을 수 없습니다")

        if row['status'] == 'consultation_requested':
            await conn.close()
            return {"status": "already_requested"}

        await conn.execute("""
            UPDATE welno.welno_checkup_design_requests
            SET status = 'consultation_requested', updated_at = NOW()
            WHERE id = $1
        """, row['id'])
        await conn.close()

        logger.info(f"✅ [상담요청] uuid={req.uuid}, design_id={row['id']}")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [상담요청] 오류: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="상담 요청 처리 중 오류")


@router.delete("/delete/{patient_uuid}")
async def delete_checkup_design(
    patient_uuid: str = Path(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID")
):
    """
    환자의 모든 검진 설계 요청을 삭제합니다 (새로고침 시 사용).
    """
    try:
        logger.info(f"🗑️ [검진설계] 삭제 요청 - UUID: {patient_uuid}, Hospital: {hospital_id}")
        delete_result = await welno_data_service.delete_checkup_design_requests(patient_uuid, hospital_id)
        
        if delete_result.get("success"):
            deleted_count = delete_result.get("deleted_count", 0)
            logger.info(f"✅ [검진설계] 삭제 완료 - 삭제된 건수: {deleted_count}")
            return {
                "success": True,
                "deleted_count": deleted_count,
                "message": f"{deleted_count}개의 검진 설계 요청이 삭제되었습니다."
            }
        else:
            error_msg = delete_result.get("error", "알 수 없는 오류")
            logger.warning(f"⚠️ [검진설계] 삭제 실패: {error_msg}")
            raise HTTPException(status_code=500, detail=f"검진 설계 삭제 중 오류: {error_msg}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [검진설계] 삭제 중 오류: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"검진 설계 삭제 중 오류: {str(e)}")


@router.post("/create-step2", response_model=CheckupDesignResponse)
async def create_checkup_design_step2(
    request: CheckupDesignStep2Request
):
    """
    STEP 2: 설계 및 근거 전용 검진 설계 생성
    STEP 1의 분석 결과를 받아 검진 항목을 설계하고 의학적 근거를 확보합니다.
    강력한 모델 사용 (GPT-4o)
    """
    try:
        # [v10] hospital_id 자동 조회 (함수 전체에서 사용) — fallback 분기/메인 분기 공통
        resolved_hospital_id = request.hospital_id
        if not resolved_hospital_id:
            resolved_hospital_id = await welno_data_service.find_hospital_id_by_uuid(request.uuid)
            logger.info(f"🔍 [v10 STEP2-시작] hospital_id 자동 조회: {resolved_hospital_id or 'None (폴백 예정)'}")
        logger.info(f"🔍 [STEP2-설계] 요청 시작 - UUID: {request.uuid}, STEP 1 결과 수신 완료")
        
        # STEP 1 결과를 Dict로 변환
        step1_result_dict = request.step1_result.dict()
        logger.info(f"📊 [STEP2-설계] STEP 1 결과 키: {list(step1_result_dict.keys())}")
        
        # 1. 환자 정보 조회
        patient_info = await welno_data_service.get_patient_by_uuid(request.uuid)
        if "error" in patient_info:
            raise HTTPException(status_code=404, detail=patient_info["error"])
        
        patient_name = patient_info.get("name", "환자")
        patient_age = None
        if patient_info.get("birth_date"):
            from datetime import datetime
            birth_date = datetime.fromisoformat(patient_info["birth_date"].replace("Z", "+00:00"))
            today = datetime.now()
            patient_age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        
        patient_gender = patient_info.get("gender")
        
        # [CRITICAL] 페르소나 데이터 검증 및 복구
        if not step1_result_dict.get("persona"):
            logger.warning("⚠️ [STEP2-설계] STEP 1 결과에 페르소나 정보 누락됨. 백엔드에서 재계산 시도...")
            try:
                from ....services.checkup_design.persona import determine_persona
                
                # 설문 응답 정리
                survey_res = normalize_survey_responses(request.survey_responses)
                
                # 페르소나 재계산용 데이터 조회 (1220-1237줄에서 다시 조회하지만, 여기서 먼저 필요)
                health_data_for_persona = []
                prescription_data_for_persona = []
                
                try:
                    logger.debug(f"🔍 [DEBUG] 페르소나 재계산용 데이터 조회 시작 - UUID: {request.uuid}")
                    health_result = await welno_data_service.get_patient_health_data(request.uuid, resolved_hospital_id)
                    if "error" not in health_result:
                        health_data_for_persona = health_result.get("health_data", [])
                        logger.debug(f"🔍 [DEBUG] 건강 데이터 조회 완료: {len(health_data_for_persona)}건")
                    else:
                        logger.warning(f"⚠️ [STEP2-설계] 건강 데이터 조회 실패: {health_result.get('error')}")

                    prescription_result = await welno_data_service.get_patient_prescription_data(request.uuid, resolved_hospital_id)
                    if "error" not in prescription_result:
                        prescription_data_for_persona = prescription_result.get("prescription_data", [])
                        logger.debug(f"🔍 [DEBUG] 처방전 데이터 조회 완료: {len(prescription_data_for_persona)}건")
                    else:
                        logger.warning(f"⚠️ [STEP2-설계] 처방전 데이터 조회 실패: {prescription_result.get('error')}")
                except Exception as data_fetch_error:
                    logger.warning(f"⚠️ [STEP2-설계] 페르소나 재계산용 데이터 조회 실패: {str(data_fetch_error)}")
                    logger.error(f"🔍 [DEBUG] 스택 트레이스:", exc_info=True)
                
                persona_result = determine_persona(
                    survey_responses=survey_res,
                    patient_age=patient_age,
                    health_history=health_data_for_persona,
                    selected_concerns=request.selected_concerns if hasattr(request, 'selected_concerns') else None,
                    prescription_data=prescription_data_for_persona
                )
                step1_result_dict["persona"] = persona_result
                logger.info(f"✅ [STEP2-설계] 페르소나 재계산 완료: {persona_result.get('primary_persona')}")
            except Exception as e:
                logger.error(f"❌ [STEP2-설계] 페르소나 재계산 실패: {str(e)}")
                logger.error(f"🔍 [DEBUG] 스택 트레이스:", exc_info=True)
                logger.error(f"🔍 [DEBUG] 현재 변수 상태:")
                logger.error(f"  - request.uuid: {request.uuid}")
                logger.error(f"  - request.hospital_id: {request.hospital_id}")
                logger.error(f"  - patient_age: {patient_age}")
                logger.error(f"  - survey_responses 개수: {len(request.survey_responses) if request.survey_responses else 0}")
                logger.error(f"  - selected_concerns 개수: {len(request.selected_concerns) if hasattr(request, 'selected_concerns') and request.selected_concerns else 0}")
                # 기본값 설정
                step1_result_dict["persona"] = {
                    "primary_persona": "General",
                    "type": "General", # type 필드 추가 (step2_upselling.py에서 사용)
                    "description": "일반적인 건강검진 수검자",
                    "bridge_strategy": "친절하고 이해하기 쉬운 설명",
                    "tone": "전문적이면서도 친근한 어조"
                }

        # 2. 병원 정보 조회 (검진 항목 포함) - [v10] 자동 조회 + 일반검진 폴백
        resolved_hospital_id = request.hospital_id
        if not resolved_hospital_id:
            resolved_hospital_id = await welno_data_service.find_hospital_id_by_uuid(request.uuid)
            logger.info(f"🔍 [v10 STEP2] hospital_id 자동 조회: {resolved_hospital_id or 'None'}")

        logger.info(f"🏥 [STEP2-설계] 병원 정보 조회 시작 - hospital_id: {resolved_hospital_id}")
        hospital_info: Dict[str, Any] = {}
        if resolved_hospital_id:
            hospital_info = await welno_data_service.get_hospital_by_id(resolved_hospital_id)
        if not isinstance(hospital_info, dict) or not hospital_info or "error" in hospital_info:
            logger.warning(f"⚠️ [v10 STEP2] 병원 정보 없음 — 일반검진 폴백")
            hospital_info = _build_generic_hospital_fallback()
            resolved_hospital_id = resolved_hospital_id or hospital_info["hospital_id"]

        hospital_national_checkup = hospital_info.get("national_checkup_items")
        hospital_recommended = hospital_info.get("recommended_items")
        hospital_external_checkup = hospital_info.get("external_checkup_items", [])
        logger.info(f"✅ [STEP2-설계] 병원 정보 조회 완료 - {hospital_info.get('hospital_name', 'N/A')}")
        logger.info(f"📊 [STEP2-설계] 검진 항목 통계:")
        logger.info(f"  - 기본 검진 항목: {len(hospital_national_checkup) if hospital_national_checkup else 0}개")
        logger.info(f"  - 병원 추천 항목: {len(hospital_recommended) if hospital_recommended else 0}개")
        logger.info(f"  - 외부 검사 항목: {len(hospital_external_checkup)}개")

        # 3. 건강 데이터 조회 (기존 방식과 동일) — resolved_hospital_id 사용
        health_data_result = await welno_data_service.get_patient_health_data(request.uuid, resolved_hospital_id)
        if "error" in health_data_result:
            logger.warning(f"⚠️ [STEP2-설계] 건강 데이터 조회 실패: {health_data_result['error']}")
            health_data = []
        else:
            health_data = health_data_result.get("health_data", [])
        logger.info(f"📊 [STEP2-설계] 건강 데이터: {len(health_data)}건")
        
        # 4. 처방전 데이터 조회 (기존 방식과 동일)
        prescription_data = []
        if not request.prescription_analysis_text:
            prescription_data_result = await welno_data_service.get_patient_prescription_data(request.uuid, resolved_hospital_id)
            if "error" in prescription_data_result:
                logger.warning(f"⚠️ [STEP2-설계] 처방전 데이터 조회 실패: {prescription_data_result['error']}")
                prescription_data = []
            else:
                prescription_data = prescription_data_result.get("prescription_data", [])
        logger.info(f"💊 [STEP2-설계] 처방전 데이터: {len(prescription_data)}건")

        # 5. 선택한 염려 항목 변환
        selected_concerns = []
        for concern in (request.selected_concerns or []):
            concern_dict = {
                "type": concern.type,
                "id": concern.id,
                "name": concern.name,
                "date": concern.date or concern.checkupDate,
                "value": concern.value,
                "unit": concern.unit,
                "status": concern.status,
                "location": concern.location or concern.hospitalName,
                "medication_name": concern.medicationName,
                "period": concern.period,
                "medication_text": concern.medicationText
            }
            selected_concerns.append(concern_dict)
        
        # 6. 설문 응답 정리
        survey_responses_clean = normalize_survey_responses(request.survey_responses)
        prescription_analysis_text = survey_responses_clean.pop("prescription_analysis_text", None) or request.prescription_analysis_text
        selected_medication_texts = survey_responses_clean.pop("selected_medication_texts", None) or request.selected_medication_texts
        
        # ====================================================================
        # 7. STEP 2 프롬프트 생성 및 GPT 호출 (Phase 1: 2단계 분할 전략)
        # ====================================================================
        logger.info(f"🔍 [STEP2-설계] 2단계 분할 전략 시작...")
        logger.info(f"  - STEP 2-1: Priority 1 (일반검진 주의 항목)")
        logger.info(f"  - STEP 2-2: Priority 2,3 + Strategies (업셀링)")
        
        # OpenAI 서비스 초기화 (한 번만)
        logger.info(f"🔧 [STEP2-설계] OpenAI 서비스 초기화 중...")
        await gpt_service.initialize()
        logger.info(f"✅ [STEP2-설계] OpenAI 서비스 초기화 완료")
        
        # Gemini 서비스 초기화 (한 번만)
        logger.info(f"🔧 [STEP2-설계] Gemini 서비스 초기화 중...")
        await gemini_service.initialize()
        logger.info(f"✅ [STEP2-설계] Gemini 서비스 초기화 완료")
        
        # 강력한 모델 선택 (GPT-4o -> Gemini Pro)
        powerful_model = getattr(settings, 'google_gemini_model', 'gemini-3-flash-preview')
        
        # ====================================================================
        # STEP 2-1: Priority 1 (일반검진 주의 항목)
        # ====================================================================
        import time

        # Phase 3: v2 파이프라인은 step2_1 스킵
        pipeline_version = getattr(settings, 'checkup_design_pipeline_version', 'v2')
        if pipeline_version == 'v2':
            step2_1_result = {
                "summary": step1_result_dict.get("summary", {}),
                "priority_1": step1_result_dict.get("priority_1",
                              step1_result_dict.get("basic_checkup_guide", {}))
            }
            evidences_p1 = step1_result_dict.get("_structured_evidences", [])
            rag_evidence_context_p1 = step1_result_dict.get("_rag_evidence_context", "")
            elapsed_p1 = 0
            logger.info(f"✅ [STEP2-1] SKIPPED (v2) — step1의 priority_1 직접 사용")
        else:
            # v3: 기존 3-STEP 경로 (하위 호환)
            start_time_p1 = time.time()

            # step2_1에는 UI 전용 + 중복 필드 제거 (loading_messages, basic_checkup_guide)
            step1_for_step2_1 = {k: v for k, v in step1_result_dict.items()
                                 if k not in ('loading_messages', 'basic_checkup_guide')}

            logger.info(f"📋 [STEP2-1] Priority 1 프롬프트 생성 시작...")
            user_message_p1, evidences_p1, rag_evidence_context_p1 = await create_checkup_design_prompt_step2_priority1(
                step1_result=step1_for_step2_1,
                patient_name=patient_name,
                patient_age=patient_age,
                patient_gender=patient_gender,
                health_data=health_data,
                prescription_data=prescription_data,
                selected_concerns=selected_concerns,
                survey_responses=survey_responses_clean,
                hospital_national_checkup=hospital_national_checkup,
                prescription_analysis_text=prescription_analysis_text,
                selected_medication_texts=selected_medication_texts
            )
            logger.info(f"✅ [STEP2-1] Priority 1 프롬프트 생성 완료 - 길이: {len(user_message_p1):,}자 ({len(user_message_p1)/1024:.1f}KB)")
            logger.info(f"💊 [STEP2-1] RAG Context 획득 완료 - 길이: {len(rag_evidence_context_p1):,}자")

            # 📝 [LOGGING] STEP 2-1 프롬프트 파일 저장 (사용자 요청)
            try:
                import os
                from datetime import datetime

                if request.session_id:
                    log_base_dir = f"logs/planning_{request.session_id.split('_')[0]}"
                    session_dir = os.path.join(log_base_dir, request.session_id)
                else:
                    log_base_dir = f"logs/planning_{datetime.now().strftime('%Y%m%d')}"
                    timestamp = datetime.now().strftime("%H%M%S")
                    short_uuid = request.uuid.split('-')[0]
                    session_dir = os.path.join(log_base_dir, f"{timestamp}_{short_uuid}")

                os.makedirs(session_dir, exist_ok=True)

                prompt_file_path = os.path.join(session_dir, "step2_1_prompt.txt")
                full_prompt_p1_for_log = f"{CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP2}\n\n---\n\n{user_message_p1}"
                with open(prompt_file_path, "w", encoding="utf-8") as f:
                    f.write("=" * 80 + "\n")
                    f.write("STEP 2-1 FULL PROMPT (실제 API에 전달되는 전체 내용)\n")
                    f.write("=" * 80 + "\n\n")
                    f.write("=" * 80 + "\n")
                    f.write("SYSTEM MESSAGE\n")
                    f.write("=" * 80 + "\n\n")
                    f.write(CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP2)
                    f.write("\n\n")
                    f.write("=" * 80 + "\n")
                    f.write("USER MESSAGE\n")
                    f.write("=" * 80 + "\n\n")
                    f.write(user_message_p1)
                    f.write("\n\n")
                    f.write("=" * 80 + "\n")
                    f.write("METADATA\n")
                    f.write("=" * 80 + "\n")
                    f.write(f"Model: {powerful_model}\n")
                    f.write(f"Temperature: 0.5\n")
                    f.write(f"Max Tokens: 2000\n")
                    f.write(f"Session ID: {request.session_id}\n")
                    f.write(f"Timestamp: {datetime.now().isoformat()}\n")

                logger.info(f"💾 [STEP2-1] 프롬프트 txt 저장 완료: {prompt_file_path}")

            except Exception as e:
                logger.warning(f"⚠️ [STEP2-1] 프롬프트 파일 저장 실패: {str(e)}")

            logger.info(f"🤖 [STEP2-1] Gemini API 호출 중... (모델: {powerful_model})")

            # 검진설계 전용 키 (JERRY_PLANNING)
            planning_key_p1 = settings.google_gemini_planning_api_key or None
            gemini_request_p1 = GeminiRequest(
                prompt=user_message_p1,
                model=powerful_model,
                temperature=0.5,
                max_tokens=5000,
                response_format={"type": "json_object"},
                system_instruction=CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP2,
                api_key=planning_key_p1,
            )

            max_retries = 2
            step2_1_result = None
            gemini_response_p1 = None

            for retry_count in range(max_retries):
                try:
                    if retry_count > 0:
                        logger.warning(f"🔄 [STEP2-1] 재시도 {retry_count}/{max_retries-1}")

                    gemini_response_p1 = await llm_router.call_api(
                        gemini_request_p1,
                        save_log=True,
                        patient_uuid=request.uuid,
                        session_id=request.session_id if hasattr(request, 'session_id') and request.session_id else None,
                        step_number="2-1",
                        step_name="Priority 1 - 일반검진 주의 항목"
                    )
                    elapsed_p1 = time.time() - start_time_p1
                    logger.info(f"✅ [STEP2-1] Gemini 응답 완료 - {elapsed_p1:.1f}초 (시도 {retry_count+1}/{max_retries})")

                    if not gemini_response_p1.success:
                        logger.error(f"❌ [STEP2-1] Gemini 호출 실패: {gemini_response_p1.error}")
                        if retry_count == max_retries - 1:
                            raise ValueError(f"STEP 2-1 실패: {gemini_response_p1.error}")
                        continue

                    step2_1_result = parse_json_with_recovery(
                        gemini_response_p1.content,
                        step_name="STEP2-1",
                        session_id=request.session_id if hasattr(request, 'session_id') else None
                    )
                    logger.info(f"✅ [STEP2-1] JSON 파싱 성공 - 키: {list(step2_1_result.keys())}")
                    break

                except ValueError as ve:
                    if "응답 불완전" in str(ve) or "응답이 너무 짧음" in str(ve):
                        logger.warning(f"⚠️ [STEP2-1] 응답 불완전 감지: {str(ve)}")
                        if retry_count == max_retries - 1:
                            logger.error(f"❌ [STEP2-1] 재시도 {max_retries}회 모두 실패")
                            raise
                        continue
                    else:
                        raise

            if step2_1_result is None:
                raise ValueError(f"STEP 2-1 실패: {max_retries}회 재시도 후에도 성공하지 못함")
        
            # 📝 [LOGGING] STEP 2-1 응답 txt 파일 저장 (성공 시)
            try:
                response_txt_file = os.path.join(session_dir, "step2_1_result.txt")
                with open(response_txt_file, "w", encoding="utf-8") as f:
                    f.write("=" * 80 + "\n")
                    f.write("STEP 2-1 RESPONSE (원본)\n")
                    f.write("=" * 80 + "\n\n")
                    f.write(gemini_response_p1.content)
                    f.write("\n\n")
                    f.write("=" * 80 + "\n")
                    f.write("STEP 2-1 RESPONSE (파싱된 JSON)\n")
                    f.write("=" * 80 + "\n\n")
                    f.write(json.dumps(step2_1_result, ensure_ascii=False, indent=2))
                    f.write("\n\n")
                    f.write("=" * 80 + "\n")
                    f.write("METADATA\n")
                    f.write("=" * 80 + "\n")
                    f.write(f"Response Length: {len(gemini_response_p1.content) if gemini_response_p1.content else 0}\n")
                    f.write(f"Timestamp: {datetime.now().isoformat()}\n")

                logger.info(f"💾 [STEP2-1] 응답 txt 저장 완료: {response_txt_file}")
            except Exception as e:
                logger.warning(f"⚠️ [STEP2-1] 응답 txt 저장 실패: {str(e)}")

        # ====================================================================
        # STEP 2-2: Priority 2,3 + Strategies (업셀링)
        # ====================================================================
        start_time_p2 = time.time()
        
        # RAG 엔진 획득
        rag_engine = await rag_service.init_rag_engine()
        
        # Step 2-2 호출을 위한 요청 객체 구성 (step2_upselling.py 호환)
        from types import SimpleNamespace
        upselling_request = SimpleNamespace(
            patient_name=patient_name,
            birth_date=patient_age, # 나이(int)로 전달
            gender=patient_gender,
            selected_concerns=selected_concerns,
            survey_responses=survey_responses_clean,
            hospital_recommended_items=hospital_recommended,
            hospital_external_checkup_items=hospital_external_checkup,
            hospital_national_checkup_items=hospital_national_checkup  # [추가] 중복 방지용
        )

        # step2_2: LLM용 3필드 + Python 추출용 3필드만 전달 (나머지 ~7KB 절감)
        _step2_2_keep = ('analysis', 'chronic_analysis', 'concern_vs_reality',
                         'persona', 'risk_profile', 'persona_conflict_summary')
        step1_for_step2_2 = {k: v for k, v in step1_result_dict.items()
                             if k in _step2_2_keep}

        logger.info(f"📋 [STEP2-2] Upselling 프롬프트 생성 시작...")
        user_message_p2, evidences_p2, rag_context_p2 = await create_checkup_design_prompt_step2_upselling(
            request=upselling_request,
            step1_result=step1_for_step2_2,
            step2_1_summary=json.dumps(step2_1_result, ensure_ascii=False, indent=2), # JSON 문자열로 변환하여 전달
            rag_service_instance=rag_engine,
            prev_rag_context=rag_evidence_context_p1
        )
        logger.info(f"✅ [STEP2-2] Upselling 프롬프트 생성 완료 - 길이: {len(user_message_p2):,}자 ({len(user_message_p2)/1024:.1f}KB)")
        
        # 세일즈 작문(Upselling)은 GPT-4o가 더 우수하므로 여기서는 OpenAI 사용
        openai_model = getattr(settings, 'openai_model', 'gpt-4o')
        
        # 📝 [LOGGING] STEP 2-2 프롬프트 파일 저장 (추가)
        try:
            # 앞서 생성된 session_dir 사용
            prompt_file_path_p2 = os.path.join(session_dir, "step2_2_prompt.txt")
            with open(prompt_file_path_p2, "w", encoding="utf-8") as f:
                f.write("=" * 80 + "\n")
                f.write("STEP 2-2 FULL PROMPT (실제 API에 전달되는 전체 내용)\n")
                f.write("=" * 80 + "\n\n")
                f.write("=" * 80 + "\n")
                f.write("SYSTEM MESSAGE\n")
                f.write("=" * 80 + "\n\n")
                f.write(CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP2)
                f.write("\n\n")
                f.write("=" * 80 + "\n")
                f.write("USER MESSAGE\n")
                f.write("=" * 80 + "\n\n")
                f.write(user_message_p2)
                f.write("\n\n")
                f.write("=" * 80 + "\n")
                f.write("METADATA\n")
                f.write("=" * 80 + "\n")
                f.write(f"Model: {openai_model}\n")
                f.write(f"Temperature: 0.5\n")
                f.write(f"Max Tokens: 3000\n")
                f.write(f"Session ID: {request.session_id if hasattr(request, 'session_id') and request.session_id else 'N/A'}\n")
                f.write(f"Timestamp: {datetime.now().isoformat()}\n")
            logger.info(f"💾 [STEP2-2] 프롬프트 txt 저장 완료: {prompt_file_path_p2}")
        except Exception as e:
            logger.warning(f"⚠️ [STEP2-2] 프롬프트 txt 저장 실패: {str(e)}")
        logger.info(f"🤖 [STEP2-2] GPT API 호출 중... (모델: {openai_model})")
        
        gemini_request_p2 = GeminiRequest(
            prompt=user_message_p2,
            model=settings.google_gemini_model,
            temperature=0.5,
            max_tokens=5000,  # Upselling (multi-year + strategies 대응)
            response_format={"type": "json_object"},
            system_instruction=CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP2,
        )

        gpt_response_p2 = await llm_router.call_api(
            gemini_request_p2,
            endpoint="checkup_design",
            save_log=True,
            patient_uuid=request.uuid,
            session_id=request.session_id if hasattr(request, 'session_id') and request.session_id else None,
            step_number="2-2",
            step_name="Priority 2, 3 - Upselling 전략",
        )
        elapsed_p2 = time.time() - start_time_p2
        logger.info(f"✅ [STEP2-2] GPT 응답 완료 - {elapsed_p2:.1f}초")
        
        if not gpt_response_p2.success:
            logger.error(f"❌ [STEP2-2] GPT 호출 실패: {gpt_response_p2.error}")
            # STEP 2-1 결과라도 반환 (부분 성공)
            logger.warning(f"⚠️ [STEP2-2] 부분 성공 - Priority 1만 반환")
            ai_response = step2_1_result
            structured_evidences = evidences_p1
        else:
            # JSON 파싱 (복구 로직 포함)
            try:
                step2_2_result = parse_json_with_recovery(
                    gpt_response_p2.content,
                    step_name="STEP2-2",
                    session_id=request.session_id if hasattr(request, 'session_id') else None
                )
                logger.info(f"✅ [STEP2-2] JSON 파싱 성공 - 키: {list(step2_2_result.keys())}")
                
                # 📝 [LOGGING] STEP 2-2 결과 JSON 파일 저장 제거 (txt만 사용)
                
                # 📝 [LOGGING] STEP 2-2 응답 txt 파일 저장
                try:
                    response_txt_file_p2 = os.path.join(session_dir, "step2_2_result.txt")
                    with open(response_txt_file_p2, "w", encoding="utf-8") as f:
                        f.write("=" * 80 + "\n")
                        f.write("STEP 2-2 RESPONSE (원본)\n")
                        f.write("=" * 80 + "\n\n")
                        f.write(gpt_response_p2.content)
                        f.write("\n\n")
                        f.write("=" * 80 + "\n")
                        f.write("STEP 2-2 RESPONSE (파싱된 JSON)\n")
                        f.write("=" * 80 + "\n\n")
                        f.write(json.dumps(step2_2_result, ensure_ascii=False, indent=2))
                        f.write("\n\n")
                        f.write("=" * 80 + "\n")
                        f.write("METADATA\n")
                        f.write("=" * 80 + "\n")
                        f.write(f"Response Length: {len(gpt_response_p2.content) if gpt_response_p2.content else 0}\n")
                        f.write(f"Timestamp: {datetime.now().isoformat()}\n")
                    
                    logger.info(f"💾 [STEP2-2] 응답 txt 저장 완료: {response_txt_file_p2}")
                except Exception as e:
                    logger.warning(f"⚠️ [STEP2-2] 응답 txt 저장 실패: {str(e)}")
                
                # 결과 병합
                logger.info(f"🔗 [STEP2] 결과 병합 중...")
                ai_response = {
                    **step2_1_result,  # summary, priority_1
                    **step2_2_result   # priority_2, priority_3, strategies, doctor_comment
                }
                structured_evidences = evidences_p1 + evidences_p2
                logger.info(f"✅ [STEP2] 결과 병합 완료")
                
            except Exception as e:
                logger.error(f"❌ [STEP2-2] JSON 파싱 실패: {str(e)}")
                # STEP 2-1 결과라도 반환
                logger.warning(f"⚠️ [STEP2-2] 부분 성공 - Priority 1만 반환")
                ai_response = step2_1_result
                structured_evidences = evidences_p1
        
        # 전체 소요 시간 로그
        total_elapsed = elapsed_p1 + elapsed_p2
        logger.info(f"⏱️ [STEP2] 총 소요 시간: {total_elapsed:.1f}초 (P1: {elapsed_p1:.1f}초, P2: {elapsed_p2:.1f}초)")
        logger.info(f"📊 [STEP2] 최종 응답 키: {list(ai_response.keys()) if ai_response else 'None'}")
        
        # ====================================================================
        # 8. 응답 유효성 확인 (기존과 동일)
        # ====================================================================
        if not ai_response:
            logger.error(f"❌ [STEP2-설계] 응답 내용이 비어있음")
            raise ValueError("응답 내용이 비어있습니다.")
        
        # STEP 1과 STEP 2 결과 병합
        logger.info(f"🔗 [STEP2-설계] STEP 1과 STEP 2 결과 병합 중...")
        merged_result = merge_checkup_design_responses(
            step1_result_dict, 
            ai_response,
            hospital_recommended=hospital_recommended,  # [추가] 설명 보완용 데이터 전달
            hospital_external_checkup=hospital_external_checkup  # [추가] 프리미엄 항목 데이터 전달
        )
        
        # 구조화된 RAG 에비던스 추가 (TODO-16, TODO-18)
        merged_result["rag_evidences"] = structured_evidences
        logger.info(f"📚 [STEP2-설계] RAG 에비던스 추가: {len(structured_evidences)}개")
        
        logger.info(f"✅ [STEP2-설계] 병합 완료 - 최종 결과 키: {list(merged_result.keys())}")
        
        # ✅ STEP2 완료 시 상태 업데이트 (STEP1에서 받은 design_request_id 사용)
        design_request_id = step1_result_dict.get('design_request_id')
        try:
            if design_request_id:
                # 기존 요청 업데이트
                update_result = await welno_data_service.update_checkup_design_request(
                    request_id=design_request_id,
                    step2_result=ai_response,
                    design_result=merged_result,
                    status='step2_completed'  # ✅ 완전 성공
                )
                if update_result.get("success"):
                    logger.info(f"✅ [STEP2-저장] 상태 업데이트 완료 - ID: {design_request_id}")
                else:
                    logger.warning(f"⚠️ [STEP2-저장] 상태 업데이트 실패: {update_result.get('error')}")
            else:
                # design_request_id가 없으면 새로 저장 (폴백)
                save_result = await welno_data_service.save_checkup_design_request(
                    uuid=request.uuid,
                    hospital_id=request.hospital_id,
                    selected_concerns=selected_concerns,
                    survey_responses=survey_responses_clean,
                    step1_result=step1_result_dict,
                    step2_result=ai_response,
                    design_result=merged_result,
                    session_id=request.session_id,
                    status='step2_completed'
                )
                if save_result.get("success"):
                    logger.info(f"✅ [STEP2-저장] 새로 저장 완료 - ID: {save_result.get('request_id')}")
                else:
                    logger.warning(f"⚠️ [STEP2-저장] 저장 실패: {save_result.get('error')}")
        except Exception as e:
            logger.warning(f"⚠️ [STEP2-저장] 저장 중 오류 (무시): {str(e)}")
        
        # STEP 2 응답 반환 (설계 및 근거 결과)
        logger.info(f"✅ [STEP2-설계] STEP 2 완료 - 설계 및 근거 결과 반환")
        logger.info(f"📦 [STEP2-설계] 반환 데이터 키: {list(merged_result.keys())}")
        
        # 세션 완료 마킹
        if request.session_id:
            try:
                session_logger = get_session_logger()
                session_logger.complete_session(request.uuid, request.session_id)
                logger.info(f"🏁 [SessionLogger] 세션 완료: {request.session_id}")
            except Exception as e:
                logger.warning(f"⚠️ [SessionLogger] 세션 완료 실패: {str(e)}")
        
        return CheckupDesignResponse(
            success=True,
            data=merged_result,  # ✅ ai_response → merged_result로 수정!
            message="STEP 2 설계 및 근거 확보 완료"
        )
        
    except HTTPException:
        raise
    except ValueError as ve:
        # ✅ JSON 파싱 에러 (불완전 응답) - STEP1 상태 유지
        logger.error(f"❌ [STEP2-설계] JSON 파싱 오류: {str(ve)}", exc_info=True)
        
        # design_request_id가 있으면 에러 상태 저장
        try:
            step1_result_dict = request.step1_result.dict() if hasattr(request, 'step1_result') else {}
            design_request_id = step1_result_dict.get('design_request_id')
            if design_request_id:
                await welno_data_service.update_checkup_design_request(
                    request_id=design_request_id,
                    status='step1_completed',  # 재시도 가능 상태 유지
                    error_stage='step2_parsing',
                    error_message=f"JSON 파싱 실패: {str(ve)[:500]}"
                )
                logger.info(f"✅ [STEP2-에러저장] 에러 상태 저장 - ID: {design_request_id}")
        except Exception as save_error:
            logger.warning(f"⚠️ [STEP2-에러저장] 에러 상태 저장 실패: {str(save_error)}")
        
        raise HTTPException(status_code=500, detail=f"응답 파싱 오류: {str(ve)}")
        
    except Exception as e:
        # ✅ 기타 에러 - 실패 상태 저장
        logger.error(f"❌ [STEP2-설계] 오류 발생: {str(e)}", exc_info=True)
        
        # design_request_id가 있으면 실패 상태 저장
        try:
            step1_result_dict = request.step1_result.dict() if hasattr(request, 'step1_result') else {}
            design_request_id = step1_result_dict.get('design_request_id')
            if design_request_id:
                await welno_data_service.update_checkup_design_request(
                    request_id=design_request_id,
                    status='failed',
                    error_stage='step2',
                    error_message=str(e)[:500]
                )
                logger.info(f"✅ [STEP2-에러저장] 실패 상태 저장 - ID: {design_request_id}")
        except Exception as save_error:
            logger.warning(f"⚠️ [STEP2-에러저장] 실패 상태 저장 실패: {str(save_error)}")
        
        raise HTTPException(status_code=500, detail=f"검진 설계 생성 중 오류: {str(e)}")


def merge_checkup_design_responses(
    step1_result: Dict[str, Any], 
    step2_result: Dict[str, Any],
    hospital_recommended: Optional[List[Dict[str, Any]]] = None,
    hospital_external_checkup: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    STEP 1 결과와 STEP 2 결과를 병합하여 기존 형식과 동일한 최종 JSON 생성
    
    Args:
        step1_result: STEP 1 분석 결과
        step2_result: STEP 2 설계 결과
        hospital_recommended: 병원 추천 항목 리스트 (설명 보완용 Fallback 데이터)
        hospital_external_checkup: 병원 외부/프리미엄 항목 리스트 (설명 보완용 Fallback 데이터)
    
    Returns:
        병합된 최종 결과
    """
    logger.info(f"🔗 [병합] STEP 1과 STEP 2 결과 병합 시작...")
    
    # step1_result와 step2_result가 딕셔너리인지 확인
    if not isinstance(step1_result, dict):
        logger.error(f"❌ [병합] STEP 1 결과가 딕셔너리가 아님: {type(step1_result)}")
        logger.error(f"❌ [병합] STEP 1 결과 내용: {step1_result}")
        raise ValueError(f"STEP 1 결과 형식 오류: 딕셔너리가 아닌 {type(step1_result)}")
    
    if not isinstance(step2_result, dict):
        logger.error(f"❌ [병합] STEP 2 결과가 딕셔너리가 아님: {type(step2_result)}")
        logger.error(f"❌ [병합] STEP 2 결과 내용: {step2_result}")
        raise ValueError(f"STEP 2 결과 형식 오류: 딕셔너리가 아닌 {type(step2_result)}")
    
    logger.info(f"📊 [병합] STEP 1 키: {list(step1_result.keys())}")
    logger.info(f"📊 [병합] STEP 2 키: {list(step2_result.keys())}")
    
    # 안전한 딕셔너리 접근 헬퍼 함수
    def safe_get(data: dict, key: str, default):
        """안전하게 딕셔너리에서 값을 가져옵니다."""
        if not isinstance(data, dict):
            logger.error(f"❌ [병합] safe_get: data가 딕셔너리가 아님: {type(data)}")
            return default
        value = data.get(key, default)
        # 값이 딕셔너리여야 하는 경우 검증
        if key in ["basic_checkup_guide", "summary"] and value and not isinstance(value, dict):
            logger.warning(f"⚠️ [병합] {key}가 딕셔너리가 아님: {type(value)}, 기본값 사용")
            return default if isinstance(default, dict) else {}
        if key in ["selected_concerns_analysis", "strategies", "recommended_items"] and value and not isinstance(value, list):
            logger.warning(f"⚠️ [병합] {key}가 리스트가 아님: {type(value)}, 기본값 사용")
            return default if isinstance(default, list) else []
        return value
    
    # 최종 결과 구성 (기존 형식과 동일)
    try:
        merged_result = {
            # STEP 1에서 온 필드들
            "patient_summary": safe_get(step1_result, "patient_summary", ""),
            "analysis": safe_get(step1_result, "analysis", ""),
            "risk_profile": safe_get(step1_result, "risk_profile", []),
            "chronic_analysis": safe_get(step1_result, "chronic_analysis", {}),
            "survey_reflection": safe_get(step1_result, "survey_reflection", ""),
            "selected_concerns_analysis": safe_get(step1_result, "selected_concerns_analysis", []),
            "basic_checkup_guide": safe_get(step1_result, "basic_checkup_guide", {}),
            
            # STEP 2에서 온 필드들
            "summary": safe_get(step2_result, "summary", {}),
            "priority_1": safe_get(step2_result, "priority_1", None) or safe_get(step1_result, "priority_1", None) or safe_get(step1_result, "basic_checkup_guide", {}),  # v2: step1 passthrough, v3: step2_1, fallback: basic_checkup_guide
            "priority_2": safe_get(step2_result, "priority_2", {}),  # ✅ 추가!
            "priority_3": safe_get(step2_result, "priority_3", {}),  # ✅ 추가!
            "strategies": safe_get(step2_result, "strategies", []),
            "recommended_items": safe_get(step2_result, "recommended_items", []),
            "doctor_comment": safe_get(step2_result, "doctor_comment", ""),
            "total_count": safe_get(step2_result, "total_count", 0)
        }
    except Exception as e:
        logger.error(f"❌ [병합] merged_result 생성 중 오류: {str(e)}")
        logger.error(f"❌ [병합] step1_result 타입: {type(step1_result)}")
        logger.error(f"❌ [병합] step2_result 타입: {type(step2_result)}")
        raise
    
    # priority_1.focus_items가 없으면 basic_checkup_guide.focus_items를 사용
    try:
        summary = merged_result.get("summary", {})
        if isinstance(summary, dict):
            priority_1 = summary.get("priority_1", {})
            if isinstance(priority_1, dict):
                if priority_1.get("focus_items") is None:
                    basic_checkup_guide = merged_result.get("basic_checkup_guide", {})
                    if isinstance(basic_checkup_guide, dict):
                        basic_focus_items = basic_checkup_guide.get("focus_items", [])
                        if basic_focus_items:
                            if "priority_1" not in summary:
                                summary["priority_1"] = {}
                            summary["priority_1"]["focus_items"] = basic_focus_items
                            logger.info(f"📝 [병합] basic_checkup_guide.focus_items를 priority_1.focus_items로 복사: {len(basic_focus_items)}개")
    except Exception as e:
        logger.warning(f"⚠️ [병합] priority_1.focus_items 복사 중 오류 (무시): {str(e)}")
    
    # Post-processing: priority_1 일관성 검증 및 자동 보정 (TODO-5, TODO-6)
    merged_result = validate_and_fix_priority1(merged_result)
    
    # 🔄 Priority 구조 → recommended_items 변환 (프론트엔드 호환성)
    merged_result = convert_priorities_to_recommended_items(
        merged_result, 
        hospital_recommended, 
        hospital_external_checkup
    )
    
    logger.info(f"✅ [병합] 병합 완료 - 최종 결과 키: {list(merged_result.keys())}")
    
    return merged_result


def convert_priorities_to_recommended_items(
    result: Dict[str, Any], 
    hospital_recommended: Optional[List[Dict[str, Any]]] = None,
    hospital_external_checkup: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Priority 구조(priority_1, priority_2, priority_3)를 recommended_items 형식으로 변환
    프론트엔드 호환성을 위한 변환 함수
    
    Args:
        result: 변환할 결과 딕셔너리
        hospital_recommended: 설명 보완을 위한 병원 추천 항목 데이터 (Fallback)
        hospital_external_checkup: 설명 보완을 위한 병원 외부/프리미엄 항목 데이터 (Fallback)
    """
    logger.info("🔄 [변환] Priority → recommended_items 변환 시작...")
    
    recommended_items = []
    
    # [Fallback 준비] DB 항목 매핑 생성
    db_item_map = {}
    
    # 1. 병원 추천 항목 매핑
    if hospital_recommended:
        try:
            for item in hospital_recommended:
                if isinstance(item, dict):
                    name = item.get('name') or item.get('item_name')
                    if name:
                        db_item_map[name] = item
                elif isinstance(item, str):
                    db_item_map[item] = {"name": item}
        except Exception as e:
            logger.warning(f"⚠️ [변환] DB 항목 매핑 중 오류 (Recommended): {str(e)}")

    # 2. 병원 외부/프리미엄 항목 매핑 (추가)
    if hospital_external_checkup:
        try:
            for item in hospital_external_checkup:
                if isinstance(item, dict):
                    name = item.get('item_name') or item.get('name')
                    if name:
                        db_item_map[name] = item
        except Exception as e:
            logger.warning(f"⚠️ [변환] DB 항목 매핑 중 오류 (External): {str(e)}")

    # 헬퍼 함수: 설명 및 이유 가져오기 (Strategy -> DB Fallback -> Default)
    def get_item_details(item_name, strategy_map):
        strategy = strategy_map.get(item_name, {})
        doctor_rec = strategy.get("doctor_recommendation", {})
        
        # 1. Strategy에서 가져오기
        description = (doctor_rec.get("reason", "") + " " + doctor_rec.get("evidence", "")).strip()
        reason = doctor_rec.get("message", "").strip()
        
        # 2. Fallback: 설명이 없으면 DB 데이터 조회
        if not description:
            db_item = db_item_map.get(item_name)
            if db_item:
                # DB의 description, summary, why_important 등을 순차적으로 확인
                description = (
                    db_item.get('description') or 
                    db_item.get('summary') or 
                    db_item.get('why_important') or 
                    ""
                ).strip()
        
        # 3. Default: 여전히 없으면 기본 메시지
        if not description:
            description = "전문의와의 상담을 통해 검사 필요성을 확인하시기 바랍니다."
            
        if not reason:
            reason = "건강 상태 확인을 위해 권장되는 항목입니다."
            
        return description, reason

    # Priority 1: 일반검진 주의 항목 (최상위 또는 summary 내부)
    priority_1 = result.get("priority_1") or result.get("summary", {}).get("priority_1", {})
    if isinstance(priority_1, dict) and priority_1.get("items"):
        category_item = {
            "category": priority_1.get("title", "이번 검진 시 유의 깊게 보실 항목이에요"),
            "category_en": "Priority 1",
            "itemCount": len(priority_1.get("items", [])),
            "items": [],
            "doctor_recommendation": {
                "has_recommendation": True,
                "message": priority_1.get("description", "")
            },
            "defaultExpanded": True,
            "priorityLevel": 1
        }
        
        # focus_items를 items로 변환
        for focus_item in priority_1.get("focus_items", []):
            if isinstance(focus_item, dict):
                category_item["items"].append({
                    "name": focus_item.get("name", ""),
                    "description": focus_item.get("why_important", ""),
                    "reason": focus_item.get("check_point", ""),
                    "priority": 1,
                    "recommended": True
                })
        
        recommended_items.append(category_item)
        logger.info(f"📝 [변환] Priority 1 변환 완료: {category_item['itemCount']}개")
    
    # Priority 2: 병원 추천 정밀 검진 (최상위 또는 summary 내부)
    priority_2 = result.get("priority_2") or result.get("summary", {}).get("priority_2", {})
    if isinstance(priority_2, dict) and priority_2.get("items"):
        category_item = {
            "category": priority_2.get("title", "병원에서 추천하는 정밀 검진"),
            "category_en": "Priority 2",
            "itemCount": len(priority_2.get("items", [])),
            "items": [],
            "doctor_recommendation": {
                "has_recommendation": True,
                "message": priority_2.get("description", "")
            },
            "defaultExpanded": False
        }
        
        # strategies에서 해당 항목의 상세 정보 찾기
        strategies = result.get("strategies", [])
        strategy_map = {s.get("target"): s for s in strategies if isinstance(s, dict)}
        
        for item_name in priority_2.get("items", []):
            description, reason = get_item_details(item_name, strategy_map)
            
            category_item["items"].append({
                "name": item_name,
                "description": description,
                "reason": reason,
                "priority": 2,
                "recommended": True
            })
        
        recommended_items.append(category_item)
        logger.info(f"📝 [변환] Priority 2 변환 완료: {category_item['itemCount']}개")
    
    # Priority 3: 선택 검진 항목 (최상위 또는 summary 내부)
    priority_3 = result.get("priority_3") or result.get("summary", {}).get("priority_3", {})
    if isinstance(priority_3, dict) and priority_3.get("items"):
        category_item = {
            "category": priority_3.get("title", "선택 검진 항목"),
            "category_en": "Priority 3",
            "itemCount": len(priority_3.get("items", [])),
            "items": [],
            "doctor_recommendation": {
                "has_recommendation": True,
                "message": priority_3.get("description", "")
            },
            "defaultExpanded": False
        }
        
        # strategies에서 해당 항목의 상세 정보 찾기
        strategies = result.get("strategies", [])
        strategy_map = {s.get("target"): s for s in strategies if isinstance(s, dict)}
        
        for item_name in priority_3.get("items", []):
            description, reason = get_item_details(item_name, strategy_map)
            
            category_item["items"].append({
                "name": item_name,
                "description": description,
                "reason": reason,
                "priority": 3,
                "recommended": True
            })
        
        recommended_items.append(category_item)
        logger.info(f"📝 [변환] Priority 3 변환 완료: {category_item['itemCount']}개")
    
    # recommended_items 업데이트
    result["recommended_items"] = recommended_items
    result["total_count"] = sum(cat["itemCount"] for cat in recommended_items)
    
    logger.info(f"✅ [변환] 변환 완료 - {len(recommended_items)}개 카테고리, 총 {result['total_count']}개 항목")
    
    return result


def validate_and_fix_priority1(result: Dict[str, Any]) -> Dict[str, Any]:
    """
    priority_1 일관성 검증 및 자동 보정 (TODO-5, TODO-6)
    
    1. items와 focus_items 항목명 일치 검증
    2. 누락된 focus_items 자동 생성
    """
    logger.info("🔍 [검증] priority_1 일관성 검증 시작...")
    
    summary = result.get("summary", {})
    if not isinstance(summary, dict):
        return result
    
    priority_1 = summary.get("priority_1", {})
    if not isinstance(priority_1, dict):
        return result
    
    items = priority_1.get("items", [])
    focus_items = priority_1.get("focus_items", [])
    
    if not items:
        logger.warning("⚠️ [검증] priority_1.items가 비어있음")
        return result
    
    # 항목명 정규화 매핑 (TODO-5)
    ITEM_NAME_MAPPING = {
        "혈압": "혈압측정",
        "혈당": "혈당검사",
        "허리둘레": "신체계측",
        "체중": "신체계측",
        "비만": "신체계측",
        "간기능": "혈액검사",
        "신장기능": "혈액검사",
        "콜레스테롤": "혈액검사",
    }
    
    # 1. items 정규화
    normalized_items = []
    for item in items:
        normalized = ITEM_NAME_MAPPING.get(item, item)
        normalized_items.append(normalized)
        if normalized != item:
            logger.info(f"📝 [검증] 항목명 정규화: '{item}' → '{normalized}'")
    
    priority_1["items"] = normalized_items
    
    # 2. focus_items 항목명 추출
    focus_item_names = [fi.get("item_name", "") for fi in focus_items if isinstance(fi, dict)]
    
    # 3. 누락된 항목 찾기 (TODO-6)
    missing_items = []
    for item in normalized_items:
        if item not in focus_item_names:
            missing_items.append(item)
            logger.warning(f"⚠️ [검증] focus_items에 누락된 항목: '{item}'")
    
    # 4. 누락된 focus_items 자동 생성
    for missing_item in missing_items:
        # 기본 템플릿으로 focus_item 생성
        new_focus_item = {
            "item_name": missing_item,
            "why_important": f"{missing_item} 항목은 과거 검진 또는 문진 결과를 고려할 때 주의 깊게 확인이 필요합니다.",
            "check_point": f"{missing_item}의 수치와 변화 추이를 확인하세요."
        }
        focus_items.append(new_focus_item)
        logger.info(f"📝 [검증] focus_item 자동 생성: '{missing_item}'")
    
    priority_1["focus_items"] = focus_items
    
    logger.info(f"✅ [검증] priority_1 검증 완료 - items: {len(normalized_items)}개, focus_items: {len(focus_items)}개")
    
    return result


# ============================================================
# 검진설계 복구 API (재시도 및 미완료 조회)
# ============================================================

@router.get("/incomplete/{patient_uuid}")
async def get_incomplete_checkup_design(
    patient_uuid: str = Path(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID")
):
    """
    미완료 검진 설계 요청 조회 (step1_completed 상태)
    STEP1만 완료되고 STEP2가 실패한 경우를 조회합니다.
    """
    try:
        logger.info(f"🔍 [미완료조회] 요청 - UUID: {patient_uuid}, Hospital: {hospital_id}")
        
        incomplete_data = await welno_data_service.get_incomplete_checkup_design(
            uuid=patient_uuid,
            hospital_id=hospital_id
        )
        
        if incomplete_data:
            logger.info(f"✅ [미완료조회] 발견 - ID: {incomplete_data['id']}")
            return {
                "success": True,
                "data": incomplete_data,
                "message": "미완료 검진 설계를 찾았습니다."
            }
        else:
            logger.info(f"📭 [미완료조회] 없음 - UUID: {patient_uuid}")
            return {
                "success": False,
                "data": None,
                "message": "미완료 검진 설계가 없습니다."
            }
            
    except Exception as e:
        logger.error(f"❌ [미완료조회] 오류: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"미완료 조회 중 오류: {str(e)}")


@router.post("/retry/{request_id}")
async def retry_checkup_design(
    request_id: int = Path(..., description="검진설계 요청 ID")
):
    """
    미완료 검진 설계 재시도
    step1_completed 상태의 요청을 STEP2부터 재실행합니다.
    """
    try:
        logger.info(f"🔄 [재시도] 요청 - ID: {request_id}")
        logger.debug(f"🔍 [DEBUG] DB 연결 설정: host={welno_data_service.db_config.get('host')}, port={welno_data_service.db_config.get('port')}, database={welno_data_service.db_config.get('database')}")
        
        # 1. 요청 정보 조회
        conn = await asyncpg.connect(**welno_data_service.db_config)
        query = """
            SELECT uuid, hospital_id, step1_result, selected_concerns, 
                   survey_responses, session_id, status
            FROM welno.welno_checkup_design_requests
            WHERE id = $1 AND status = 'step1_completed'
        """
        row = await conn.fetchrow(query, request_id)
        await conn.close()
        
        if not row:
            logger.warning(f"⚠️ [재시도] 재시도 불가 - ID: {request_id}")
            raise HTTPException(
                status_code=404,
                detail="재시도 가능한 요청이 없습니다. (이미 완료되었거나 존재하지 않음)"
            )
        
        # 2. STEP2 요청 구성
        from ...models.checkup_design import CheckupDesignStep2Request, Step1Result
        
        step1_result_dict = json.loads(row['step1_result']) if isinstance(row['step1_result'], str) else row['step1_result']
        selected_concerns_list = json.loads(row['selected_concerns']) if isinstance(row['selected_concerns'], str) else row['selected_concerns']
        survey_responses_dict = json.loads(row['survey_responses']) if isinstance(row['survey_responses'], str) else row['survey_responses'] if row['survey_responses'] else {}
        
        # Step1Result 객체 생성
        step1_result_obj = Step1Result(**step1_result_dict)
        
        # CheckupDesignStep2Request 생성
        step2_request = CheckupDesignStep2Request(
            uuid=row['uuid'],
            hospital_id=row['hospital_id'],
            step1_result=step1_result_obj,
            selected_concerns=selected_concerns_list,
            survey_responses=survey_responses_dict,
            session_id=row['session_id']
        )
        
        logger.info(f"🚀 [재시도] STEP2 재실행 시작 - UUID: {row['uuid']}")
        
        # 3. STEP2 API 재호출
        step2_response = await create_checkup_design_step2(step2_request)
        
        logger.info(f"✅ [재시도] 성공 - ID: {request_id}")
        
        return {
            "success": True,
            "data": step2_response.data,
            "message": "재시도 성공"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [재시도] 실패 - ID: {request_id}: {str(e)}", exc_info=True)
        logger.error(f"🔍 [DEBUG] 에러 타입: {type(e).__name__}")
        logger.error(f"🔍 [DEBUG] request_id: {request_id}")
        
        # 재시도 실패 시 에러 상태 업데이트
        try:
            await welno_data_service.update_checkup_design_request(
                request_id=request_id,
                status='failed',
                error_stage='retry',
                error_message=str(e)[:500]
            )
        except:
            pass
        
        raise HTTPException(status_code=500, detail=f"재시도 실패: {str(e)}")


# ── 캠페인 상태 체크 API (disease_report_unified.py 패턴) ──────────────────


class CheckStatusRequest(BaseModel):
    """검진설계 캠페인 상태 체크 요청"""
    uuid: str = Field(..., description="환자 UUID")
    partner_id: str = Field("welno", description="파트너 ID")
    hospital_id: Optional[str] = Field(None, description="병원 ID")
    api_key: Optional[str] = Field(None, description="파트너 API Key")


class CheckStatusResponse(BaseModel):
    """검진설계 캠페인 상태 체크 응답"""
    success: bool
    case_id: str
    action: str
    has_design: bool = False
    has_health_data: bool = False
    design_status: Optional[str] = None
    design_request_id: Optional[int] = None
    message: Optional[str] = None
    available_years: Optional[list] = None
    latest_year: Optional[int] = None
    can_get_more: bool = True


class SaveLinkHealthRequest(BaseModel):
    uuid: str
    hospital_id: str
    name: Optional[str] = None
    birthday: Optional[str] = None
    gender: Optional[str] = None
    bmi: Optional[str] = None
    height: Optional[str] = None
    weight: Optional[str] = None
    bphigh: Optional[str] = None
    bplwst: Optional[str] = None
    blds: Optional[str] = None
    totchole: Optional[str] = None
    hdlchole: Optional[str] = None
    ldlchole: Optional[str] = None
    triglyceride: Optional[str] = None
    hmg: Optional[str] = None
    sgotast: Optional[str] = None
    sgptalt: Optional[str] = None
    gfr: Optional[str] = None
    creatinine: Optional[str] = None
    checkup_year: Optional[str] = None


@router.post("/save-link-health-data")
async def save_link_health_data(request: SaveLinkHealthRequest):
    """알림톡 링크 건강데이터를 welno 구조체(welno_checkup_data)에 저장"""
    health_fields = {k: v for k, v in request.dict().items()
                     if k not in ('uuid', 'hospital_id', 'name', 'birthday', 'gender') and v}
    print(f"📥 [save-link-health-data] uuid={request.uuid}, hospital={request.hospital_id}, name={request.name}, fields={health_fields}")
    result = await welno_data_service.save_link_health_data(
        uuid=request.uuid,
        hospital_id=request.hospital_id,
        health_fields=health_fields,
        name=request.name,
        birthday=request.birthday,
        gender=request.gender,
    )
    return result


@router.post("/check-status", response_model=CheckStatusResponse)
async def check_checkup_design_status(request: CheckStatusRequest):
    """
    검진설계 캠페인 상태 체크 — 질병예측 check-partner-status 패턴.

    상태 머신:
      A: 설계 완료 (step2_completed) → show_result
      B: Step1만 완료 (step1_completed) → show_step2_ready
      C: 데이터 있음 + 설계 없음 → show_design_start
      D: 데이터 없음 → redirect_to_auth
      E: 자동 설계 진행 중 (pending/step1 auto) → show_processing
    """
    try:
        uuid = request.uuid
        # [v10] hospital_id 누락 시 환자 last_auth hospital 자동 조회 → 신규/미발견만 PEERNINE 폴백
        hospital_id = request.hospital_id
        if not hospital_id:
            hospital_id = await welno_data_service.find_hospital_id_by_uuid(uuid) or "PEERNINE"
            logger.info(f"🔍 [v10 check-status] hospital_id 자동 조회: {hospital_id}")

        # 1. 기존 설계 상태 확인
        design = await welno_data_service.get_latest_checkup_design(uuid, hospital_id)
        incomplete = await welno_data_service.get_incomplete_checkup_design(uuid, hospital_id)

        if design:
            return CheckStatusResponse(
                success=True, case_id="A", action="show_result",
                has_design=True, has_health_data=True,
                design_status="step2_completed",
                message="검진설계가 완료되었습니다.",
            )

        if incomplete:
            inc_status = incomplete.get("status", "")
            if inc_status == "step1_completed":
                return CheckStatusResponse(
                    success=True, case_id="B", action="show_step2_ready",
                    has_design=True, has_health_data=True,
                    design_status="step1_completed",
                    design_request_id=incomplete.get("id"),
                    message="Step1 분석이 완료되었습니다. Step2를 진행해주세요.",
                )
            # pending 또는 auto 진행 중
            return CheckStatusResponse(
                success=True, case_id="E", action="show_processing",
                has_design=False, has_health_data=True,
                design_status=inc_status,
                message="검진설계가 진행 중입니다.",
            )

        # 2. 건강 데이터 유무 확인 (hospital_id '*'이면 전체 조회 fallback)
        health = await welno_data_service.get_patient_health_data(uuid, hospital_id)
        has_data = bool(health and not health.get("error") and health.get("health_data"))
        if not has_data and hospital_id == '*':
            # '*'로 데이터 없으면 hospital_id 없이 재조회
            health = await welno_data_service.get_patient_health_data(uuid, 'PEERNINE')
            has_data = bool(health and not health.get("error") and health.get("health_data"))

        if has_data:
            # 보유 연도 목록 추출
            health_data_list = health.get("health_data", [])
            years = []
            for h in health_data_list:
                y = h.get("year", "")
                if y:
                    try:
                        years.append(int(str(y).replace("년", "").strip()))
                    except (ValueError, TypeError):
                        pass
            years = sorted(set(years), reverse=True)
            return CheckStatusResponse(
                success=True, case_id="C", action="show_design_start",
                has_design=False, has_health_data=True,
                available_years=years if years else None,
                latest_year=years[0] if years else None,
                can_get_more=True,
                message="건강 데이터가 있습니다. 검진설계를 시작할 수 있습니다.",
            )

        # 3. 데이터 없음
        return CheckStatusResponse(
            success=True, case_id="D", action="redirect_to_auth",
            has_design=False, has_health_data=False,
            message="건강 데이터가 없습니다. 본인 인증이 필요합니다.",
        )

    except Exception as e:
        logger.error(f"❌ [check-status] 실패: {e}", exc_info=True)
        return CheckStatusResponse(
            success=False, case_id="ERR", action="error",
            message=f"상태 확인 실패: {str(e)}",
        )
