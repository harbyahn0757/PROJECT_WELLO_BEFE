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

# 더미 데이터 import
from app.data.dummy_data import PATIENTS_DATA, HOSPITALS_DATA

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

# === 환자 관련 API ===

@app.post("/api/v1/patients/login", response_model=PatientResponse)
async def login_patient(request: PatientLogin):
    """환자 로그인 (전화번호 기반)"""
    for patient in PATIENTS_DATA.values():
        if patient["phone"] == request.phone:
            hospital = get_hospital_by_patient(patient["uuid"])
            return PatientResponse(
                uuid=patient["uuid"],
                name=patient["name"],
                age=patient["age"],
                gender=patient["gender"],
                phone=patient["phone"],
                hospital=hospital,
                last_checkup_count=patient["last_checkup_count"],
                created_at=patient["created_at"]
            )
    raise HTTPException(status_code=404, detail="등록된 환자를 찾을 수 없습니다")

@app.post("/api/v1/patients/", response_model=PatientResponse)
async def create_patient(request: PatientCreate):
    """새 환자 등록"""
    # 전화번호 중복 확인
    for patient in PATIENTS_DATA.values():
        if patient["phone"] == request.phone:
            raise HTTPException(status_code=400, detail="이미 등록된 전화번호입니다")
    
    # 병원 존재 확인
    if request.hospital_id not in HOSPITALS_DATA:
        raise HTTPException(status_code=400, detail="존재하지 않는 병원입니다")
    
    patient_uuid = str(uuid.uuid4())
    age = calculate_age(request.birth_date)
    
    new_patient = {
        "uuid": patient_uuid,
        "name": request.name,
        "age": age,
        "gender": request.gender,
        "phone": request.phone,
        "birth_date": request.birth_date,
        "hospital_id": request.hospital_id,
        "email": request.email,
        "last_checkup_count": 0,
        "created_at": datetime.now().isoformat()
    }
    
    PATIENTS_DATA[patient_uuid] = new_patient
    hospital = get_hospital_by_patient(patient_uuid)
    
    return PatientResponse(
        uuid=patient_uuid,
        name=new_patient["name"],
        age=new_patient["age"],
        gender=new_patient["gender"],
        phone=new_patient["phone"],
        hospital=hospital,
        last_checkup_count=new_patient["last_checkup_count"],
        created_at=new_patient["created_at"]
    )

@app.get("/api/v1/patients/{patient_uuid}", response_model=PatientResponse)
async def get_patient(patient_uuid: str):
    """특정 환자 정보 조회"""
    if patient_uuid not in PATIENTS_DATA:
        raise HTTPException(status_code=404, detail="환자를 찾을 수 없습니다")
    
    patient = PATIENTS_DATA[patient_uuid]
    hospital = get_hospital_by_patient(patient_uuid)
    
    return PatientResponse(
        uuid=patient["uuid"],
        name=patient["name"],
        age=patient["age"],
        gender=patient["gender"],
        phone=patient["phone"],
        hospital=hospital,
        last_checkup_count=3,  # 기본값 설정
        created_at="2024-01-15T09:00:00"  # 기본값 설정
    )

# === 병원 관련 API ===

@app.get("/api/v1/hospitals/", response_model=List[HospitalResponse])
async def get_hospitals():
    """병원 목록 조회"""
    return [
        HospitalResponse(**hospital)
        for hospital in HOSPITALS_DATA.values()
        if hospital["is_active"]
    ]

@app.get("/api/v1/hospitals/{hospital_id}", response_model=HospitalResponse)
async def get_hospital(hospital_id: str):
    """특정 병원 정보 조회"""
    if hospital_id not in HOSPITALS_DATA:
        raise HTTPException(status_code=404, detail="병원을 찾을 수 없습니다")
    
    return HospitalResponse(**HOSPITALS_DATA[hospital_id])

@app.get("/api/v1/hospitals/search/by-name")
async def search_hospital_by_name(name: str):
    """병원명으로 검색"""
    for hospital in HOSPITALS_DATA.values():
        if name in hospital["name"]:
            return HospitalResponse(**hospital)
    return None

# === 검진 설계 API ===

@app.post("/api/v1/checkup-design/design", response_model=CheckupDesignResponse)
async def create_checkup_design(request: CheckupDesignRequest):
    """맞춤형 검진 설계"""
    if request.patient_uuid not in PATIENTS_DATA:
        raise HTTPException(status_code=404, detail="환자를 찾을 수 없습니다")
    
    patient = PATIENTS_DATA[request.patient_uuid]
    age = patient["age"]
    
    # 연령별 맞춤 검진 추천
    recommended_items = []
    
    # 기본 검진
    recommended_items.append({
        "checkup_type": "basic",
        "item_name": "기본 혈액검사",
        "description": "혈압, 혈당, 콜레스테롤 등 기본 검사",
        "cost": 80000
    })
    
    # 연령별 추가 검진
    if age >= 40:
        recommended_items.append({
            "checkup_type": "comprehensive",
            "item_name": "종합건강검진",
            "description": "연례 종합 건강 상태 점검",
            "cost": 300000
        })
    
    if age >= 50:
        recommended_items.extend([
            {
                "checkup_type": "cancer",
                "item_name": "위내시경",
                "description": "위암 조기 발견을 위한 검사",
                "cost": 150000
            },
            {
                "checkup_type": "heart",
                "item_name": "심장 초음파",
                "description": "심혈관 질환 예방 검사",
                "cost": 200000
            }
        ])
    
    # 추가 증상별 검진
    if request.additional_symptoms:
        if "diabetes" in request.additional_symptoms:
            recommended_items.append({
                "checkup_type": "diabetes",
                "item_name": "당뇨병 정밀검사",
                "description": "혈당, 당화혈색소, 인슐린 저항성 검사",
                "cost": 120000
            })
    
    total_cost = sum(item["cost"] for item in recommended_items)
    priority = 1 if age >= 50 else 2
    
    design_id = f"design_{request.patient_uuid}_{int(datetime.now().timestamp())}"
    
    return CheckupDesignResponse(
        design_id=design_id,
        patient_uuid=request.patient_uuid,
        recommended_items=recommended_items,
        gpt_analysis=f"{patient['name']}님({age}세)의 연령과 건강 상태를 고려한 맞춤형 검진을 설계했습니다. 예방적 차원에서 정기적인 검진을 권장드립니다.",
        recommendation_reason=f"연령대({age}세)에 적합한 검진 항목들을 선별했으며, 조기 발견과 예방에 중점을 두었습니다.",
        priority=priority,
        estimated_cost=total_cost,
        created_at=datetime.now().isoformat()
    )

@app.get("/api/v1/checkup-design/patient/{patient_uuid}/analysis")
async def analyze_patient_trends(patient_uuid: str):
    """환자 검진 결과 추이 분석"""
    if patient_uuid not in PATIENTS_DATA:
        raise HTTPException(status_code=404, detail="환자를 찾을 수 없습니다")
    
    patient = PATIENTS_DATA[patient_uuid]
    checkup_count = patient["last_checkup_count"]
    
    if checkup_count == 0:
        analysis = "기존 검진 결과가 없어 추이 분석이 제한적입니다."
        recommendations = ["정기 건강검진을 시작해보시기 바랍니다."]
        risk_factors = ["검진 이력 부족"]
    else:
        analysis = f"지난 {checkup_count}회의 검진 기록을 바탕으로 전반적으로 양호한 건강 상태를 유지하고 계십니다."
        recommendations = ["현재 건강 상태를 유지하시기 바랍니다.", "1년 후 정기 검진을 권장합니다."]
        risk_factors = ["특별한 위험 요소 없음"]
    
    return {
        "patient_uuid": patient_uuid,
        "analysis": analysis,
        "recommendations": recommendations,
        "risk_factors": risk_factors,
        "next_checkup_date": "2024-12-31",
        "checkup_history_count": checkup_count
    }

# === 세션 관리 API ===

@app.post("/api/v1/sessions/create", response_model=SessionResponse)
async def create_session(patient_uuid: str, layout_type: str = "vertical"):
    """세션 생성 (20분 타임아웃)"""
    if patient_uuid not in PATIENTS_DATA:
        raise HTTPException(status_code=404, detail="환자를 찾을 수 없습니다")
    
    session_token = generate_session_token()
    expires_at = datetime.now() + timedelta(minutes=20)
    
    SESSIONS_DATA[session_token] = {
        "patient_uuid": patient_uuid,
        "layout_type": layout_type,
        "created_at": datetime.now().isoformat(),
        "expires_at": expires_at.isoformat(),
        "last_accessed": datetime.now().isoformat()
    }
    
    return SessionResponse(
        session_token=session_token,
        patient_uuid=patient_uuid,
        expires_at=expires_at.isoformat(),
        layout_type=layout_type
    )

@app.get("/api/v1/sessions/{session_token}")
async def validate_session(session_token: str):
    """세션 유효성 검증"""
    if session_token not in SESSIONS_DATA:
        raise HTTPException(status_code=404, detail="유효하지 않은 세션입니다")
    
    session = SESSIONS_DATA[session_token]
    expires_at = datetime.fromisoformat(session["expires_at"])
    
    if datetime.now() > expires_at:
        del SESSIONS_DATA[session_token]
        raise HTTPException(status_code=401, detail="세션이 만료되었습니다")
    
    # 세션 연장
    new_expires_at = datetime.now() + timedelta(minutes=20)
    session["expires_at"] = new_expires_at.isoformat()
    session["last_accessed"] = datetime.now().isoformat()
    
    return {
        "valid": True,
        "patient_uuid": session["patient_uuid"],
        "layout_type": session["layout_type"],
        "expires_at": session["expires_at"]
    }

@app.delete("/api/v1/sessions/{session_token}")
async def delete_session(session_token: str):
    """세션 삭제"""
    if session_token in SESSIONS_DATA:
        del SESSIONS_DATA[session_token]
        return {"message": "세션이 삭제되었습니다"}
    raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

# === 페이지 상태 저장 API ===

@app.post("/api/v1/page-state/save")
async def save_page_state(request: PageStateRequest):
    """프론트엔드 페이지 상태 저장"""
    if request.patient_uuid not in PATIENTS_DATA:
        raise HTTPException(status_code=404, detail="환자를 찾을 수 없습니다")
    
    state_key = f"{request.patient_uuid}_{request.layout_type}"
    
    PAGE_STATES_DATA[state_key] = {
        "patient_uuid": request.patient_uuid,
        "layout_type": request.layout_type,
        "current_step": request.current_step,
        "form_data": request.form_data or {},
        "saved_at": datetime.now().isoformat()
    }
    
    return {"message": "페이지 상태가 저장되었습니다", "state_key": state_key}

@app.get("/api/v1/page-state/{patient_uuid}")
async def get_page_state(patient_uuid: str, layout_type: str = "vertical"):
    """저장된 페이지 상태 조회"""
    state_key = f"{patient_uuid}_{layout_type}"
    
    if state_key not in PAGE_STATES_DATA:
        return {
            "patient_uuid": patient_uuid,
            "layout_type": layout_type,
            "current_step": "welcome",
            "form_data": {},
            "saved_at": None
        }
    
    return PAGE_STATES_DATA[state_key]

# === URL 파라미터 기반 라우팅 ===

@app.get("/api/v1/layout/determine")
async def determine_layout(
    uuid: Optional[str] = None,
    hospital: Optional[str] = None,
    layout: Optional[str] = None
):
    """URL 파라미터를 기반으로 레이아웃 결정"""
    
    # 기본값
    result_layout = "vertical"
    patient_info = None
    hospital_info = None
    
    # UUID가 제공된 경우 환자 정보 조회
    if uuid and uuid in PATIENTS_DATA:
        patient_info = PATIENTS_DATA[uuid]
        hospital_info = get_hospital_by_patient(uuid)
    
    # 병원명이 제공된 경우 병원 정보 조회
    if hospital:
        for h_id, h_data in HOSPITALS_DATA.items():
            if hospital.lower() in h_data["name"].lower():
                hospital_info = h_data
                break
    
    # layout 파라미터가 명시적으로 제공된 경우
    if layout in ["horizontal", "vertical"]:
        result_layout = layout
    
    # 병원별 기본 레이아웃 설정 (김현우내과는 horizontal)
    elif hospital_info and "김현우내과" in hospital_info.get("name", ""):
        result_layout = "horizontal"
    
    return {
        "layout_type": result_layout,
        "patient_info": patient_info,
        "hospital_info": hospital_info,
        "url_params": {
            "uuid": uuid,
            "hospital": hospital,
            "layout": layout
        }
    }

if __name__ == "__main__":
    print("🚀 김현우내과 건강검진 완전한 API 서버 시작...")
    uvicorn.run(app, host="127.0.0.1", port=8082)
