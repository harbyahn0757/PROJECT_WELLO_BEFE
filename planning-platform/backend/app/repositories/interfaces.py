"""
Repository 인터페이스 정의

추상 인터페이스를 통해 의존성 역전 원칙(DIP)을 구현합니다.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from ..models.entities import (
    Patient, 
    Hospital, 
    CheckupResult, 
    CheckupDesign, 
    UserSession
)


class IPatientRepository(ABC):
    """환자 정보 저장소 인터페이스"""
    
    @abstractmethod
    async def create(self, patient: Patient) -> Patient:
        """환자 정보 생성"""
        pass
    
    @abstractmethod
    async def get_by_uuid(self, uuid: UUID) -> Optional[Patient]:
        """UUID로 환자 조회"""
        pass
    
    @abstractmethod
    async def get_by_phone(self, phone: str) -> Optional[Patient]:
        """전화번호로 환자 조회"""
        pass
    
    @abstractmethod
    async def update(self, patient: Patient) -> Patient:
        """환자 정보 업데이트"""
        pass
    
    @abstractmethod
    async def delete(self, uuid: UUID) -> bool:
        """환자 정보 삭제"""
        pass
    
    @abstractmethod
    async def get_patients_by_hospital(self, hospital_id: str) -> List[Patient]:
        """특정 병원의 환자 목록 조회"""
        pass


class IHospitalRepository(ABC):
    """병원 정보 저장소 인터페이스"""
    
    @abstractmethod
    async def create(self, hospital: Hospital) -> Hospital:
        """병원 정보 생성"""
        pass
    
    @abstractmethod
    async def get_by_id(self, hospital_id: str) -> Optional[Hospital]:
        """병원 ID로 조회"""
        pass
    
    @abstractmethod
    async def get_by_name(self, name: str) -> Optional[Hospital]:
        """병원명으로 조회"""
        pass
    
    @abstractmethod
    async def update(self, hospital: Hospital) -> Hospital:
        """병원 정보 업데이트"""
        pass
    
    @abstractmethod
    async def get_all_active(self) -> List[Hospital]:
        """활성화된 모든 병원 조회"""
        pass
    
    @abstractmethod
    async def search_by_address(self, city: str, district: str = None) -> List[Hospital]:
        """주소로 병원 검색"""
        pass


class ICheckupResultRepository(ABC):
    """검진 결과 저장소 인터페이스"""
    
    @abstractmethod
    async def create(self, result: CheckupResult) -> CheckupResult:
        """검진 결과 생성"""
        pass
    
    @abstractmethod
    async def get_by_id(self, result_id: UUID) -> Optional[CheckupResult]:
        """검진 결과 ID로 조회"""
        pass
    
    @abstractmethod
    async def get_by_patient(self, patient_uuid: UUID) -> List[CheckupResult]:
        """환자의 모든 검진 결과 조회"""
        pass
    
    @abstractmethod
    async def get_latest_by_patient(self, patient_uuid: UUID, limit: int = 5) -> List[CheckupResult]:
        """환자의 최근 검진 결과 조회"""
        pass
    
    @abstractmethod
    async def update(self, result: CheckupResult) -> CheckupResult:
        """검진 결과 업데이트"""
        pass
    
    @abstractmethod
    async def delete(self, result_id: UUID) -> bool:
        """검진 결과 삭제"""
        pass


class ICheckupDesignRepository(ABC):
    """검진 설계 저장소 인터페이스"""
    
    @abstractmethod
    async def create(self, design: CheckupDesign) -> CheckupDesign:
        """검진 설계 생성"""
        pass
    
    @abstractmethod
    async def get_by_id(self, design_id: UUID) -> Optional[CheckupDesign]:
        """검진 설계 ID로 조회"""
        pass
    
    @abstractmethod
    async def get_by_patient(self, patient_uuid: UUID) -> List[CheckupDesign]:
        """환자의 모든 검진 설계 조회"""
        pass
    
    @abstractmethod
    async def get_latest_by_patient(self, patient_uuid: UUID) -> Optional[CheckupDesign]:
        """환자의 최신 검진 설계 조회"""
        pass
    
    @abstractmethod
    async def update(self, design: CheckupDesign) -> CheckupDesign:
        """검진 설계 업데이트"""
        pass
    
    @abstractmethod
    async def delete(self, design_id: UUID) -> bool:
        """검진 설계 삭제"""
        pass
    
    @abstractmethod
    async def cleanup_expired(self) -> int:
        """만료된 검진 설계 정리"""
        pass


class IUserSessionRepository(ABC):
    """사용자 세션 저장소 인터페이스"""
    
    @abstractmethod
    async def create(self, session: UserSession) -> UserSession:
        """세션 생성"""
        pass
    
    @abstractmethod
    async def get_by_id(self, session_id: str) -> Optional[UserSession]:
        """세션 ID로 조회"""
        pass
    
    @abstractmethod
    async def get_by_patient(self, patient_uuid: UUID) -> List[UserSession]:
        """환자의 모든 세션 조회"""
        pass
    
    @abstractmethod
    async def get_active_by_patient(self, patient_uuid: UUID) -> Optional[UserSession]:
        """환자의 활성 세션 조회"""
        pass
    
    @abstractmethod
    async def update(self, session: UserSession) -> UserSession:
        """세션 업데이트"""
        pass
    
    @abstractmethod
    async def delete(self, session_id: str) -> bool:
        """세션 삭제"""
        pass
    
    @abstractmethod
    async def cleanup_expired(self) -> int:
        """만료된 세션 정리"""
        pass
    
    @abstractmethod
    async def extend_session(self, session_id: str, minutes: int = 20) -> bool:
        """세션 연장"""
        pass

