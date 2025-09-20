"""
병원 서비스
"""
from typing import List, Optional
from ..models.entities import Hospital
from ..repositories.interfaces import IHospitalRepository
from .exceptions import HospitalNotFoundError


class HospitalService:
    """병원 관련 비즈니스 로직"""
    
    def __init__(self, hospital_repository: IHospitalRepository):
        self.hospital_repository = hospital_repository
    
    def get_hospital_by_id(self, hospital_id: str) -> Hospital:
        """병원 ID로 병원 정보 조회"""
        hospital = self.hospital_repository.get_by_id(hospital_id)
        if not hospital:
            raise HospitalNotFoundError(f"병원을 찾을 수 없습니다: {hospital_id}")
        return hospital
    
    def get_all_hospitals(self) -> List[Hospital]:
        """모든 병원 목록 조회"""
        return self.hospital_repository.get_all()
    
    def search_hospitals_by_name(self, name: str) -> List[Hospital]:
        """병원명으로 검색"""
        hospitals = self.hospital_repository.get_all()
        return [h for h in hospitals if name.lower() in h.name.lower()]
