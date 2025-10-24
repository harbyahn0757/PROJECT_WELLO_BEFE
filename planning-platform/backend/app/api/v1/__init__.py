"""
API v1 패키지
"""

from fastapi import APIRouter
from .endpoints import patients, hospitals, checkup_design, health, auth, surveys, kakao_auth, checkup_records, tilko_auth, websocket_auth, health_analysis

api_router = APIRouter()

# 엔드포인트 라우터들 등록

api_router.include_router(
    kakao_auth.router,
    prefix="/auth/kakao",
    tags=["kakao-auth"]
)

api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["auth"]
)

api_router.include_router(
    patients.router,
    prefix="/patients",
    tags=["patients"]
)

api_router.include_router(
    hospitals.router,
    prefix="/hospitals", 
    tags=["hospitals"]
)

api_router.include_router(
    checkup_design.router,
    prefix="/checkup-design",
    tags=["checkup-design"]
)

api_router.include_router(
    health.router,
    prefix="/health",
    tags=["health"]
)

api_router.include_router(
    surveys.router,
    prefix="",
    tags=["surveys"]
)


api_router.include_router(
    checkup_records.router,
    prefix="",
    tags=["checkup-records"]
)

# health_connect.router 제거됨 - 더미 서비스 사용

api_router.include_router(
    tilko_auth.router,
    prefix="/tilko",
    tags=["tilko-auth"]
)

# WebSocket 라우터 별도 등록
api_router.include_router(
    websocket_auth.router,
    prefix="/tilko",
    tags=["websocket"]
)

# 건강 분석 라우터 등록
api_router.include_router(
    health_analysis.router,
    prefix="/health-analysis",
    tags=["health-analysis"]
)