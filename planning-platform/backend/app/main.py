"""
FastAPI 애플리케이션 메인
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1.endpoints import patients, hospitals, health, checkup_design, auth
from .core.config import settings

app = FastAPI(
    title="건강검진 관리 시스템",
    description="건강검진 예약 및 관리 API",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:9283"],  # 프론트엔드 서버
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(patients.router, prefix="/api/v1/patients", tags=["patients"])
app.include_router(hospitals.router, prefix="/api/v1/hospitals", tags=["hospitals"])
app.include_router(checkup_design.router, prefix="/api/v1/checkup-design", tags=["checkup-design"])

@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "건강검진 관리 시스템 API",
        "version": "1.0.0",
        "status": "running"
    }