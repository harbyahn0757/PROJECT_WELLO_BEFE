"""
API v1 패키지
"""

from fastapi import APIRouter
from .endpoints import patients, hospitals, checkup_design, health, auth, surveys, kakao_auth, checkup_records

api_router = APIRouter()

# 엔드포인트 라우터들 등록
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
    kakao_auth.router,
    prefix="/auth",
    tags=["kakao-auth"]
)

api_router.include_router(
    checkup_records.router,
    prefix="",
    tags=["checkup-records"]
)