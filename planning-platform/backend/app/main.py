"""
FastAPI 애플리케이션 메인
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.openapi.utils import get_openapi
import os

from .api.v1.endpoints import patients, hospitals, health, checkup_design, auth, tilko_auth, websocket_auth, wello_data, file_management, health_analysis, password
from .core.config import settings
from .data.redis_session_manager import redis_session_manager as session_manager

app = FastAPI(
    title="건강검진 관리 시스템",
    description="건강검진 예약 및 관리 API",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 운영환경에서는 실제 도메인으로 변경
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 서빙 (React 빌드 파일)
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.exists(static_dir):
    # 정적 파일을 /wello 경로에 마운트 (우선순위 높음)
    app.mount("/wello", StaticFiles(directory=static_dir, html=True), name="wello_static")
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# API 라우터 등록
app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(tilko_auth.router, prefix="/api/v1/tilko", tags=["tilko"])
app.include_router(websocket_auth.router, prefix="/api/v1/tilko", tags=["websocket"])
app.include_router(patients.router, prefix="/api/v1/patients", tags=["patients"])
app.include_router(hospitals.router, prefix="/api/v1/hospitals", tags=["hospitals"])
app.include_router(checkup_design.router, prefix="/api/v1/checkup-design", tags=["checkup-design"])
app.include_router(wello_data.router, prefix="/api/v1/wello", tags=["wello"])
app.include_router(file_management.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(password.router, prefix="/api/v1", tags=["password"])
app.include_router(health_analysis.router, prefix="/api/v1/health-analysis", tags=["health-analysis"])

@app.on_event("startup")
async def startup_event():
    """앱 시작 시 이벤트"""
    print("🚀 [시스템] 서버 시작 중...")
    
    # 세션 자동 정리 시작 (30분 간격)
    await session_manager.start_auto_cleanup(30)
    
    # 즉시 한번 정리
    cleaned = session_manager.cleanup_expired_sessions()
    if cleaned > 0:
        print(f"🧹 [초기정리] {cleaned}개 만료된 세션 정리 완료")
    
    # 파일 → DB 처리 스케줄러 시작
    try:
        from .tasks.file_to_db_processor import start_file_processor
        start_file_processor()
        print("✅ [파일처리] 파일 → DB 처리 스케줄러 시작 완료")
    except Exception as e:
        print(f"⚠️ [파일처리] 스케줄러 시작 실패: {e}")
    
    print("✅ [시스템] 서버 시작 완료")

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="건강검진 관리 시스템",
        version="1.0.0",
        description="건강검진 예약 및 관리 API",
        routes=app.routes,
    )
    # OpenAPI 3.1.0을 3.0.2로 변경
    openapi_schema["openapi"] = "3.0.2"
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "건강검진 관리 시스템 API",
        "version": "1.0.0",
        "status": "running"
    }