"""
환자 관련 서비스
"""

from typing import List, Optional
from uuid import UUID

from ..models.entities import Patient, Hospital
from ..repositories.implementations import PatientRepository, HospitalRepository
from .exceptions import PatientNotFoundError, HospitalNotFoundError


class PatientService:
    """환자 서비스"""
    
    def __init__(self, patient_repo: PatientRepository, hospital_repo: HospitalRepository):
        self.patient_repo = patient_repo
        self.hospital_repo = hospital_repo
    
    async def get_patient_by_uuid(self, uuid: UUID) -> Optional[Patient]:
        """UUID로 환자 조회"""
        print(f"🔍 [SERVICE DEBUG] 환자 서비스 조회 시작 - UUID: {uuid}")
        
        try:
            patient = await self.patient_repo.get_by_uuid(uuid)
            print(f"🔍 [SERVICE DEBUG] 레포지토리 조회 결과: {patient}")
            
            if not patient:
                raise PatientNotFoundError(f"환자를 찾을 수 없습니다: {uuid}")
            return patient
        except Exception as e:
            print(f"🔍 [SERVICE DEBUG] 조회 중 에러 발생: {str(e)}")
            raise
    
    async def get_patient_by_phone(self, phone: str) -> Optional[Patient]:
        """전화번호로 환자 조회"""
        return await self.patient_repo.get_by_phone(phone)
    
    async def get_hospital_by_id(self, hospital_id: str) -> Optional[Hospital]:
        """병원 ID로 병원 조회"""
        hospital = await self.hospital_repo.get_by_id(hospital_id)
        if not hospital:
            raise HospitalNotFoundError(f"병원을 찾을 수 없습니다: {hospital_id}")
        return hospital
    
    async def get_patient_summary(self, uuid: UUID) -> dict:
        """환자 요약 정보 조회"""
        patient = await self.get_patient_by_uuid(uuid)
        hospital = await self.get_hospital_by_id(patient.hospital_id)
        
        # 디버깅용 로그
        print(f"환자 정보: {patient}")
        print(f"병원 정보: {hospital}")
        
        return {
            "uuid": str(patient.uuid),
            "name": patient.info.name,
            "age": patient.info.age,
            "gender": patient.info.gender,
            "phone": patient.phone,
            "hospital": {
                "hospital_id": hospital.hospital_id,
                "name": hospital.info.name,
                "phone": hospital.contact.phone,
                "address": hospital.address.get_full_address(),
                "supported_checkup_types": hospital.supported_checkup_types,
                "layout_type": hospital.layout_type,  # 레이아웃 타입 추가
                "brand_color": hospital.brand_color,  # 브랜드 색상 추가
                "logo_position": hospital.logo_position,  # 로고 위치 추가
                "is_active": hospital.is_active
            },
            "last_checkup_count": patient.last_checkup_count,
            "created_at": patient.created_at.isoformat()
        }
    
    async def search_patients(
        self,
        name: Optional[str] = None,
        phone: Optional[str] = None,
        hospital_id: Optional[str] = None
    ) -> List[Patient]:
        """환자 검색"""
        # TODO: 실제 검색 구현
        return []
    
    async def get_patients_by_hospital(self, hospital_id: str) -> List[Patient]:
        """특정 병원의 환자 목록 조회"""
        # TODO: 실제 구현
        return []