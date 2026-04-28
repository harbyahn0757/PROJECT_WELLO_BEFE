"""
WELNO 건강정보 데이터베이스 모델
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

class WelnoPatient(Base):
    """환자 기본정보 테이블"""
    __tablename__ = "welno_patients"
    
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
    has_mediarc_report = Column(Boolean, default=False)  # Mediarc 질병예측 리포트 존재 여부
    has_questionnaire_data = Column(Boolean, default=False)  # 문진 데이터 포함 여부
    last_data_update = Column(DateTime(timezone=True), nullable=True)
    
    # 🔐 비밀번호 관련 필드
    password_hash = Column(String(255), nullable=True)  # bcrypt 해시
    password_set_at = Column(DateTime(timezone=True), nullable=True)  # 설정 시간
    last_password_prompt = Column(DateTime(timezone=True), nullable=True)  # 마지막 권유 시간
    password_attempts = Column(Integer, default=0)  # 연속 실패 횟수
    password_locked_until = Column(DateTime(timezone=True), nullable=True)  # 잠금 해제 시간
    last_access_at = Column(DateTime(timezone=True), nullable=True)  # 마지막 접근 시간
    
    # 🧠 페르소나 및 채팅 분석 데이터
    chat_persona_data = Column(JSON, nullable=True)  # 채팅 기반 페르소나 분석 결과

    # 약관 동의 (SoT: terms_agreement_detail + terms_all_required_agreed_at)
    # DB 실측 2026-04-28: terms_agreement_detail 2,606건 ACTIVE / terms_agreement 0건 DEAD
    terms_agreement_detail = Column(JSON, nullable=True)  # 약관별 동의 상세 {terms_service:{agreed,agreed_at}, ...}
    terms_all_required_agreed_at = Column(DateTime(timezone=True), nullable=True)  # 마지막 필수 약관 동의 시각 (ACTIVE 컬럼)
    # 아래 두 컬럼은 DB에 존재하나 DEAD (누적 0건) — DROP 전까지 모델에 기록만
    # terms_agreement = JSONB (Path A, 0건) — dead
    # terms_agreed_at = TIMESTAMPTZ (Path A timestamp, 0건) — dead

    # 메타데이터
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 관계
    checkup_data = relationship("WelnoCheckupData", back_populates="patient", cascade="all, delete-orphan")
    prescription_data = relationship("WelnoPrescriptionData", back_populates="patient", cascade="all, delete-orphan")
    mediarc_reports = relationship("WelnoMediarcReport", back_populates="patient", cascade="all, delete-orphan")
    collection_history = relationship("WelnoCollectionHistory", back_populates="patient", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<WelnoPatient(uuid={self.uuid}, name={self.name}, hospital={self.hospital_id})>"

class WelnoCheckupData(Base):
    """건강검진 데이터 테이블"""
    __tablename__ = "welno_checkup_data"
    
    # 기본 식별자
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("welno_patients.id"), nullable=False)
    
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
    patient = relationship("WelnoPatient", back_populates="checkup_data")
    
    def __repr__(self):
        return f"<WelnoCheckupData(patient_id={self.patient_id}, year={self.year}, date={self.checkup_date})>"

class WelnoPrescriptionData(Base):
    """처방전 데이터 테이블"""
    __tablename__ = "welno_prescription_data"
    
    # 기본 식별자
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("welno_patients.id"), nullable=False)
    
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
    patient = relationship("WelnoPatient", back_populates="prescription_data")
    
    def __repr__(self):
        return f"<WelnoPrescriptionData(patient_id={self.patient_id}, hospital={self.hospital_name}, date={self.treatment_date})>"

class WelnoMediarcReport(Base):
    """Mediarc 질병예측 리포트 테이블"""
    __tablename__ = "welno_mediarc_reports"
    
    # 기본 식별자
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("welno_patients.id"), nullable=False)
    patient_uuid = Column(String(36), nullable=False, index=True)
    hospital_id = Column(String(20), nullable=False, index=True)
    
    # 원본 응답 전체 저장 (JSONB)
    raw_response = Column(JSON, nullable=False)  # Mediarc/Twobecon API 원본 응답
    
    # 자주 사용되는 필드
    mkt_uuid = Column(String(50), unique=True, nullable=True, index=True)  # 마케팅 UUID
    report_url = Column(Text, nullable=True)  # PDF 리포트 URL
    provider = Column(String(20), default='twobecon')  # 제공자
    
    # 분석 결과 핵심 정보
    analyzed_at = Column(DateTime(timezone=True), nullable=True, index=True)  # 분석 완료 시각
    bodyage = Column(Integer, nullable=True)  # 체질 나이 (건강 나이)
    rank = Column(Integer, nullable=True)  # 등수 (상위 몇%)
    
    # 질병 및 암 예측 데이터 (JSONB)
    disease_data = Column(JSON, nullable=True)  # 질병 예측 결과
    cancer_data = Column(JSON, nullable=True)  # 암 예측 결과
    
    # 문진 데이터 포함 여부
    has_questionnaire = Column(Boolean, default=False)
    questionnaire_data = Column(JSON, nullable=True)  # 문진 응답 데이터
    
    # 메타데이터
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 관계
    patient = relationship("WelnoPatient", back_populates="mediarc_reports")
    
    def __repr__(self):
        return f"<WelnoMediarcReport(patient_id={self.patient_id}, bodyage={self.bodyage}, analyzed_at={self.analyzed_at})>"

class WelnoCollectionHistory(Base):
    """데이터 수집 이력 테이블"""
    __tablename__ = "welno_collection_history"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("welno_patients.id"), nullable=False)
    
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
    patient = relationship("WelnoPatient", back_populates="collection_history")
    
    def __repr__(self):
        return f"<WelnoCollectionHistory(patient_id={self.patient_id}, type={self.collection_type}, success={self.success})>"

# Pydantic 모델 (API 응답용)
class WelnoPatientResponse(BaseModel):
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

class WelnoCheckupDataResponse(BaseModel):
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

class WelnoPrescriptionDataResponse(BaseModel):
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

class WelnoMediarcReportResponse(BaseModel):
    """Mediarc 리포트 응답 모델"""
    id: int
    patient_uuid: str
    hospital_id: str
    mkt_uuid: Optional[str]
    report_url: Optional[str]
    provider: str
    analyzed_at: Optional[datetime]
    bodyage: Optional[int]
    rank: Optional[int]
    disease_data: Optional[Dict[str, Any]]
    cancer_data: Optional[Dict[str, Any]]
    has_questionnaire: bool
    questionnaire_data: Optional[Dict[str, Any]]
    created_at: datetime
    
    class Config:
        from_attributes = True

class WelnoHealthDataSummary(BaseModel):
    """건강정보 요약 응답 모델"""
    patient: WelnoPatientResponse
    checkup_data: List[WelnoCheckupDataResponse]
    prescription_data: List[WelnoPrescriptionDataResponse]
    total_checkups: int
    total_prescriptions: int
    last_update: Optional[datetime]
    
    class Config:
        from_attributes = True

class PartnerRagChatLog(Base):
    """파트너 RAG 채팅 대화 로그 테이블"""
    __tablename__ = "tb_partner_rag_chat_log"
    __table_args__ = {"schema": "welno"}
    
    id = Column(BigInteger, primary_key=True, index=True)
    partner_id = Column(String(50), nullable=False)
    hospital_id = Column(String(255), nullable=False)
    user_uuid = Column(String(128), nullable=False)
    session_id = Column(String(255), nullable=False)
    client_info = Column(JSON, nullable=True)
    initial_data = Column(JSON, nullable=True)
    conversation = Column(JSON, nullable=False, default=[])
    message_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class HospitalRagConfig(Base):
    """병원별 RAG/LLM 설정 관리 테이블"""
    __tablename__ = "tb_hospital_rag_config"
    __table_args__ = {"schema": "welno"}
    
    id = Column(Integer, primary_key=True, index=True)
    partner_id = Column(String(50), nullable=False)
    hospital_id = Column(String(255), nullable=False)
    hospital_name = Column(String(255), nullable=True) # 추가된 컬럼
    
    persona_prompt = Column(Text, nullable=True)
    welcome_message = Column(Text, nullable=True)
    
    llm_config = Column(JSON, nullable=True, default={
        "model": "gemini-3-flash-preview",
        "temperature": 0.7,
        "max_tokens": 2000
    })
    embedding_config = Column(JSON, nullable=True, default={
        "model": "text-embedding-ada-002",
        "index_name": "faiss_db"
    })
    theme_config = Column(JSON, nullable=True, default={
        "theme": "default",
        "logo_url": None,
        "primary_color": "#7B5E4F"
    })
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
