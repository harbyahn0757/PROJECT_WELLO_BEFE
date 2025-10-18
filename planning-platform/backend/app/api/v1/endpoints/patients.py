"""
수검자 관련 API 엔드포인트
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Query, Path, Depends
from pydantic import BaseModel, Field

from ....services.patient_service import PatientService
from ....services.exceptions import PatientNotFoundError
from ....repositories.implementations import PatientRepository, HospitalRepository
from ....core.security import get_current_user


router = APIRouter()

# 의존성 주입 (추후 DI 컨테이너로 대체)
def get_patient_service() -> PatientService:
    patient_repo = PatientRepository()
    hospital_repo = HospitalRepository()
    return PatientService(patient_repo, hospital_repo)


class HospitalInfo(BaseModel):
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


class PatientResponse(BaseModel):
    """환자 정보 응답 모델"""
    uuid: str
    name: str
    age: int
    gender: str
    phone: str
    birthday: str
    hospital: HospitalInfo
    last_checkup_count: int
    created_at: str


@router.get("/{patient_uuid}", response_model=PatientResponse)
async def get_patient(
    patient_uuid: UUID = Path(..., description="환자 UUID"),
    patient_service: PatientService = Depends(get_patient_service)
):
    """특정 환자 정보 조회"""
    try:
        print(f"🔍 [API DEBUG] 환자 조회 시작 - UUID: {patient_uuid}")
        
        patient = await patient_service.get_patient_by_uuid(patient_uuid)
        
        print(f"🔍 [API DEBUG] 환자 조회 결과: {patient}")
        
        if not patient:
            raise PatientNotFoundError(f"환자를 찾을 수 없습니다: {patient_uuid}")
        
        # 병원 정보 조회
        hospital = await patient_service.get_hospital_by_id(patient.hospital_id)
        if not hospital:
            raise HTTPException(
                status_code=404,
                detail=f"병원을 찾을 수 없습니다: {patient.hospital_id}"
            )
        
        return PatientResponse(
            uuid=str(patient.uuid),
            name=patient.info.name,
            age=patient.info.age,
            gender=patient.info.gender,
            phone=patient.phone,
            birthday=patient.info.birth_date.strftime("%Y%m%d") if patient.info.birth_date else '19810927',  # birthday 필드 추가
            hospital=HospitalInfo(
                hospital_id=hospital.hospital_id,
                name=hospital.info.name,
                phone=hospital.contact.phone,
                address=hospital.address.get_full_address(),
                supported_checkup_types=hospital.supported_checkup_types,
                layout_type=hospital.layout_type,
                brand_color=hospital.brand_color,
                logo_position=hospital.logo_position,
                is_active=hospital.is_active
            ),
            last_checkup_count=patient.last_checkup_count,
            created_at=patient.created_at.isoformat()
        )
        
    except PatientNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"환자 조회 중 오류: {str(e)}")


@router.get("/search/", response_model=List[PatientResponse])
async def search_patients(
    name: Optional[str] = Query(None, description="환자 이름"),
    phone: Optional[str] = Query(None, description="전화번호"), 
    hospital_id: Optional[str] = Query(None, description="병원 ID"),
    limit: int = Query(10, ge=1, le=100, description="최대 결과 수"),
    patient_service: PatientService = Depends(get_patient_service)
):
    """환자 검색"""
    try:
        patients = await patient_service.search_patients(
            name=name,
            phone=phone,
            hospital_id=hospital_id
        )
        
        # 제한된 수만큼만 반환
        limited_patients = patients[:limit]
        
        # 각 환자의 요약 정보 생성
        responses = []
        for patient in limited_patients:
            # 병원 정보 조회
            hospital = await patient_service.get_hospital_by_id(patient.hospital_id)
            if not hospital:
                continue
            
            responses.append(PatientResponse(
                uuid=str(patient.uuid),
                name=patient.info.name,
                age=patient.info.age,
                gender=patient.info.gender,
                phone=patient.phone,
                hospital=HospitalInfo(
                    hospital_id=hospital.hospital_id,
                    name=hospital.info.name,
                    phone=hospital.contact.phone,
                    address=hospital.address.get_full_address(),
                    supported_checkup_types=hospital.supported_checkup_types,
                    layout_type=hospital.layout_type,
                    brand_color=hospital.brand_color,
                    logo_position=hospital.logo_position,
                    is_active=hospital.is_active
                ),
                last_checkup_count=patient.last_checkup_count,
                created_at=patient.created_at.isoformat()
            ))
        
        return responses
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"환자 검색 중 오류: {str(e)}")


@router.get("/hospital/{hospital_id}", response_model=List[PatientResponse])
async def get_patients_by_hospital(
    hospital_id: str = Path(..., description="병원 ID"),
    limit: int = Query(10, ge=1, le=100, description="최대 결과 수"),
    patient_service: PatientService = Depends(get_patient_service)
):
    """특정 병원의 환자 목록 조회"""
    try:
        patients = await patient_service.get_patients_by_hospital(hospital_id)
        
        # 제한된 수만큼만 반환
        limited_patients = patients[:limit]
        
        # 병원 정보 조회
        hospital = await service.get_hospital_by_id(hospital_id)
        if not hospital:
            raise HTTPException(
                status_code=404,
                detail=f"병원을 찾을 수 없습니다: {hospital_id}"
            )
        
        # 각 환자의 요약 정보 생성
        responses = []
        for patient in limited_patients:
            responses.append(PatientResponse(
                uuid=str(patient.uuid),
                name=patient.info.name,
                age=patient.info.age,
                gender=patient.info.gender,
                phone=patient.phone,
                hospital=HospitalInfo(
                    hospital_id=hospital.hospital_id,
                    name=hospital.info.name,
                    phone=hospital.contact.phone,
                    address=hospital.address.get_full_address(),
                    supported_checkup_types=hospital.supported_checkup_types,
                    layout_type=hospital.layout_type,
                    brand_color=hospital.brand_color,
                    logo_position=hospital.logo_position,
                    is_active=hospital.is_active
                ),
                last_checkup_count=patient.last_checkup_count,
                created_at=patient.created_at.isoformat()
            ))
        
        return responses
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"환자 목록 조회 중 오류: {str(e)}")