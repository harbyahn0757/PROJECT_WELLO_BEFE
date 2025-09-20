#!/usr/bin/env python3
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import json
from datetime import datetime

app = FastAPI(title="김현우내과 건강검진 API")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:9281"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 더미 데이터
patients_data = {
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890": {
        "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "김철수",
        "age": 39,
        "gender": "male",
        "phone": "010-1234-5678",
        "hospital": {
            "id": "KHW001",
            "name": "김현우내과의원",
            "phone": "02-2215-9964",
            "address": "서울특별시 동대문구 전농로 124 2층"
        },
        "last_checkup_count": 3
    }
}

hospitals_data = {
    "KHW001": {
        "hospital_id": "KHW001",
        "name": "김현우내과의원",
        "phone": "02-2215-9964",
        "address": "서울특별시 동대문구 전농로 124 2층",
        "supported_checkup_types": ["basic", "comprehensive", "diabetes", "heart"],
        "is_active": True
    }
}

@app.get("/")
async def root():
    return {
        "message": "김현우내과 건강검진 API 서버",
        "docs": "/docs",
        "health": "/health",
        "api_version": "v1"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "김현우내과 건강검진 API",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/v1/patients/login")
async def login_patient(request: dict):
    phone = request.get("phone")
    for patient in patients_data.values():
        if patient["phone"] == phone:
            return patient
    return {"error": "환자를 찾을 수 없습니다"}

@app.get("/api/v1/patients/{patient_uuid}")
async def get_patient(patient_uuid: str):
    if patient_uuid in patients_data:
        return patients_data[patient_uuid]
    return {"error": "환자를 찾을 수 없습니다"}

@app.get("/api/v1/hospitals/")
async def get_hospitals():
    return list(hospitals_data.values())

@app.get("/api/v1/hospitals/{hospital_id}")
async def get_hospital(hospital_id: str):
    if hospital_id in hospitals_data:
        return hospitals_data[hospital_id]
    return {"error": "병원을 찾을 수 없습니다"}

@app.post("/api/v1/checkup-design/design")
async def create_checkup_design(request: dict):
    patient_uuid = request.get("patient_uuid")
    return {
        "design_id": f"design_{patient_uuid}",
        "patient_uuid": patient_uuid,
        "recommended_items": [
            {
                "checkup_type": "basic",
                "item_name": "기본 혈액검사",
                "description": "혈압, 혈당, 콜레스테롤 등 기본 검사",
                "cost": 80000
            },
            {
                "checkup_type": "comprehensive",
                "item_name": "종합건강검진",
                "description": "연례 종합 건강 상태 점검",
                "cost": 300000
            }
        ],
        "gpt_analysis": "연령과 성별을 고려한 맞춤형 검진을 설계했습니다.",
        "recommendation_reason": "예방적 차원에서 정기적인 검진을 권장드립니다.",
        "priority": 2,
        "estimated_cost": 380000,
        "created_at": datetime.now().isoformat()
    }

if __name__ == "__main__":
    print("🚀 김현우내과 건강검진 API 서버 시작...")
    uvicorn.run(app, host="0.0.0.0", port=8080)
