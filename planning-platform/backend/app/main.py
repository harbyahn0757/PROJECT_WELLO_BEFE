"""
FastAPI 애플리케이션 메인
"""

import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
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
    embedding_management,
    partner_management,
    health_analysis,
    password,
    sync,
    surveys,
    debug,
    rag_test,
    welno_rag_chat,
    partner_rag_chat,
    campaign_payment,
    disease_report_unified,
    welno_unified_status,
    terms_agreement,
    slack_bot,
    hospital_survey,
    partner_office,
    agent_survey,
    consultation,
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

# 글로벌 예외 핸들러 — 잡히지 않은 500 에러를 구조화된 JSON으로 반환
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "[UNHANDLED] %s %s — %s: %s",
        request.method, request.url.path, type(exc).__name__, str(exc),
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "서버 내부 오류가 발생했습니다.", "error_type": type(exc).__name__},
    )

# CORS 설정
# 파트너 위젯 임베드를 위해 모든 Origin 허용 (Credentials 지원을 위해 Regex 사용)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",  # 모든 http/https 도메인 허용
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*", "X-API-Key", "Authorization"],
)

# 정적 파일 서빙 (React 빌드 파일)
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
# StaticFiles 마운트 제거 - catch-all 라우트에서 처리하도록 변경
# app.mount("/welno", StaticFiles(directory=static_dir, html=True), name="welno_static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# iframe/백오피스 요청 → 응답 소요 시간 측정 (느리다는 피드백 대응)
@app.middleware("http")
async def log_iframe_response_time(request: Request, call_next):
    path = request.url.path
    is_iframe_path = (
        path.startswith("/backoffice")
        or path in ("/survey", "/embedding")
    )
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    if is_iframe_path:
        response.headers["X-Response-Time-Ms"] = f"{elapsed_ms:.2f}"
        logger.info(
            "[iframe-timing] path=%s method=%s status=%s elapsed_ms=%.2f",
            path, request.method, response.status_code, elapsed_ms
        )
    return response

# 위젯 JS 캐시 방지: 브라우저가 항상 최신 버전을 사용하도록 강제
@app.middleware("http")
async def add_cache_control_for_widget(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.endswith(".min.js") and "/static/" in request.url.path:
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
    # 백오피스 HTML도 캐시 방지 (JS 번들 해시가 바뀔 때 즉시 반영)
    if request.url.path.startswith("/backoffice") and not request.url.path.startswith("/backoffice/static/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response

# API 라우터 등록 (기본 경로)
app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(tilko_auth.router, prefix="/api/v1/tilko", tags=["tilko"])
app.include_router(websocket_auth.router, prefix="/api/v1/tilko", tags=["websocket"])
app.include_router(patients.router, prefix="/api/v1/patients", tags=["patients"])
app.include_router(hospitals.router, prefix="/api/v1/hospitals", tags=["hospitals"])
app.include_router(checkup_design.router, prefix="/api/v1/checkup-design", tags=["checkup-design"])
app.include_router(welno_data.router, prefix="/api/v1/welno", tags=["welno"])
app.include_router(welno_unified_status.router, prefix="/api/v1/welno", tags=["welno-unified-status"])
app.include_router(file_management.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(embedding_management.router, prefix="/api/v1/admin", tags=["admin-embedding"])
app.include_router(password.router, prefix="/api/v1", tags=["password"])
app.include_router(health_analysis.router, prefix="/api/v1/health-analysis", tags=["health-analysis"])
app.include_router(sync.router, prefix="/api/v1", tags=["sync"])
app.include_router(surveys.router, prefix="/api/v1", tags=["surveys"])
app.include_router(debug.router, prefix="/api/v1/debug", tags=["debug"])
app.include_router(rag_test.router, prefix="/api/v1", tags=["rag-test"])
app.include_router(welno_rag_chat.router, prefix="/api/v1/welno-rag-chat", tags=["welno-rag-chat"])
app.include_router(partner_rag_chat.router, prefix="/api/v1/rag-chat", tags=["partner-rag-chat"])
app.include_router(partner_management.router, prefix="/api/v1", tags=["partner-management"])
app.include_router(campaign_payment.router, prefix="/api/v1/campaigns", tags=["campaigns"])
app.include_router(disease_report_unified.router, prefix="/api/v1", tags=["disease-report"])
app.include_router(terms_agreement.router, prefix="/api/v1/terms", tags=["terms-agreement"])
app.include_router(slack_bot.router, prefix="/api/v1/slack", tags=["slack-bot"])
app.include_router(hospital_survey.router, prefix="/api/v1", tags=["hospital-survey"])
app.include_router(partner_office.router, prefix="/api/v1", tags=["partner-office"])
app.include_router(agent_survey.router, prefix="/api/v1", tags=["agent-survey"])
app.include_router(consultation.router, prefix="/api/v1", tags=["consultation"])

# 배포환경을 위한 welno-api 경로 추가 (프록시 없이 직접 접근)
app.include_router(health.router, prefix="/welno-api/v1/health", tags=["health-welno"])
app.include_router(auth.router, prefix="/welno-api/v1/auth", tags=["auth-welno"])
app.include_router(tilko_auth.router, prefix="/welno-api/v1/tilko", tags=["tilko-welno"])
app.include_router(websocket_auth.router, prefix="/welno-api/v1/tilko", tags=["websocket-welno"])
app.include_router(patients.router, prefix="/welno-api/v1/patients", tags=["patients-welno"])
app.include_router(hospitals.router, prefix="/welno-api/v1/hospitals", tags=["hospitals-welno"])
app.include_router(checkup_design.router, prefix="/welno-api/v1/checkup-design", tags=["checkup-design-welno"])
app.include_router(welno_data.router, prefix="/welno-api/v1/welno", tags=["welno-welno"])
app.include_router(welno_unified_status.router, prefix="/welno-api/v1/welno", tags=["welno-unified-status-welno"])
app.include_router(file_management.router, prefix="/welno-api/v1/admin", tags=["admin-welno"])
app.include_router(embedding_management.router, prefix="/welno-api/v1/admin", tags=["admin-embedding-welno"])
app.include_router(password.router, prefix="/welno-api/v1", tags=["password-welno"])
app.include_router(health_analysis.router, prefix="/welno-api/v1/health-analysis", tags=["health-analysis-welno"])
app.include_router(sync.router, prefix="/welno-api/v1", tags=["sync-welno"])
app.include_router(surveys.router, prefix="/welno-api/v1", tags=["surveys-welno"])
app.include_router(welno_rag_chat.router, prefix="/welno-api/v1/welno-rag-chat", tags=["welno-rag-chat-welno"])
app.include_router(partner_rag_chat.router, prefix="/welno-api/v1/rag-chat", tags=["partner-rag-chat-welno"])
app.include_router(debug.router, prefix="/welno-api/v1/debug", tags=["debug-welno"])
app.include_router(rag_test.router, prefix="/welno-api/v1/rag-test", tags=["rag-test-welno"])
app.include_router(campaign_payment.router, prefix="/welno-api/v1/campaigns", tags=["campaigns-welno"])
app.include_router(disease_report_unified.router, prefix="/welno-api/v1", tags=["disease-report-welno"])
app.include_router(terms_agreement.router, prefix="/welno-api/v1/terms", tags=["terms-agreement-welno"])
app.include_router(slack_bot.router, prefix="/welno-api/v1/slack", tags=["slack-bot-welno"])
app.include_router(hospital_survey.router, prefix="/welno-api/v1", tags=["hospital-survey-welno"])
app.include_router(partner_office.router, prefix="/welno-api/v1", tags=["partner-office-welno"])
app.include_router(agent_survey.router, prefix="/welno-api/v1", tags=["agent-survey-welno"])
app.include_router(consultation.router, prefix="/welno-api/v1", tags=["consultation-welno"])

# 백오피스 SPA (독립 앱) 서빙
backoffice_dir = os.path.join(static_dir, "backoffice")
backoffice_index = os.path.join(backoffice_dir, "index.html")

@app.api_route("/backoffice", methods=["GET", "HEAD"])
@app.api_route("/backoffice/", methods=["GET", "HEAD"])
@app.api_route("/backoffice/{full_path:path}", methods=["GET", "HEAD"])
async def serve_backoffice(full_path: str = ""):
    """백오피스 독립 앱 서빙 (React SPA)"""
    if full_path:
        file_path = os.path.join(backoffice_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
    if os.path.isfile(backoffice_index):
        return FileResponse(backoffice_index)
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Backoffice app not found")

# iframe 임베드 데모 모드 — /survey, /embedding 직접 접근 시 백오피스 SPA 서빙
@app.api_route("/survey", methods=["GET", "HEAD"])
@app.api_route("/embedding", methods=["GET", "HEAD"])
async def serve_backoffice_embed():
    """iframe 임베드용 — 로그인 없이 백오피스 SPA 서빙 (데모 모드)"""
    if os.path.isfile(backoffice_index):
        return FileResponse(backoffice_index)
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Backoffice app not found")

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
    
    # RAG 엔진 사전 초기화 (벡터 DB를 메모리에 미리 로드)
    try:
        import time
        from .services.checkup_design.rag_service import init_rag_engine
        print("📚 [RAG 엔진] 벡터 DB 사전 로드 시작...")
        start_rag = time.time()
        await init_rag_engine(use_local_vector_db=True)
        elapsed = time.time() - start_rag
        print(f"✅ [RAG 엔진] 벡터 DB 메모리 로드 완료 ({elapsed:.2f}초)")
    except Exception as e:
        print(f"⚠️ [RAG 엔진] 사전 로드 실패: {e}")
    
    # 서버 모니터링 + Slack 알림 시작
    try:
        if settings.slack_enabled and settings.slack_webhook_url:
            from .services.slack_service import get_slack_service
            from .services.monitoring_service import get_monitoring_service
            slack_svc = get_slack_service(settings.slack_webhook_url, settings.slack_channel_id)
            monitor = get_monitoring_service(slack_svc)
            await monitor.start(interval_seconds=300)  # 5분 간격
            print("✅ [모니터링] Slack 연동 모니터링 시작 (5분 간격)")
        else:
            print("ℹ️ [모니터링] Slack 미설정, 모니터링 알림 비활성")
    except Exception as e:
        print(f"⚠️ [모니터링] 시작 실패: {e}")

    # 미태깅 세션 자동 복구 스케줄러 (1시간 간격, 서버 안정화 후 시작)
    try:
        import asyncio

        async def _tagging_recovery_loop():
            """미태깅 세션을 주기적으로 찾아 태깅합니다."""
            await asyncio.sleep(300)  # 서버 시작 후 5분 대기 (warmup 완료 보장)
            while True:
                try:
                    from .services.chat_tagging_service import retag_all_sessions
                    result = await retag_all_sessions(force=False)
                    if result["total"] > 0:
                        print(f"🏷 [태깅복구] 미태깅 세션 처리: {result}")
                except Exception as e:
                    print(f"⚠️ [태깅복구] 실행 실패: {e}")
                await asyncio.sleep(3600)  # 1시간 대기 (Gemini quota 보호)

        asyncio.create_task(_tagging_recovery_loop())
        print("✅ [태깅복구] 미태깅 세션 자동 복구 스케줄러 시작 (1시간 간격, 5분 후 첫 실행)")
    except Exception as e:
        print(f"⚠️ [태깅복구] 스케줄러 시작 실패: {e}")

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
