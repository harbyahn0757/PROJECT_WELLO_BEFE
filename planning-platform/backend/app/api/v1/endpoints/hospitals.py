"""
병원 관련 API 엔드포인트
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Path, Depends
from pydantic import BaseModel, Field

from ....repositories.implementations import HospitalRepository
from ....core.security import get_current_user


router = APIRouter()

# 의존성 주입 (추후 DI 컨테이너로 대체)
def get_hospital_repository() -> HospitalRepository:
    return HospitalRepository()


class HospitalResponse(BaseModel):
    """병원 정보 응답 모델"""
    hospital_id: str
    name: str
    phone: str
    address: str
    supported_checkup_types: List[str]
    layout_type: str = Field(..., description="레이아웃 타입 (horizontal: 가로 스크롤형, vertical: 세로 스크롤형)")
    brand_color: str = Field(..., description="브랜드 색상 (hex)")
    logo_position: str = Field(..., description="로고 위치 (left/center/right)")
    is_active: bool


@router.get("/", response_model=List[HospitalResponse])
async def get_hospitals(
    active_only: bool = Query(True, description="활성화된 병원만 조회"),
    limit: int = Query(10, ge=1, le=100, description="최대 결과 수")
):
    """병원 목록 조회"""
    try:
        repo = get_hospital_repository()
        
        if active_only:
            hospitals = await repo.get_all_active()
        else:
            hospitals = await repo.get_all()
        
        # 제한된 수만큼만 반환
        limited_hospitals = hospitals[:limit]
        
        # 응답 모델로 변환
        responses = []
        for hospital in limited_hospitals:
            response = HospitalResponse(
                hospital_id=hospital.hospital_id,
                name=hospital.info.name,
                phone=hospital.contact.phone,
                address=hospital.address.get_full_address(),
                supported_checkup_types=hospital.supported_checkup_types,
                layout_type=hospital.layout_type,
                brand_color=hospital.brand_color,
                logo_position=hospital.logo_position,
                is_active=hospital.is_active
            )
            responses.append(response)
        
        return responses
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"병원 목록 조회 중 오류: {str(e)}")


@router.get("/{hospital_id}", response_model=HospitalResponse)
async def get_hospital(
    hospital_id: str = Path(..., description="병원 ID")
):
    """특정 병원 정보 조회"""
    try:
        repo = get_hospital_repository()
        hospital = await repo.get_by_id(hospital_id)
        
        if not hospital:
            raise HTTPException(
                status_code=404,
                detail=f"병원을 찾을 수 없습니다: {hospital_id}"
            )
        
        # 디버깅용 로그
        print(f"병원 정보: {hospital}")
        
        return HospitalResponse(
            hospital_id=hospital.hospital_id,
            name=hospital.info.name,
            phone=hospital.contact.phone,
            address=hospital.address.get_full_address(),
            supported_checkup_types=hospital.supported_checkup_types,
            layout_type=hospital.layout_type,
            brand_color=hospital.brand_color,
            logo_position=hospital.logo_position,
            is_active=hospital.is_active
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"병원 조회 중 오류: {str(e)}")


@router.get("/search/by-name")
async def search_hospital_by_name(
    name: str = Query(..., description="병원명")
):
    """병원명으로 검색"""
    try:
        repo = get_hospital_repository()
        hospital = await repo.get_by_name(name)
        
        if not hospital:
            return None
        
        return HospitalResponse(
            hospital_id=hospital.hospital_id,
            name=hospital.info.name,
            phone=hospital.contact.phone,
            address=hospital.address.get_full_address(),
            supported_checkup_types=hospital.supported_checkup_types,
            layout_type=hospital.layout_type,
            brand_color=hospital.brand_color,
            logo_position=hospital.logo_position,
            is_active=hospital.is_active
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"병원 검색 중 오류: {str(e)}")


@router.get("/search/by-address", response_model=List[HospitalResponse])
async def search_hospitals_by_address(
    city: str = Query(..., description="시/도"),
    district: Optional[str] = Query(None, description="구/군"),
    limit: int = Query(10, ge=1, le=100, description="최대 결과 수")
):
    """주소로 병원 검색"""
    try:
        repo = get_hospital_repository()
        hospitals = await repo.search_by_address(city, district)
        
        # 제한된 수만큼만 반환
        limited_hospitals = hospitals[:limit]
        
        # 응답 모델로 변환
        responses = []
        for hospital in limited_hospitals:
            response = HospitalResponse(
                hospital_id=hospital.hospital_id,
                name=hospital.info.name,
                phone=hospital.contact.phone,
                address=hospital.address.get_full_address(),
                supported_checkup_types=hospital.supported_checkup_types,
                layout_type=hospital.layout_type,
                brand_color=hospital.brand_color,
                logo_position=hospital.logo_position,
                is_active=hospital.is_active
            )
            responses.append(response)
        
        return responses
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"병원 주소 검색 중 오류: {str(e)}")