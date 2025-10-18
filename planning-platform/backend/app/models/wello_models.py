"""
WELLO 건강정보 데이터베이스 모델
Tilko API로 수집한 건강정보 저장 및 관리
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Text, DECIMAL, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

Base = declarative_base()

class WelloPatient(Base):
    """환자 기본정보 테이블"""
    __tablename__ = "wello_patients"
    
    # 기본 식별자
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), nullable=False, index=True)  # URL 파라미터의 UUID
    hospital_id = Column(String(20), nullable=False, index=True)  # URL 파라미터의 병원 ID
    
    # 개인정보 (Tilko 인증 시 사용)
    name = Column(String(50), nullable=False)
    phone_number = Column(String(20), nullable=False, index=True)
    birth_date = Column(Date, nullable=False)
    gender = Column(String(1), nullable=True)  # 'M', 'F'
    
    # 인증 관련
    last_auth_at = Column(DateTime(timezone=True), nullable=True)
    tilko_session_id = Column(String(100), nullable=True)
    
    # 데이터 수집 상태
    has_health_data = Column(Boolean, default=False)
    has_prescription_data = Column(Boolean, default=False)
    last_data_update = Column(DateTime(timezone=True), nullable=True)
    
    # 메타데이터
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 관계
    checkup_data = relationship("WelloCheckupData", back_populates="patient", cascade="all, delete-orphan")
    prescription_data = relationship("WelloPrescriptionData", back_populates="patient", cascade="all, delete-orphan")
    collection_history = relationship("WelloCollectionHistory", back_populates="patient", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<WelloPatient(uuid={self.uuid}, name={self.name}, hospital={self.hospital_id})>"

class WelloCheckupData(Base):
    """건강검진 데이터 테이블"""
    __tablename__ = "wello_checkup_data"
    
    # 기본 식별자
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("wello_patients.id"), nullable=False)
    
    # Tilko API 응답 필드 매핑
    year = Column(String(10), nullable=True)  # "2021년"
    checkup_date = Column(String(20), nullable=True)  # "09/28"
    location = Column(String(100), nullable=True)  # "이루탄메디케어의원"
    code = Column(String(20), nullable=True)  # "의심", "정상", "이상"
    description = Column(Text, nullable=True)  # 상세 설명
    
    # 검진 수치 데이터 (확장 가능)
    height = Column(DECIMAL(5,2), nullable=True)  # 신장 (cm)
    weight = Column(DECIMAL(5,2), nullable=True)  # 체중 (kg)
    blood_pressure_high = Column(Integer, nullable=True)  # 수축기 혈압
    blood_pressure_low = Column(Integer, nullable=True)   # 이완기 혈압
    blood_sugar = Column(Integer, nullable=True)  # 공복혈당 (mg/dL)
    cholesterol = Column(Integer, nullable=True)  # 총콜레스테롤 (mg/dL)
    
    # 원본 데이터 보관 (JSON)
    raw_data = Column(JSON, nullable=True)  # Tilko API 원본 응답
    
    # 메타데이터
    collected_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 관계
    patient = relationship("WelloPatient", back_populates="checkup_data")
    
    def __repr__(self):
        return f"<WelloCheckupData(patient_id={self.patient_id}, year={self.year}, date={self.checkup_date})>"

class WelloPrescriptionData(Base):
    """처방전 데이터 테이블"""
    __tablename__ = "wello_prescription_data"
    
    # 기본 식별자
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("wello_patients.id"), nullable=False)
    
    # Tilko API 응답 필드 매핑
    idx = Column(String(10), nullable=True)  # "1"
    page = Column(String(10), nullable=True)  # "1"
    hospital_name = Column(String(100), nullable=True, index=True)  # "케어빌한의원"
    address = Column(String(200), nullable=True)  # "영등포구 당산로"
    treatment_date = Column(Date, nullable=True, index=True)  # "2023-06-20"
    treatment_type = Column(String(50), nullable=True)  # "한방기관외래"
    
    # 방문/처방 횟수
    visit_count = Column(Integer, default=0)  # BangMoonIpWonIlsoo
    medication_count = Column(Integer, default=0)  # TuYakYoYangHoiSoo
    prescription_count = Column(Integer, default=0)  # CheoBangHoiSoo
    
    # 처방 상세 정보 (JSON 배열)
    prescription_details = Column(JSON, nullable=True)  # RetrieveTreatmentInjectionInformationPersonDetailList
    
    # 원본 데이터 보관 (JSON)
    raw_data = Column(JSON, nullable=True)  # Tilko API 원본 응답
    
    # 메타데이터
    collected_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 관계
    patient = relationship("WelloPatient", back_populates="prescription_data")
    
    def __repr__(self):
        return f"<WelloPrescriptionData(patient_id={self.patient_id}, hospital={self.hospital_name}, date={self.treatment_date})>"

class WelloCollectionHistory(Base):
    """데이터 수집 이력 테이블"""
    __tablename__ = "wello_collection_history"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("wello_patients.id"), nullable=False)
    
    # 수집 정보
    collection_type = Column(String(20), nullable=False)  # 'health', 'prescription', 'both'
    tilko_session_id = Column(String(100), nullable=True, index=True)
    
    # 수집 결과
    success = Column(Boolean, default=False)
    health_records_count = Column(Integer, default=0)
    prescription_records_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    
    # 메타데이터
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # 관계
    patient = relationship("WelloPatient", back_populates="collection_history")
    
    def __repr__(self):
        return f"<WelloCollectionHistory(patient_id={self.patient_id}, type={self.collection_type}, success={self.success})>"

# Pydantic 모델 (API 응답용)
class WelloPatientResponse(BaseModel):
    """환자 정보 응답 모델"""
    id: int
    uuid: str
    hospital_id: str
    name: str
    phone_number: str
    birth_date: date
    gender: Optional[str]
    has_health_data: bool
    has_prescription_data: bool
    last_data_update: Optional[datetime]
    last_auth_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class WelloCheckupDataResponse(BaseModel):
    """건강검진 데이터 응답 모델"""
    id: int
    year: Optional[str]
    checkup_date: Optional[str]
    location: Optional[str]
    code: Optional[str]
    description: Optional[str]
    height: Optional[float]
    weight: Optional[float]
    blood_pressure_high: Optional[int]
    blood_pressure_low: Optional[int]
    blood_sugar: Optional[int]
    cholesterol: Optional[int]
    collected_at: datetime
    
    class Config:
        from_attributes = True

class WelloPrescriptionDataResponse(BaseModel):
    """처방전 데이터 응답 모델"""
    id: int
    hospital_name: Optional[str]
    address: Optional[str]
    treatment_date: Optional[date]
    treatment_type: Optional[str]
    visit_count: int
    medication_count: int
    prescription_count: int
    prescription_details: Optional[List[Dict[str, Any]]]
    collected_at: datetime
    
    class Config:
        from_attributes = True

class WelloHealthDataSummary(BaseModel):
    """건강정보 요약 응답 모델"""
    patient: WelloPatientResponse
    checkup_data: List[WelloCheckupDataResponse]
    prescription_data: List[WelloPrescriptionDataResponse]
    total_checkups: int
    total_prescriptions: int
    last_update: Optional[datetime]
    
    class Config:
        from_attributes = True
