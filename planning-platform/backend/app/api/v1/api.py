"""
API v1 라우터 - 모든 엔드포인트를 등록하는 메인 라우터
"""

from fastapi import APIRouter

from app.api.v1.endpoints import health, planning, analysis, users

# API v1 라우터 생성
api_router = APIRouter()

# 각 엔드포인트 라우터 등록
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(planning.router, prefix="/planning", tags=["planning"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
