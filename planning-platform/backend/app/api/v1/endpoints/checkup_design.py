"""
검진 설계 관련 API 엔드포인트
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, HTTPException, Query, Path, Depends
from pydantic import BaseModel, Field

from ....services.exceptions import PatientNotFoundError, CheckupDesignError
from ....repositories.implementations import PatientRepository, CheckupDesignRepository
from ....core.security import get_current_user


router = APIRouter()

# 의존성 주입 (추후 DI 컨테이너로 대체)
def get_repositories():
    return PatientRepository(), CheckupDesignRepository()


class CheckupDesignRequest(BaseModel):
    """검진 설계 요청 모델"""
    patient_uuid: str = Field(..., description="환자 UUID")
    additional_symptoms: Optional[List[str]] = Field(None, description="추가 증상")
    priority_areas: Optional[List[str]] = Field(None, description="우선 검진 희망 영역")


class CheckupDesignResponse(BaseModel):
    """검진 설계 응답 모델"""
    design_id: str
    patient_uuid: str
    recommended_items: List[Dict[str, Any]]
    gpt_analysis: str
    recommendation_reason: str
    priority: int
    estimated_cost: int
    created_at: str
    expires_at: Optional[str]


class TrendAnalysisResponse(BaseModel):
    """추이 분석 응답 모델"""
    patient_uuid: str
    analysis: str
    recommendations: List[str]
    risk_factors: List[str]
    next_checkup_date: Optional[str]


@router.post("/design", response_model=CheckupDesignResponse)
async def create_checkup_design(
    request: CheckupDesignRequest,
    current_user: dict = Depends(get_current_user)
):
    """환자를 위한 맞춤형 검진 설계"""
    try:
        patient_repo, design_repo = get_repositories()
        
        # 환자 정보 조회
        patient = await patient_repo.get_by_uuid(UUID(request.patient_uuid))
        if not patient:
            raise PatientNotFoundError(f"환자를 찾을 수 없습니다: {request.patient_uuid}")
        
        age = patient.info.get_age()
        
        # 연령별 맞춤 검진 추천
        recommended_items = []
        
        # 기본 검진
        recommended_items.append({
            "checkup_type": "basic",
            "item_name": "기본 혈액검사",
            "description": "혈압, 혈당, 콜레스테롤 등 기본 검사",
            "cost": 80000
        })
        
        # 연령별 추가 검진
        if age >= 40:
            recommended_items.append({
                "checkup_type": "comprehensive",
                "item_name": "종합건강검진",
                "description": "연례 종합 건강 상태 점검",
                "cost": 300000
            })
        
        if age >= 50:
            recommended_items.extend([
                {
                    "checkup_type": "cancer",
                    "item_name": "위내시경",
                    "description": "위암 조기 발견을 위한 검사",
                    "cost": 150000
                },
                {
                    "checkup_type": "heart",
                    "item_name": "심장 초음파",
                    "description": "심혈관 질환 예방 검사",
                    "cost": 200000
                }
            ])
        
        # 추가 증상별 검진
        if request.additional_symptoms:
            if "diabetes" in request.additional_symptoms:
                recommended_items.append({
                    "checkup_type": "diabetes",
                    "item_name": "당뇨병 정밀검사",
                    "description": "혈당, 당화혈색소, 인슐린 저항성 검사",
                    "cost": 120000
                })
        
        total_cost = sum(item["cost"] for item in recommended_items)
        priority = 1 if age >= 50 else 2
        
        design_id = f"design_{request.patient_uuid}_{int(datetime.now().timestamp())}"
        
        return CheckupDesignResponse(
            design_id=design_id,
            patient_uuid=request.patient_uuid,
            recommended_items=recommended_items,
            gpt_analysis=f"{patient.info.name}님({age}세)의 연령과 건강 상태를 고려한 맞춤형 검진을 설계했습니다.",
            recommendation_reason=f"연령대({age}세)에 적합한 검진 항목들을 선별했으며, 조기 발견과 예방에 중점을 두었습니다.",
            priority=priority,
            estimated_cost=total_cost,
            created_at=datetime.now().isoformat()
        )
        
    except PatientNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except CheckupDesignError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"검진 설계 중 오류: {str(e)}")


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