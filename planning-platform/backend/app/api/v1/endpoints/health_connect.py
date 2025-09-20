"""
건강 데이터 연동 API 엔드포인트
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime
import logging

from app.services.tilko_service import TilkoService, TilkoServiceError, TilkoAuthError, TilkoApiError
from app.models.health_data import (
    TilkoAuthRequest, TilkoAuthResponse,
    TilkoHealthScreeningRequest, TilkoHealthScreeningResponse,
    TilkoPrescriptionRequest, TilkoPrescriptionResponse,
    HealthConnectResponse, ErrorResponse, HealthData
)

router = APIRouter()
logger = logging.getLogger(__name__)


async def get_tilko_service() -> TilkoService:
    """Tilko 서비스 의존성"""
    return TilkoService()


@router.post("/health-connect/auth", response_model=TilkoAuthResponse)
async def authenticate_user(
    auth_request: TilkoAuthRequest,
    tilko_service: TilkoService = Depends(get_tilko_service)
):
    """
    사용자 인증
    
    - **user_name**: 사용자명
    - **phone_number**: 휴대폰 번호 (예: 01012345678)
    - **birth_date**: 생년월일 (YYYYMMDD)
    - **gender**: 성별 (M/F)
    """
    try:
        logger.info(f"사용자 인증 요청: {auth_request.user_name}")
        
        async with tilko_service:
            response = await tilko_service.authenticate(auth_request)
        
        if not response.success:
            raise HTTPException(
                status_code=401,
                detail=response.message
            )
        
        logger.info(f"사용자 인증 성공: {auth_request.user_name}")
        return response
    
    except TilkoAuthError as e:
        logger.error(f"인증 실패: {e}")
        raise HTTPException(status_code=401, detail=str(e))
    except TilkoServiceError as e:
        logger.error(f"서비스 에러: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"예상치 못한 에러: {e}")
        raise HTTPException(status_code=500, detail="서버 내부 오류가 발생했습니다")


@router.post("/health-connect/checkup", response_model=TilkoHealthScreeningResponse)
async def get_health_screening_data(
    request: TilkoHealthScreeningRequest,
    tilko_service: TilkoService = Depends(get_tilko_service)
):
    """
    건강검진 데이터 조회
    
    - **token**: 인증 토큰 (auth 엔드포인트에서 획득)
    - **start_date**: 조회 시작일 (YYYYMMDD, 선택사항)
    - **end_date**: 조회 종료일 (YYYYMMDD, 선택사항)
    """
    try:
        logger.info("건강검진 데이터 조회 요청")
        
        async with tilko_service:
            response = await tilko_service.get_health_screening_data(request)
        
        if not response.success:
            raise HTTPException(
                status_code=400,
                detail=response.message
            )
        
        logger.info(f"건강검진 데이터 조회 성공: {len(response.data or [])}건")
        return response
    
    except TilkoApiError as e:
        logger.error(f"API 에러: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except TilkoServiceError as e:
        logger.error(f"서비스 에러: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"예상치 못한 에러: {e}")
        raise HTTPException(status_code=500, detail="서버 내부 오류가 발생했습니다")


@router.post("/health-connect/prescription", response_model=TilkoPrescriptionResponse)
async def get_prescription_data(
    request: TilkoPrescriptionRequest,
    tilko_service: TilkoService = Depends(get_tilko_service)
):
    """
    처방전 데이터 조회
    
    - **token**: 인증 토큰 (auth 엔드포인트에서 획득)
    - **start_date**: 조회 시작일 (YYYYMMDD, 선택사항)
    - **end_date**: 조회 종료일 (YYYYMMDD, 선택사항)
    """
    try:
        logger.info("처방전 데이터 조회 요청")
        
        async with tilko_service:
            response = await tilko_service.get_prescription_data(request)
        
        if not response.success:
            raise HTTPException(
                status_code=400,
                detail=response.message
            )
        
        logger.info(f"처방전 데이터 조회 성공: {len(response.data or [])}건")
        return response
    
    except TilkoApiError as e:
        logger.error(f"API 에러: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except TilkoServiceError as e:
        logger.error(f"서비스 에러: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"예상치 못한 에러: {e}")
        raise HTTPException(status_code=500, detail="서버 내부 오류가 발생했습니다")


@router.get("/health-connect/data", response_model=HealthConnectResponse)
async def get_health_data(
    token: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    tilko_service: TilkoService = Depends(get_tilko_service)
):
    """
    통합 건강 데이터 조회
    
    - **token**: 인증 토큰 (auth 엔드포인트에서 획득)
    - **start_date**: 조회 시작일 (YYYYMMDD, 선택사항)
    - **end_date**: 조회 종료일 (YYYYMMDD, 선택사항)
    
    건강검진 데이터와 처방전 데이터를 통합하여 반환합니다.
    """
    try:
        logger.info("통합 건강 데이터 조회 요청")
        
        async with tilko_service:
            health_data = await tilko_service.get_health_data(token, start_date, end_date)
        
        response = HealthConnectResponse(
            success=True,
            data=health_data,
            message="데이터 조회 성공"
        )
        
        logger.info(f"통합 건강 데이터 조회 성공: 검진 {len(health_data.checkup_results)}건, 처방전 {len(health_data.prescriptions)}건")
        return response
    
    except TilkoServiceError as e:
        logger.error(f"서비스 에러: {e}")
        return HealthConnectResponse(
            success=False,
            message=str(e),
            error_code="SERVICE_ERROR"
        )
    except Exception as e:
        logger.error(f"예상치 못한 에러: {e}")
        return HealthConnectResponse(
            success=False,
            message="서버 내부 오류가 발생했습니다",
            error_code="INTERNAL_ERROR"
        )


@router.get("/health-connect/status")
async def get_service_status():
    """
    서비스 상태 확인
    
    Tilko API 연동 상태를 확인합니다.
    """
    try:
        tilko_service = TilkoService()
        
        # 기본적인 서비스 초기화 확인
        status = {
            "service": "healthy",
            "timestamp": datetime.now().isoformat(),
            "api_host": tilko_service.api_host,
            "has_api_key": bool(tilko_service.api_key),
            "has_encryption_key": bool(tilko_service.encryption_key)
        }
        
        return status
    
    except Exception as e:
        logger.error(f"서비스 상태 확인 실패: {e}")
        return {
            "service": "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }


# 에러 핸들러는 FastAPI 앱 레벨에서 처리
