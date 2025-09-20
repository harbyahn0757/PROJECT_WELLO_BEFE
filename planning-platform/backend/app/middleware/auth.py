"""
인증 미들웨어

요청의 인증 상태를 확인하고 처리합니다.
"""

from typing import Optional
from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from ..core.security import verify_token

security = HTTPBearer()

async def verify_token_middleware(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = None
):
    """토큰 검증 미들웨어"""
    
    # 공개 엔드포인트 확인
    if request.url.path in [
        "/",
        "/health",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/v1/auth/login",
        "/api/v1/auth/verify"
    ]:
        return
    
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="인증이 필요합니다"
        )
    
    try:
        # 토큰 검증
        token = credentials.credentials
        payload = verify_token(token)
        
        # 요청 상태에 사용자 정보 저장
        request.state.user = payload
        
    except HTTPException as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=e.detail
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"인증 처리 중 오류: {str(e)}"
        )

