"""
레포지토리 구현
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from ..models.entities import (
    Hospital, HospitalInfo, ContactInfo, Address,
    Patient, PatientInfo,
    CheckupResult, CheckupDesign, UserSession
)
from ..data.dummy_data import HOSPITALS_DATA, PATIENTS_DATA

class HospitalRepository:
    """병원 레포지토리"""
    
    async def get_by_id(self, hospital_id: str) -> Optional[Hospital]:
        """ID로 병원 조회"""
        if hospital_id in HOSPITALS_DATA:
            data = HOSPITALS_DATA[hospital_id]
            return Hospital(
                    hospital_id=data["hospital_id"],
                    info=HospitalInfo(name=data["name"]),
                    contact=ContactInfo(phone=data["phone"]),
                    address=Address(city="서울", district="강남구", detail=data["address"]),
                    supported_checkup_types=data["supported_checkup_types"],
                    layout_type=data["layout_type"],
                    brand_color=data["brand_color"],
                    logo_position=data["logo_position"],
                    is_active=data["is_active"]
                )
        return None
    
    async def get_by_name(self, name: str) -> Optional[Hospital]:
        """이름으로 병원 조회"""
        for hospital_id, data in HOSPITALS_DATA.items():
            if data["name"] == name:
                return Hospital(
                    hospital_id=data["hospital_id"],
                    info=HospitalInfo(name=data["name"]),
                    contact=ContactInfo(phone=data["phone"]),
                    address=Address(city="서울", district="강남구", detail=data["address"]),
                    supported_checkup_types=data["supported_checkup_types"],
                    layout_type=data["layout_type"],
                    brand_color=data["brand_color"],
                    logo_position=data["logo_position"],
                    is_active=data["is_active"]
                )
        return None
    
    async def get_all_active(self) -> List[Hospital]:
        """활성화된 모든 병원 조회"""
        hospitals = []
        for hospital_id, data in HOSPITALS_DATA.items():
            if data.get("is_active", True):
                hospitals.append(Hospital(
                    hospital_id=data["hospital_id"],
                    info=HospitalInfo(name=data["name"]),
                    contact=ContactInfo(phone=data["phone"]),
                    address=Address(city="서울", district="강남구", detail=data["address"]),
                    supported_checkup_types=data["supported_checkup_types"],
                    layout_type=data["layout_type"],
                    brand_color=data["brand_color"],
                    logo_position=data["logo_position"],
                    is_active=data["is_active"]
                ))
        return hospitals
    
    async def search_by_address(self, city: str, district: Optional[str] = None) -> List[Hospital]:
        """주소로 병원 검색"""
        hospitals = []
        for data in HOSPITALS_DATA:
            if data["address"]["city"] == city and (
                not district or data["address"]["district"] == district
            ):
                hospitals.append(Hospital(
                    hospital_id=data["hospital_id"],
                    info=HospitalInfo(name=data["name"]),
                    contact=ContactInfo(phone=data["phone"]),
                    address=Address(city="서울", district="강남구", detail=data["address"]),
                    supported_checkup_types=data["supported_checkup_types"],
                    layout_type=data["layout_type"],
                    brand_color=data["brand_color"],
                    logo_position=data["logo_position"],
                    is_active=data["is_active"]
                ))
        return hospitals


class PatientRepository:
    """환자 레포지토리"""
    
    async def get_by_uuid(self, uuid: UUID) -> Optional[Patient]:
        """UUID로 환자 조회"""
        uuid_str = str(uuid)
        if uuid_str in PATIENTS_DATA:
            data = PATIENTS_DATA[uuid_str]
            return Patient(
                    uuid=UUID(data["uuid"]),
                    info=PatientInfo(
                        name=data["name"],
                        age=data["age"],
                        gender=data["gender"]
                    ),
                    phone=data["phone"],
                    hospital_id=data["hospital"]["hospital_id"],
                    last_checkup_count=1,
                    created_at=datetime.now()
                )
        return None
    
    async def get_by_phone(self, phone: str) -> Optional[Patient]:
        """전화번호로 환자 조회"""
        for data in PATIENTS_DATA:
            if data["phone"] == phone:
                return Patient(
                    uuid=UUID(data["uuid"]),
                    info=PatientInfo(
                        name=data["name"],
                        age=data["age"],
                        gender=data["gender"]
                    ),
                    phone=data["phone"],
                    hospital_id=data["hospital"]["hospital_id"],
                    last_checkup_count=1,
                    created_at=datetime.now()
                )
        return None


class CheckupResultRepository:
    """검진 결과 레포지토리"""
    
    async def get_by_patient(self, patient_uuid: UUID) -> List[CheckupResult]:
        """환자의 검진 결과 조회"""
        # TODO: 실제 데이터베이스 연동
        return []


class CheckupDesignRepository:
    """검진 설계 레포지토리"""
    
    async def save(self, design: CheckupDesign) -> str:
        """검진 설계 저장"""
        # TODO: 실제 데이터베이스 연동
        return design.design_id
    
    async def get_by_patient(self, patient_uuid: UUID) -> List[CheckupDesign]:
        """환자의 검진 설계 조회"""
        # TODO: 실제 데이터베이스 연동
        return []


class UserSessionRepository:
    """사용자 세션 레포지토리"""
    
    async def save(self, session: UserSession) -> str:
        """세션 저장"""
        # TODO: 실제 데이터베이스 연동
        return session.session_id
    
    async def get_by_id(self, session_id: str) -> Optional[UserSession]:
        """세션 ID로 조회"""
        # TODO: 실제 데이터베이스 연동
        return None
    
    async def update(self, session: UserSession) -> bool:
        """세션 업데이트"""
        # TODO: 실제 데이터베이스 연동
        return True
    
    async def delete(self, session_id: str) -> bool:
        """세션 삭제"""
        # TODO: 실제 데이터베이스 연동
        return True