"""
인증 관련 API 엔드포인트
"""

from typing import Optional
from datetime import timedelta
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from ....core.security import (
    create_access_token,
    verify_token,
    get_current_user,
    AuthError
)
from ....core.config import settings
from ....services.patient_service import PatientService
from ....repositories.implementations import PatientRepository, HospitalRepository

router = APIRouter()
security = HTTPBearer()

class TokenResponse(BaseModel):
    """토큰 응답 모델"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    patient_uuid: str
    hospital_id: str

class LoginRequest(BaseModel):
    """로그인 요청 모델"""
    phone: str = Field(..., description="전화번호", example="010-1234-5678")
    device_id: Optional[str] = Field(None, description="기기 식별자")

# 의존성 주입 (추후 DI 컨테이너로 대체)
def get_patient_service() -> PatientService:
    patient_repo = PatientRepository()
    hospital_repo = HospitalRepository()
    return PatientService(patient_repo, hospital_repo)

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """전화번호 기반 로그인"""
    try:
        service = get_patient_service()
        patient = await service.get_patient_by_phone(request.phone)
        
        if not patient:
            raise HTTPException(
                status_code=404,
                detail="등록된 환자를 찾을 수 없습니다"
            )
        
        # 토큰 데이터 준비
        token_data = {
            "sub": str(patient.uuid),
            "phone": patient.phone,
            "hospital_id": patient.hospital_id
        }
        
        if request.device_id:
            token_data["device_id"] = request.device_id
        
        # 액세스 토큰 생성
        access_token = create_access_token(
            data=token_data,
            expires_delta=timedelta(minutes=settings.security.access_token_expire_minutes)
        )
        
        return TokenResponse(
            access_token=access_token,
            expires_in=settings.security.access_token_expire_minutes * 60,
            patient_uuid=str(patient.uuid),
            hospital_id=patient.hospital_id
        )
        
    except AuthError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"로그인 처리 중 오류: {str(e)}"
        )

@router.get("/me")
async def get_current_user_info(
    current_user: dict = Depends(get_current_user)
):
    """현재 인증된 사용자 정보 조회"""
    try:
        service = get_patient_service()
        patient = await service.get_patient_by_uuid(current_user["sub"])
        
        if not patient:
            raise HTTPException(
                status_code=404,
                detail="환자 정보를 찾을 수 없습니다"
            )
        
        return {
            "uuid": str(patient.uuid),
            "phone": patient.phone,
            "hospital_id": patient.hospital_id,
            "name": patient.name,
            "token_exp": current_user.get("exp")
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"사용자 정보 조회 중 오류: {str(e)}"
        )

@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """로그아웃 (토큰 무효화)"""
    # 실제 구현에서는 Redis 등을 사용하여 블랙리스트 관리
    return {
        "message": "로그아웃 되었습니다"
    }