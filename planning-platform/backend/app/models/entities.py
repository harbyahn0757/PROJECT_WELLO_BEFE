"""
도메인 엔티티 정의
"""

from typing import List, Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field

class ContactInfo(BaseModel):
    """연락처 정보"""
    phone: str
    email: Optional[str] = None

class Address(BaseModel):
    """주소 정보"""
    city: str
    district: str
    detail: str
    
    def get_full_address(self) -> str:
        """전체 주소 문자열 반환"""
        return f"{self.city}특별시 {self.district} {self.detail}"

class HospitalInfo(BaseModel):
    """병원 기본 정보"""
    name: str
    description: Optional[str] = None
    business_hours: Optional[str] = None

class Hospital(BaseModel):
    """병원 엔티티"""
    hospital_id: str
    info: HospitalInfo
    contact: ContactInfo
    address: Address
    supported_checkup_types: List[str]
    layout_type: str = Field(..., description="레이아웃 타입 (horizontal/vertical)")
    brand_color: str = Field(..., description="브랜드 색상 (hex)")
    logo_position: str = Field(..., description="로고 위치 (left/center/right)")
    is_active: bool = True

class PatientInfo(BaseModel):
    """환자 기본 정보"""
    name: str
    age: int
    gender: str
    birth_date: Optional[datetime] = None
    
    def get_age(self) -> int:
        """나이 계산"""
        return self.age  # 실제로는 birth_date 기반 계산

class Patient(BaseModel):
    """환자 엔티티"""
    uuid: UUID
    info: PatientInfo
    phone: str
    hospital_id: str
    last_checkup_count: int = 0
    created_at: datetime

class CheckupItem(BaseModel):
    """검진 항목"""
    item_id: str
    name: str
    description: str
    cost: int
    type: str

class CheckupResult(BaseModel):
    """검진 결과"""
    result_id: str
    patient_uuid: UUID
    checkup_date: datetime
    items: List[CheckupItem]
    is_normal: bool
    memo: Optional[str] = None

class CheckupDesign(BaseModel):
    """검진 설계"""
    design_id: str
    patient_uuid: UUID
    recommended_items: List[CheckupItem]
    gpt_analysis: str
    recommendation_reason: str
    priority: int
    estimated_cost: int
    created_at: datetime
    expires_at: Optional[datetime] = None

class UserSession(BaseModel):
    """사용자 세션"""
    session_id: str
    user_id: str
    device_id: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    is_active: bool = True