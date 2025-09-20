#!/usr/bin/env python3
"""
김현우내과 건강검진 완전한 API 서버
1차 테스트용 완전 기능 구현
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uvicorn
import json
import uuid
from datetime import datetime, timedelta
import os
from pathlib import Path
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv("config.env")

# 더미 데이터 import
from app.data.dummy_data import PATIENTS_DATA, HOSPITALS_DATA

# API 라우터 import
from app.api.v1 import api_router

# 에러 타입 import
from app.services.tilko_service import TilkoServiceError, TilkoAuthError, TilkoApiError
from app.models.health_data import ErrorResponse

# FastAPI 앱 생성
app = FastAPI(
    title="김현우내과 건강검진 API",
    description="완전한 기능을 갖춘 건강검진 관리 시스템",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:9281", "http://localhost:9283", "http://192.168.0.54:9283", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(api_router, prefix="/api/v1")

# 에러 핸들러 등록
@app.exception_handler(TilkoAuthError)
async def tilko_auth_error_handler(request, exc: TilkoAuthError):
    """Tilko 인증 에러 핸들러"""
    return ErrorResponse(
        success=False,
        message=str(exc),
        error_code="AUTH_ERROR"
    )

@app.exception_handler(TilkoApiError)
async def tilko_api_error_handler(request, exc: TilkoApiError):
    """Tilko API 에러 핸들러"""
    return ErrorResponse(
        success=False,
        message=str(exc),
        error_code="API_ERROR"
    )

@app.exception_handler(TilkoServiceError)
async def tilko_service_error_handler(request, exc: TilkoServiceError):
    """Tilko 서비스 에러 핸들러"""
    return ErrorResponse(
        success=False,
        message=str(exc),
        error_code="SERVICE_ERROR"
    )

# === 데이터 모델 정의 (Pydantic 스키마) ===

class PatientCreate(BaseModel):
    name: str = Field(..., min_length=2, description="환자명")
    birth_date: str = Field(..., description="생년월일 (YYYY-MM-DD)")
    gender: str = Field(..., description="성별 (male/female)")
    phone: str = Field(..., description="전화번호")
    hospital_id: str = Field(..., description="병원 ID")
    email: Optional[str] = None

class PatientLogin(BaseModel):
    phone: str = Field(..., description="전화번호")

class PatientResponse(BaseModel):
    uuid: str
    name: str
    age: int
    gender: str
    phone: str
    hospital: Dict[str, Any]
    last_checkup_count: int
    created_at: str

class HospitalResponse(BaseModel):
    hospital_id: str
    name: str
    phone: str
    address: str
    supported_checkup_types: List[str]
    is_active: bool

class CheckupDesignRequest(BaseModel):
    patient_uuid: str
    additional_symptoms: Optional[List[str]] = None
    priority_areas: Optional[List[str]] = None

class CheckupDesignResponse(BaseModel):
    design_id: str
    patient_uuid: str
    recommended_items: List[Dict[str, Any]]
    gpt_analysis: str
    recommendation_reason: str
    priority: int
    estimated_cost: int
    created_at: str

class SessionResponse(BaseModel):
    session_token: str
    patient_uuid: str
    expires_at: str
    layout_type: str

class PageStateRequest(BaseModel):
    patient_uuid: str
    layout_type: str
    current_step: str
    form_data: Optional[Dict[str, Any]] = None

# === 세션 저장소 (실제로는 Redis 사용) ===
SESSIONS_DATA = {}
PAGE_STATES_DATA = {}

# === 유틸리티 함수 ===

def generate_session_token() -> str:
    return str(uuid.uuid4())

def calculate_age(birth_date: str) -> int:
    from datetime import datetime
    birth = datetime.strptime(birth_date, "%Y-%m-%d")
    today = datetime.now()
    return today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))

def get_hospital_by_patient(patient_uuid: str) -> Dict[str, Any]:
    patient = PATIENTS_DATA.get(patient_uuid)
    if patient:
        # dummy_data.py에서는 hospital 객체가 직접 포함되어 있음
        hospital = patient.get("hospital", {})
        return hospital
    return {}

# === API 엔드포인트 ===

@app.get("/")
async def root():
    return {
        "message": "김현우내과 건강검진 API 서버",
        "docs": "/docs",
        "health": "/health",
        "api_version": "v1",
        "endpoints": {
            "patients": "/api/v1/patients/",
            "hospitals": "/api/v1/hospitals/",
            "checkup_design": "/api/v1/checkup-design/",
            "sessions": "/api/v1/sessions/",
            "page_state": "/api/v1/page-state/"
        }
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "김현우내과 건강검진 API",
        "timestamp": datetime.now().isoformat(),
        "patients_count": len(PATIENTS_DATA),
        "hospitals_count": len(HOSPITALS_DATA),
        "active_sessions": len(SESSIONS_DATA)
    }

if __name__ == "__main__":
    print("🚀 김현우내과 건강검진 완전한 API 서버 시작...")
    uvicorn.run(app, host="127.0.0.1", port=8082)
