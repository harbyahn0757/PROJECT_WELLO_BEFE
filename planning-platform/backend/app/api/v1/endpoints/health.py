"""
헬스체크 및 시스템 상태 API 엔드포인트
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
import os
from pathlib import Path

from ....core.config import settings


router = APIRouter()


class HealthResponse(BaseModel):
    """헬스체크 응답 모델"""
    status: str
    timestamp: str
    version: str
    environment: str
    database: dict
    services: dict


class SystemInfoResponse(BaseModel):
    """시스템 정보 응답 모델"""
    python_version: str
    fastapi_version: str
    environment: str
    debug_mode: bool
    data_directory: str
    config: dict


@router.get("/status", response_model=HealthResponse)
async def health_status():
    """시스템 헬스체크"""
    try:
        # 데이터 디렉터리 확인
        data_dir = Path(__file__).parent.parent.parent.parent / "data"
        data_files = list(data_dir.glob("*.json")) if data_dir.exists() else []
        
        # 서비스 상태 확인
        services_status = {
            "patient_service": "healthy",
            "hospital_service": "healthy", 
            "checkup_design_service": "healthy",
            "gpt_integration": "configured" if settings.openai.api_key else "not_configured"
        }
        
        return HealthResponse(
            status="healthy",
            timestamp=datetime.now().isoformat(),
            version="1.0.0",
            environment=settings.environment,
            database={
                "type": "json_files",
                "location": str(data_dir),
                "files_count": len(data_files),
                "files": [f.name for f in data_files]
            },
            services=services_status
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"헬스체크 실패: {str(e)}")


@router.get("/info", response_model=SystemInfoResponse)
async def system_info():
    """시스템 정보 조회"""
    try:
        import sys
        import fastapi
        
        # 설정 정보 (민감한 정보 제외)
        safe_config = {
            "debug": settings.debug,
            "environment": settings.environment,
            "api_version": settings.api_version,
            "host": settings.host,
            "port": settings.port,
            "cors_origins": settings.cors.allowed_origins,
            "hospital_name": settings.hospital.name,
            "hospital_phone": settings.hospital.phone
        }
        
        data_dir = Path(__file__).parent.parent.parent.parent / "data"
        
        return SystemInfoResponse(
            python_version=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            fastapi_version=fastapi.__version__,
            environment=settings.environment,
            debug_mode=settings.debug,
            data_directory=str(data_dir),
            config=safe_config
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"시스템 정보 조회 실패: {str(e)}")


@router.get("/data-status")
async def data_status():
    """데이터 상태 확인"""
    try:
        from ....repositories.implementations import PatientRepository, HospitalRepository
        
        # Repository 인스턴스 생성
        patient_repo = PatientRepository()
        hospital_repo = HospitalRepository()
        
        # 데이터 로드 시도
        patients_data = await patient_repo._load_data()
        hospitals_data = await hospital_repo._load_data()
        
        return {
            "patients": {
                "count": len(patients_data),
                "file_exists": patient_repo.data_file.exists(),
                "file_size": patient_repo.data_file.stat().st_size if patient_repo.data_file.exists() else 0
            },
            "hospitals": {
                "count": len(hospitals_data),
                "file_exists": hospital_repo.data_file.exists(),
                "file_size": hospital_repo.data_file.stat().st_size if hospital_repo.data_file.exists() else 0
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 상태 확인 실패: {str(e)}")


@router.get("/monitoring")
async def server_monitoring():
    """서버 모니터링 전체 상태 (PM2, 시스템 리소스, API 헬스)"""
    try:
        from ....services.monitoring_service import get_monitoring_service
        from ....services.slack_service import get_slack_service
        from ....core.config import settings as app_settings

        slack_svc = None
        if app_settings.slack_enabled and app_settings.slack_webhook_url:
            slack_svc = get_slack_service(app_settings.slack_webhook_url, app_settings.slack_channel_id)

        monitor = get_monitoring_service(slack_svc)
        return await monitor.get_full_status()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"모니터링 조회 실패: {str(e)}")


@router.post("/monitoring/test-alert")
async def test_slack_alert():
    """Slack 알림 테스트 전송"""
    try:
        from ....core.config import settings as app_settings

        if not app_settings.slack_enabled or not app_settings.slack_webhook_url:
            return {"success": False, "message": "Slack이 설정되지 않았습니다. .env에 SLACK_WEBHOOK_URL과 SLACK_ENABLED=true를 설정하세요."}

        from ....services.slack_service import get_slack_service
        slack_svc = get_slack_service(app_settings.slack_webhook_url, app_settings.slack_channel_id)
        result = await slack_svc.send_test_message()
        return {"success": result, "message": "테스트 메시지 전송 완료" if result else "전송 실패"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"테스트 알림 실패: {str(e)}")


# 더미 데이터 초기화 기능 제거됨 - 실제 데이터베이스 사용

