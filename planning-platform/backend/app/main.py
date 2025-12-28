"""
FastAPI 애플리케이션 메인
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.openapi.utils import get_openapi
import os

from .api.v1.endpoints import (
    patients,
    hospitals,
    health,
    checkup_design,
    auth,
    tilko_auth,
    websocket_auth,
    welno_data,
    file_management,
    health_analysis,
    password,
    sync,
    surveys,
    debug,
    rag_test,
)
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
# StaticFiles 마운트 제거 - catch-all 라우트에서 처리하도록 변경
# app.mount("/welno", StaticFiles(directory=static_dir, html=True), name="welno_static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# API 라우터 등록 (기본 경로)
app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(tilko_auth.router, prefix="/api/v1/tilko", tags=["tilko"])
app.include_router(websocket_auth.router, prefix="/api/v1/tilko", tags=["websocket"])
app.include_router(patients.router, prefix="/api/v1/patients", tags=["patients"])
app.include_router(hospitals.router, prefix="/api/v1/hospitals", tags=["hospitals"])
app.include_router(checkup_design.router, prefix="/api/v1/checkup-design", tags=["checkup-design"])
app.include_router(welno_data.router, prefix="/api/v1/welno", tags=["welno"])
app.include_router(file_management.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(password.router, prefix="/api/v1", tags=["password"])
app.include_router(health_analysis.router, prefix="/api/v1/health-analysis", tags=["health-analysis"])
app.include_router(sync.router, prefix="/api/v1", tags=["sync"])
app.include_router(surveys.router, prefix="/api/v1", tags=["surveys"])
app.include_router(debug.router, prefix="/api/v1/debug", tags=["debug"])
app.include_router(rag_test.router, prefix="/api/v1", tags=["rag-test"])

# 배포환경을 위한 welno-api 경로 추가 (프록시 없이 직접 접근)
app.include_router(health.router, prefix="/welno-api/v1/health", tags=["health-welno"])
app.include_router(auth.router, prefix="/welno-api/v1/auth", tags=["auth-welno"])
app.include_router(tilko_auth.router, prefix="/welno-api/v1/tilko", tags=["tilko-welno"])
app.include_router(websocket_auth.router, prefix="/welno-api/v1/tilko", tags=["websocket-welno"])
app.include_router(patients.router, prefix="/welno-api/v1/patients", tags=["patients-welno"])
app.include_router(hospitals.router, prefix="/welno-api/v1/hospitals", tags=["hospitals-welno"])
app.include_router(checkup_design.router, prefix="/welno-api/v1/checkup-design", tags=["checkup-design-welno"])
app.include_router(welno_data.router, prefix="/welno-api/v1/welno", tags=["welno-welno"])
app.include_router(file_management.router, prefix="/welno-api/v1/admin", tags=["admin-welno"])
app.include_router(password.router, prefix="/welno-api/v1", tags=["password-welno"])
app.include_router(health_analysis.router, prefix="/welno-api/v1/health-analysis", tags=["health-analysis-welno"])
app.include_router(sync.router, prefix="/welno-api/v1", tags=["sync-welno"])
app.include_router(surveys.router, prefix="/welno-api/v1", tags=["surveys-welno"])
app.include_router(debug.router, prefix="/welno-api/v1/debug", tags=["debug-welno"])
app.include_router(rag_test.router, prefix="/welno-api/v1", tags=["rag-test-welno"])

# React Router를 위한 catch-all 라우트 (모든 API 라우터 등록 후에 추가)
# GET과 HEAD 메서드 모두 지원
@app.api_route("/welno", methods=["GET", "HEAD"])
@app.api_route("/welno/", methods=["GET", "HEAD"])
@app.api_route("/welno/{full_path:path}", methods=["GET", "HEAD"])
async def serve_react_app(request: Request, full_path: str = ""):
    """React Router의 클라이언트 사이드 라우팅을 위한 catch-all 라우트 (쿼리 파라미터는 자동 보존됨)"""
    # 쿼리 파라미터 확인 (디버깅용)
    if request.query_params:
        print(f"🔍 [FastAPI] 쿼리 파라미터 수신: {dict(request.query_params)}")
    
    # /welno (슬래시 없음)로 접속한 경우 쿼리 파라미터를 보존하여 /welno/로 리다이렉트
    # React Router의 basename="/welno"와 일치하도록 슬래시 추가
    if not full_path and request.url.path == "/welno":
        from fastapi.responses import RedirectResponse
        query_string = str(request.url.query)
        # 쿼리 파라미터를 포함하여 /welno/로 리다이렉트
        redirect_url = f"/welno/?{query_string}" if query_string else "/welno/"
        print(f"🔄 [FastAPI] /welno → /welno/ 리다이렉트 (쿼리 보존): {redirect_url}")
        # 307 Temporary Redirect 사용 (브라우저가 쿼리 파라미터를 보존함)
        return RedirectResponse(url=redirect_url, status_code=307)
    static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
    index_file = os.path.join(static_dir, "index.html")
    
    # API 경로는 제외 (이미 위에서 처리됨)
    if full_path.startswith("api/") or full_path.startswith("welno-api/"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    # 정적 파일이 실제로 존재하는지 확인 (CSS, JS, 이미지 등)
    if full_path:
        # 먼저 static 폴더에서 확인
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            # 실제 파일이 존재하면 해당 파일 반환
            return FileResponse(file_path)
        
        # 개발 환경: static 폴더에 없으면 public 폴더에서 확인
        public_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public")
        public_file_path = os.path.join(public_dir, full_path)
        if os.path.isfile(public_file_path):
            # public 폴더에 파일이 있으면 반환
            return FileResponse(public_file_path)
    
    # 그 외의 모든 경우에는 React 앱의 index.html 반환
    # 쿼리 파라미터는 FastAPI가 자동으로 보존하므로 React Router에서 처리 가능
    if os.path.exists(index_file):
        return FileResponse(index_file)
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="React app not found")

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