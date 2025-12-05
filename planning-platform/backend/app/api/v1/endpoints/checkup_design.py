"""
검진 설계 관련 API 엔드포인트
GPT 기반 검진 설계 생성
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, HTTPException, Query, Path, Depends
from pydantic import BaseModel, Field
import logging
from datetime import datetime

from ....services.exceptions import PatientNotFoundError, CheckupDesignError
from ....repositories.implementations import PatientRepository, CheckupDesignRepository
from ....core.security import get_current_user
from ....core.config import settings
from ....services.gpt_service import GPTService, GPTRequest
from ....services.checkup_design_prompt import (
    create_checkup_design_prompt, 
    CHECKUP_DESIGN_SYSTEM_MESSAGE,
    create_checkup_design_prompt_step1,
    CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP1,
    create_checkup_design_prompt_step2,
    CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP2
)
from ....services.wello_data_service import WelloDataService

logger = logging.getLogger(__name__)

router = APIRouter()
wello_data_service = WelloDataService()
gpt_service = GPTService()

# 의존성 주입 (추후 DI 컨테이너로 대체)
def get_repositories():
    return PatientRepository(), CheckupDesignRepository()


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
    selected_concerns: List[ConcernItem] = Field(..., description="선택한 염려 항목 리스트")
    survey_responses: Optional[Dict[str, Any]] = Field(None, description="설문 응답 (체중 변화, 운동, 가족력 등)")
    additional_info: Optional[Dict[str, Any]] = Field(None, description="추가 정보")
    # 약품 분석 결과 텍스트 (전체 처방 데이터 대신 사용)
    prescription_analysis_text: Optional[str] = Field(None, description="약품 분석 결과 텍스트 (프롬프트용)")
    selected_medication_texts: Optional[List[str]] = Field(None, description="선택된 약품의 사용자 친화적 텍스트 (프롬프트용)")


class CheckupDesignResponse(BaseModel):
    """검진 설계 응답 모델 (GPT 기반)"""
    success: bool
    data: Dict[str, Any]  # GPT 응답 JSON 구조
    message: Optional[str] = None


class Step1Result(BaseModel):
    """STEP 1 분석 결과 모델"""
    patient_summary: str = Field(..., description="환자 상태 3줄 요약")
    analysis: str = Field(..., description="종합 분석")
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
    try:
        logger.info(f"🔍 [검진설계] 요청 시작 - UUID: {request.uuid}, 선택 항목: {len(request.selected_concerns)}개")
        logger.info(f"🔍 [검진설계] request 타입: {type(request)}")
        logger.info(f"🔍 [검진설계] request.uuid 타입: {type(request.uuid)}")
        logger.info(f"🔍 [검진설계] request.hospital_id 타입: {type(request.hospital_id)}")
        
        # 1. 환자 정보 조회
        logger.info(f"🔍 [검진설계] 환자 정보 조회 시작...")
        patient_info = await wello_data_service.get_patient_by_uuid(request.uuid)
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
        logger.info(f"🏥 [검진설계] 병원 정보 조회 시작 - hospital_id: {request.hospital_id}")
        hospital_info = await wello_data_service.get_hospital_by_id(request.hospital_id)
        logger.info(f"🔍 [검진설계] hospital_info 타입: {type(hospital_info)}")
        
        if not isinstance(hospital_info, dict):
            logger.error(f"❌ [검진설계] hospital_info가 딕셔너리가 아님: {type(hospital_info)}")
            logger.error(f"❌ [검진설계] hospital_info 내용: {hospital_info}")
            raise ValueError(f"병원 정보 조회 결과가 딕셔너리가 아닙니다: {type(hospital_info)}")
        
        if "error" in hospital_info:
            logger.error(f"❌ [검진설계] 병원 정보 조회 실패: {hospital_info['error']}")
            raise HTTPException(status_code=404, detail=hospital_info["error"])
        
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
        logger.info(f"🔍 [검진설계] 건강 데이터 조회 시작...")
        health_data_result = await wello_data_service.get_patient_health_data(request.uuid, request.hospital_id)
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
            prescription_data_result = await wello_data_service.get_patient_prescription_data(request.uuid, request.hospital_id)
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
        
        # 4. 선택한 염려 항목 변환
        selected_concerns = []
        # 선택된 약품 텍스트 추출 (survey_responses에서)
        selected_medication_texts = request.survey_responses.get("selected_medication_texts") if request.survey_responses else None
        
        for concern in request.selected_concerns:
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
        logger.info(f"🔄 [검진설계] 2단계 파이프라인 시작...")
        
        # survey_responses에서 약품 분석 텍스트 추출
        survey_responses_clean = request.survey_responses or {}
        prescription_analysis_text = survey_responses_clean.pop("prescription_analysis_text", None) or request.prescription_analysis_text
        selected_medication_texts = survey_responses_clean.pop("selected_medication_texts", None) or request.selected_medication_texts
        
        # STEP 1: 빠른 분석 수행
        logger.info(f"📊 [검진설계] STEP 1: 빠른 분석 시작...")
        step1_response = await create_checkup_design_step1(request)
        if not step1_response.success:
            logger.error(f"❌ [검진설계] STEP 1 실패")
            raise ValueError("STEP 1 분석 실패")
        
        step1_result = step1_response.data
        logger.info(f"✅ [검진설계] STEP 1 완료 - 분석 결과 수신")
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
        logger.info(f"🔧 [검진설계] STEP 2: 설계 및 근거 확보 시작...")
        try:
            # STEP 1 결과를 Step1Result 구조체로 변환
            step1_result_model = Step1Result(**step1_result)
            
            # STEP 2 요청 생성
            step2_request = CheckupDesignStep2Request(
                uuid=request.uuid,
                hospital_id=request.hospital_id,
                step1_result=step1_result_model,
                selected_concerns=request.selected_concerns,
                survey_responses=request.survey_responses,
                additional_info=request.additional_info,
                prescription_analysis_text=prescription_analysis_text,
                selected_medication_texts=selected_medication_texts
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
                logger.info(f"✅ [검진설계] STEP 2 완료 - 설계 및 근거 결과 수신")
                
                # step2_result 타입 검증
                logger.info(f"🔍 [검진설계] STEP 2 결과 타입: {type(step2_result)}")
                if not isinstance(step2_result, dict):
                    logger.error(f"❌ [검진설계] STEP 2 결과가 딕셔너리가 아님: {type(step2_result)}")
                    logger.error(f"❌ [검진설계] STEP 2 결과 내용 (처음 500자): {str(step2_result)[:500]}")
                    raise ValueError(f"STEP 2 결과 형식 오류: 딕셔너리가 아닌 {type(step2_result)}")
                
                logger.info(f"📊 [검진설계] STEP 2 결과 키: {list(step2_result.keys())}")
                
                # STEP 1과 STEP 2 결과 병합
                logger.info(f"🔗 [검진설계] STEP 1과 STEP 2 결과 병합 중...")
                ai_response = merge_checkup_design_responses(step1_result, step2_result)
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
            save_result = await wello_data_service.save_checkup_design_request(
                uuid=request.uuid,
                hospital_id=request.hospital_id,
                selected_concerns=selected_concerns,
                survey_responses=request.survey_responses,
                design_result=ai_response
            )
            if save_result.get("success"):
                logger.info(f"✅ [검진설계] 요청 저장 완료 - ID: {save_result.get('request_id')}")
            else:
                logger.warning(f"⚠️ [검진설계] 요청 저장 실패: {save_result.get('error')}")
        except Exception as e:
            logger.warning(f"⚠️ [검진설계] 요청 저장 중 오류 (무시): {str(e)}")
        
        # 8. 응답 반환
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
        logger.info(f"🔍 [STEP1-분석] 요청 시작 - UUID: {request.uuid}, 선택 항목: {len(request.selected_concerns)}개")
        
        # 1. 환자 정보 조회
        patient_info = await wello_data_service.get_patient_by_uuid(request.uuid)
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
        logger.info(f"🏥 [STEP1-분석] 병원 정보 조회 시작 - hospital_id: {request.hospital_id}")
        hospital_info = await wello_data_service.get_hospital_by_id(request.hospital_id)
        if "error" in hospital_info:
            logger.error(f"❌ [STEP1-분석] 병원 정보 조회 실패: {hospital_info['error']}")
            raise HTTPException(status_code=404, detail=hospital_info["error"])
        
        hospital_national_checkup = hospital_info.get("national_checkup_items")
        logger.info(f"✅ [STEP1-분석] 병원 정보 조회 완료 - {hospital_info.get('hospital_name', 'N/A')}")
        logger.info(f"📊 [STEP1-분석] 기본 검진 항목: {len(hospital_national_checkup) if hospital_national_checkup else 0}개")
        
        # 3. 건강 데이터 조회 (기존 방식과 동일)
        health_data_result = await wello_data_service.get_patient_health_data(request.uuid, request.hospital_id)
        if "error" in health_data_result:
            logger.warning(f"⚠️ [STEP1-분석] 건강 데이터 조회 실패: {health_data_result['error']}")
            health_data = []
        else:
            health_data = health_data_result.get("health_data", [])
        logger.info(f"📊 [STEP1-분석] 건강 데이터: {len(health_data)}건")
        
        # 4. 처방전 데이터 조회 (기존 방식과 동일)
        prescription_data = []
        if not request.prescription_analysis_text:
            prescription_data_result = await wello_data_service.get_patient_prescription_data(request.uuid, request.hospital_id)
            if "error" in prescription_data_result:
                logger.warning(f"⚠️ [STEP1-분석] 처방전 데이터 조회 실패: {prescription_data_result['error']}")
                prescription_data = []
            else:
                prescription_data = prescription_data_result.get("prescription_data", [])
        logger.info(f"💊 [STEP1-분석] 처방전 데이터: {len(prescription_data)}건")
        
        # 5. 선택한 염려 항목 변환
        selected_concerns = []
        for concern in request.selected_concerns:
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
        survey_responses_clean = request.survey_responses or {}
        prescription_analysis_text = survey_responses_clean.pop("prescription_analysis_text", None) or request.prescription_analysis_text
        selected_medication_texts = survey_responses_clean.pop("selected_medication_texts", None) or request.selected_medication_texts
        
        # 7. STEP 1 프롬프트 생성
        user_message = create_checkup_design_prompt_step1(
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
        
        # 8. 빠른 모델 선택 (STEP 1은 빠른 응답이 목표)
        # gpt-4o-mini 사용 (빠르고 저렴한 모델)
        fast_model = getattr(settings, 'openai_fast_model', 'gpt-4o-mini')
        max_tokens = 4096  # STEP 1은 분석만 하므로 토큰 수 제한
        
        logger.info(f"🤖 [STEP1-분석] OpenAI API 호출 시작... (모델: {fast_model}, max_tokens: {max_tokens})")
        logger.info(f"📊 [STEP1-분석] 프롬프트 길이: {len(user_message)} 문자")
        logger.info(f"📊 [STEP1-분석] 시스템 메시지 길이: {len(CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP1)} 문자")
        
        gpt_request = GPTRequest(
            system_message=CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP1,
            user_message=user_message,
            model=fast_model,
            temperature=0.3,
            max_tokens=max_tokens,
            response_format={"type": "json_object"}
        )
        
        # OpenAI 서비스 초기화
        logger.info(f"🔧 [STEP1-분석] OpenAI 서비스 초기화 중...")
        await gpt_service.initialize()
        logger.info(f"✅ [STEP1-분석] OpenAI 서비스 초기화 완료")
        
        # OpenAI API 호출
        logger.info(f"📡 [STEP1-분석] OpenAI API 호출 중...")
        gpt_api_response = await gpt_service.call_api(
            gpt_request,
            save_log=True
        )
        logger.info(f"📥 [STEP1-분석] OpenAI API 응답 수신 완료")
        
        # 응답 상태 확인
        if not gpt_api_response.success:
            logger.error(f"❌ [STEP1-분석] OpenAI API 호출 실패: {gpt_api_response.error}")
            raise ValueError(f"OpenAI API 호출 실패: {gpt_api_response.error}")
        
        if not gpt_api_response.content:
            logger.error(f"❌ [STEP1-분석] OpenAI 응답 내용이 비어있음")
            raise ValueError("OpenAI 응답 내용이 비어있습니다.")
        
        # JSON 파싱
        logger.info(f"🔍 [STEP1-분석] JSON 파싱 시작...")
        try:
            ai_response = gpt_service.parse_json_response(
                gpt_api_response.content
            )
            
            # ai_response가 딕셔너리인지 확인
            if not isinstance(ai_response, dict):
                logger.error(f"❌ [STEP1-분석] 파싱된 응답이 딕셔너리가 아님: {type(ai_response)}")
                logger.error(f"❌ [STEP1-분석] 파싱된 응답 내용: {ai_response}")
                raise ValueError(f"JSON 파싱 결과가 딕셔너리가 아닙니다: {type(ai_response)}")
            
            logger.info(f"✅ [STEP1-분석] JSON 파싱 성공")
            logger.info(f"📊 [STEP1-분석] 파싱된 응답 키: {list(ai_response.keys())}")
        except Exception as parse_error:
            logger.error(f"❌ [STEP1-분석] JSON 파싱 실패: {str(parse_error)}")
            raise ValueError(f"JSON 파싱 실패: {str(parse_error)}")
        
        # STEP 1 응답 반환 (분석 결과만)
        logger.info(f"✅ [STEP1-분석] STEP 1 완료 - 분석 결과 반환")
        
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
    patient_uuid: str = Path(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID")
):
    """
    최신 검진 설계 결과 조회
    설계가 완료된 경우 결과를 반환하고, 없으면 null 반환
    """
    try:
        logger.info(f"🔍 [검진설계조회] 최신 설계 조회 - UUID: {patient_uuid}, hospital_id: {hospital_id}")
        
        design_result = await wello_data_service.get_latest_checkup_design(
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
        
        logger.info(f"✅ [검진설계조회] 설계 결과 조회 완료 - ID: {design_result.get('id')}")
        
        return {
            "success": True,
            "data": design_result.get("design_result", {}),
            "message": "최신 설계 결과를 조회했습니다."
        }
        
    except Exception as e:
        logger.error(f"❌ [검진설계조회] 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"검진 설계 조회 중 오류: {str(e)}")


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
        delete_result = await wello_data_service.delete_checkup_design_requests(patient_uuid, hospital_id)
        
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
        logger.info(f"🔍 [STEP2-설계] 요청 시작 - UUID: {request.uuid}, STEP 1 결과 수신 완료")
        
        # STEP 1 결과를 Dict로 변환
        step1_result_dict = request.step1_result.dict()
        logger.info(f"📊 [STEP2-설계] STEP 1 결과 키: {list(step1_result_dict.keys())}")
        
        # 1. 환자 정보 조회
        patient_info = await wello_data_service.get_patient_by_uuid(request.uuid)
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
        
        # 2. 병원 정보 조회 (검진 항목 포함) - 기존 방식과 동일
        logger.info(f"🏥 [STEP2-설계] 병원 정보 조회 시작 - hospital_id: {request.hospital_id}")
        hospital_info = await wello_data_service.get_hospital_by_id(request.hospital_id)
        if "error" in hospital_info:
            logger.error(f"❌ [STEP2-설계] 병원 정보 조회 실패: {hospital_info['error']}")
            raise HTTPException(status_code=404, detail=hospital_info["error"])
        
        hospital_national_checkup = hospital_info.get("national_checkup_items")
        hospital_recommended = hospital_info.get("recommended_items")
        hospital_external_checkup = hospital_info.get("external_checkup_items", [])
        logger.info(f"✅ [STEP2-설계] 병원 정보 조회 완료 - {hospital_info.get('hospital_name', 'N/A')}")
        logger.info(f"📊 [STEP2-설계] 검진 항목 통계:")
        logger.info(f"  - 기본 검진 항목: {len(hospital_national_checkup) if hospital_national_checkup else 0}개")
        logger.info(f"  - 병원 추천 항목: {len(hospital_recommended) if hospital_recommended else 0}개")
        logger.info(f"  - 외부 검사 항목: {len(hospital_external_checkup)}개")
        
        # 3. 건강 데이터 조회 (기존 방식과 동일)
        health_data_result = await wello_data_service.get_patient_health_data(request.uuid, request.hospital_id)
        if "error" in health_data_result:
            logger.warning(f"⚠️ [STEP2-설계] 건강 데이터 조회 실패: {health_data_result['error']}")
            health_data = []
        else:
            health_data = health_data_result.get("health_data", [])
        logger.info(f"📊 [STEP2-설계] 건강 데이터: {len(health_data)}건")
        
        # 4. 처방전 데이터 조회 (기존 방식과 동일)
        prescription_data = []
        if not request.prescription_analysis_text:
            prescription_data_result = await wello_data_service.get_patient_prescription_data(request.uuid, request.hospital_id)
            if "error" in prescription_data_result:
                logger.warning(f"⚠️ [STEP2-설계] 처방전 데이터 조회 실패: {prescription_data_result['error']}")
                prescription_data = []
            else:
                prescription_data = prescription_data_result.get("prescription_data", [])
        logger.info(f"💊 [STEP2-설계] 처방전 데이터: {len(prescription_data)}건")
        
        # 5. 선택한 염려 항목 변환
        selected_concerns = []
        for concern in request.selected_concerns:
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
        survey_responses_clean = request.survey_responses or {}
        prescription_analysis_text = survey_responses_clean.pop("prescription_analysis_text", None) or request.prescription_analysis_text
        selected_medication_texts = survey_responses_clean.pop("selected_medication_texts", None) or request.selected_medication_texts
        
        # 7. STEP 2 프롬프트 생성 (RAG 통합) + 구조화된 에비던스 수신
        logger.info(f"🔍 [STEP2-설계] RAG 기반 프롬프트 생성 시작...")
        user_message, structured_evidences = await create_checkup_design_prompt_step2(
            step1_result=step1_result_dict,
            patient_name=patient_name,
            patient_age=patient_age,
            patient_gender=patient_gender,
            health_data=health_data,
            prescription_data=prescription_data,
            selected_concerns=selected_concerns,
            survey_responses=survey_responses_clean,
            hospital_national_checkup=hospital_national_checkup,
            hospital_recommended=hospital_recommended,
            hospital_external_checkup=hospital_external_checkup,
            prescription_analysis_text=prescription_analysis_text,
            selected_medication_texts=selected_medication_texts
        )
        logger.info(f"✅ [STEP2-설계] RAG 기반 프롬프트 생성 완료")
        
        # 8. 강력한 모델 선택 (STEP 2는 근거 확보가 목표)
        # gpt-4o 사용 (강력한 추론, 환경변수 OPENAI_MODEL로 설정 가능)
        powerful_model = getattr(settings, 'openai_model', 'gpt-4o')
        max_tokens = 16384  # STEP 2는 근거 확보를 위해 충분한 토큰 필요
        
        logger.info(f"🤖 [STEP2-설계] OpenAI API 호출 시작... (모델: {powerful_model}, max_tokens: {max_tokens})")
        logger.info(f"📊 [STEP2-설계] 프롬프트 길이: {len(user_message)} 문자")
        logger.info(f"📊 [STEP2-설계] 시스템 메시지 길이: {len(CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP2)} 문자")
        
        gpt_request = GPTRequest(
            system_message=CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP2,
            user_message=user_message,
            model=powerful_model,
            temperature=0.5,  # 0.3 → 0.5: 설명 다채롭게 (단조로움 방지)
            max_tokens=max_tokens,
            response_format={"type": "json_object"}
        )
        
        # OpenAI 서비스 초기화
        logger.info(f"🔧 [STEP2-설계] OpenAI 서비스 초기화 중...")
        await gpt_service.initialize()
        logger.info(f"✅ [STEP2-설계] OpenAI 서비스 초기화 완료")
        
        # OpenAI API 호출
        logger.info(f"📡 [STEP2-설계] OpenAI API 호출 중...")
        gpt_api_response = await gpt_service.call_api(
            gpt_request,
            save_log=True
        )
        logger.info(f"📥 [STEP2-설계] OpenAI API 응답 수신 완료")
        
        # 응답 상태 확인
        if not gpt_api_response.success:
            logger.error(f"❌ [STEP2-설계] OpenAI API 호출 실패: {gpt_api_response.error}")
            raise ValueError(f"OpenAI API 호출 실패: {gpt_api_response.error}")
        
        if not gpt_api_response.content:
            logger.error(f"❌ [STEP2-설계] OpenAI 응답 내용이 비어있음")
            raise ValueError("OpenAI 응답 내용이 비어있습니다.")
        
        # JSON 파싱
        logger.info(f"🔍 [STEP2-설계] JSON 파싱 시작...")
        try:
            ai_response = gpt_service.parse_json_response(
                gpt_api_response.content
            )
            logger.info(f"✅ [STEP2-설계] JSON 파싱 성공")
            logger.info(f"📊 [STEP2-설계] 파싱된 응답 키: {list(ai_response.keys()) if ai_response else 'None'}")
        except Exception as parse_error:
            logger.error(f"❌ [STEP2-설계] JSON 파싱 실패: {str(parse_error)}")
            raise ValueError(f"JSON 파싱 실패: {str(parse_error)}")
        
        # STEP 1과 STEP 2 결과 병합
        logger.info(f"🔗 [STEP2-설계] STEP 1과 STEP 2 결과 병합 중...")
        merged_result = merge_checkup_design_responses(step1_result_dict, ai_response)
        
        # 구조화된 RAG 에비던스 추가 (TODO-16, TODO-18)
        merged_result["rag_evidences"] = structured_evidences
        logger.info(f"📚 [STEP2-설계] RAG 에비던스 추가: {len(structured_evidences)}개")
        
        logger.info(f"✅ [STEP2-설계] 병합 완료 - 최종 결과 키: {list(merged_result.keys())}")
        
        # 검진 설계 요청 저장 (업셀링용) - 병합된 결과 저장
        try:
            save_result = await wello_data_service.save_checkup_design_request(
                uuid=request.uuid,
                hospital_id=request.hospital_id,
                selected_concerns=selected_concerns,
                survey_responses=survey_responses_clean,
                design_result=merged_result
            )
            if save_result.get("success"):
                logger.info(f"✅ [STEP2-설계] 요청 저장 완료 - ID: {save_result.get('request_id')}")
            else:
                logger.warning(f"⚠️ [STEP2-설계] 요청 저장 실패: {save_result.get('error')}")
        except Exception as e:
            logger.warning(f"⚠️ [STEP2-설계] 요청 저장 중 오류 (무시): {str(e)}")
        
        # STEP 2 응답 반환 (설계 및 근거 결과)
        logger.info(f"✅ [STEP2-설계] STEP 2 완료 - 설계 및 근거 결과 반환")
        
        return CheckupDesignResponse(
            success=True,
            data=ai_response,
            message="STEP 2 설계 및 근거 확보 완료"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [STEP2-설계] 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"검진 설계 생성 중 오류: {str(e)}")


def merge_checkup_design_responses(step1_result: Dict[str, Any], step2_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    STEP 1 결과와 STEP 2 결과를 병합하여 기존 형식과 동일한 최종 JSON 생성
    
    Args:
        step1_result: STEP 1 분석 결과 (patient_summary, analysis, survey_reflection, selected_concerns_analysis, basic_checkup_guide)
        step2_result: STEP 2 설계 결과 (summary, strategies, recommended_items, doctor_comment, total_count)
    
    Returns:
        병합된 최종 결과 (기존 /create 엔드포인트와 동일한 형식)
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
    
    logger.info(f"✅ [병합] 병합 완료 - 최종 결과 키: {list(merged_result.keys())}")
    
    return merged_result


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