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
from ....services.gpt_service import GPTService, GPTRequest
from ....services.checkup_design_prompt import create_checkup_design_prompt, CHECKUP_DESIGN_SYSTEM_MESSAGE
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

class CheckupDesignRequest(BaseModel):
    """검진 설계 요청 모델 (GPT 기반)"""
    uuid: str = Field(..., description="환자 UUID")
    hospital_id: str = Field(..., description="병원 ID")
    selected_concerns: List[ConcernItem] = Field(..., description="선택한 염려 항목 리스트")
    additional_info: Optional[Dict[str, Any]] = Field(None, description="추가 정보")


class CheckupDesignResponse(BaseModel):
    """검진 설계 응답 모델 (GPT 기반)"""
    success: bool
    data: Dict[str, Any]  # GPT 응답 JSON 구조
    message: Optional[str] = None


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
        
        # 1. 환자 정보 조회
        patient_info = await wello_data_service.get_patient_by_uuid(request.uuid)
        if "error" in patient_info:
            raise HTTPException(status_code=404, detail=patient_info["error"])
        
        patient_name = patient_info.get("name", "환자")
        patient_age = None
        if patient_info.get("birth_date"):
            from datetime import datetime
            birth_date = datetime.fromisoformat(patient_info["birth_date"].replace("Z", "+00:00"))
            patient_age = datetime.now().year - birth_date.year
        patient_gender = patient_info.get("gender", "M")
        
        # 2. 건강 데이터 조회
        health_data_result = await wello_data_service.get_patient_health_data(request.uuid, request.hospital_id)
        if "error" in health_data_result:
            logger.warning(f"⚠️ [검진설계] 건강 데이터 조회 실패: {health_data_result['error']}")
            health_data = []
        else:
            health_data = health_data_result.get("health_data", [])
        
        # 3. 처방전 데이터 조회
        prescription_data_result = await wello_data_service.get_patient_prescription_data(request.uuid, request.hospital_id)
        if "error" in prescription_data_result:
            logger.warning(f"⚠️ [검진설계] 처방전 데이터 조회 실패: {prescription_data_result['error']}")
            prescription_data = []
        else:
            prescription_data = prescription_data_result.get("prescription_data", [])
        
        # 4. 선택한 염려 항목 변환
        selected_concerns = []
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
                    "hospital_name": concern.hospitalName or concern.location
                })
            selected_concerns.append(concern_dict)
        
        # 5. GPT 프롬프트 생성 (프롬프트가 생명!)
        logger.info(f"📝 [검진설계] GPT 프롬프트 생성 중...")
        user_message = create_checkup_design_prompt(
            patient_name=patient_name,
            patient_age=patient_age,
            patient_gender=patient_gender,
            health_data=health_data,
            prescription_data=prescription_data,
            selected_concerns=selected_concerns
        )
        
        # 6. GPT API 호출
        logger.info(f"🤖 [검진설계] GPT API 호출 시작...")
        gpt_request = GPTRequest(
            system_message=CHECKUP_DESIGN_SYSTEM_MESSAGE,
            user_message=user_message,
            model="gpt-4o-mini",
            temperature=0.3,
            max_tokens=3000,  # 검진 설계는 더 긴 응답 필요
            response_format={"type": "json_object"}  # JSON 형식 강제
        )
        
        # GPT 서비스 초기화
        await gpt_service.initialize()
        
        # JSON 응답 호출
        gpt_response = await gpt_service.call_with_json_response(
            gpt_request,
            save_log=True
        )
        
        if not gpt_response or not gpt_response.get("recommended_items"):
            logger.error("❌ [검진설계] GPT 응답이 올바르지 않음")
            raise HTTPException(
                status_code=500,
                detail="검진 설계 생성에 실패했습니다. 다시 시도해주세요."
            )
        
        logger.info(f"✅ [검진설계] GPT 응답 수신 완료 - 카테고리: {len(gpt_response.get('recommended_items', []))}개")
        
        # 7. 응답 반환
        return CheckupDesignResponse(
            success=True,
            data=gpt_response,
            message="검진 설계가 완료되었습니다."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [검진설계] 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"검진 설계 중 오류가 발생했습니다: {str(e)}"
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