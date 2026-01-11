"""
비밀번호 관리 API 엔드포인트
8자리 숫자 비밀번호 시스템
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Path, Header
from pydantic import BaseModel, Field
from typing import Optional
import re

from app.services.password_service import PasswordService
from app.services.password_session_service import PasswordSessionService

router = APIRouter(tags=["password"])

# 의존성 주입
def get_password_service() -> PasswordService:
    return PasswordService()

def get_session_service() -> PasswordSessionService:
    return PasswordSessionService()

# 요청 모델
class PasswordSetRequest(BaseModel):
    password: str = Field(..., description="6자리 숫자 비밀번호", min_length=6, max_length=6)
    name: Optional[str] = Field(None, description="환자 이름")
    phone_number: Optional[str] = Field(None, description="전화번호")
    birth_date: Optional[str] = Field(None, description="생년월일 (YYYY-MM-DD)")
    gender: Optional[str] = Field(None, description="성별 (M/F)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "password": "******"
            }
        }

class PasswordVerifyRequest(BaseModel):
    password: str = Field(..., description="6자리 숫자 비밀번호", min_length=6, max_length=6)
    
    class Config:
        json_schema_extra = {
            "example": {
                "password": "******"
            }
        }

class PasswordChangeRequest(BaseModel):
    currentPassword: str = Field(..., description="현재 비밀번호", min_length=6, max_length=6)
    newPassword: str = Field(..., description="새 비밀번호", min_length=6, max_length=6)
    
    class Config:
        json_schema_extra = {
            "example": {
                "currentPassword": "******",
                "newPassword": "******"
            }
        }

# 세션 관련 요청 모델
class SessionCreateRequest(BaseModel):
    deviceFingerprint: str = Field(..., description="디바이스 고유 식별자", min_length=10, max_length=100)
    
    class Config:
        json_schema_extra = {
            "example": {
                "deviceFingerprint": "chrome_119_windows_1920x1080_ko"
            }
        }

class SessionVerifyRequest(BaseModel):
    sessionToken: str = Field(..., description="세션 토큰", min_length=10)
    deviceFingerprint: str = Field(..., description="디바이스 고유 식별자", min_length=10, max_length=100)
    
    class Config:
        json_schema_extra = {
            "example": {
                "sessionToken": "abc123def456...",
                "deviceFingerprint": "chrome_119_windows_1920x1080_ko"
            }
        }

# 응답 모델
class PasswordCheckResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    message: Optional[str] = None

class PasswordResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

# API 엔드포인트
@router.get("/patients/{patient_uuid}/password/check", response_model=PasswordCheckResponse)
async def check_password(
    patient_uuid: str = Path(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    password_service: PasswordService = Depends(get_password_service)
):
    """비밀번호 설정 여부 및 상태 확인"""
    try:
        print(f"🔍 [API] 비밀번호 확인 요청 - UUID: {patient_uuid}, 병원: {hospital_id}")
        
        result = await password_service.check_password_exists(patient_uuid, hospital_id)
        
        return PasswordCheckResponse(
            success=True,
            data={
                "hasPassword": result.get("has_password", False),
                "attempts": result.get("attempts", 0),
                "isLocked": result.get("is_locked", False),
                "lockoutTime": result.get("lockout_time"),
                "lastAccess": result.get("last_access")
            }
        )
        
    except Exception as e:
        print(f"❌ [API] 비밀번호 확인 실패: {e}")
        raise HTTPException(status_code=500, detail=f"비밀번호 확인 실패: {str(e)}")

@router.post("/patients/{patient_uuid}/password/set", response_model=PasswordResponse)
async def set_password(
    request: PasswordSetRequest,
    patient_uuid: str = Path(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    password_service: PasswordService = Depends(get_password_service)
):
    """비밀번호 설정"""
    try:
        print(f"🔐 [API] 비밀번호 설정 요청 - UUID: {patient_uuid}, 병원: {hospital_id}")
        
        # 6자리 숫자 검증
        if not re.match(r'^\d{6}$', request.password):
            raise HTTPException(
                status_code=400, 
                detail="비밀번호는 정확히 6자리 숫자여야 합니다."
            )
        
        success = await password_service.set_password(
            patient_uuid, 
            hospital_id, 
            request.password,
            name=request.name,
            phone_number=request.phone_number,
            birth_date=request.birth_date,
            gender=request.gender
        )
        
        if success:
            return PasswordResponse(
                success=True,
                message="비밀번호가 설정되었습니다."
            )
        else:
            raise HTTPException(
                status_code=400, 
                detail="비밀번호 설정에 실패했습니다."
            )
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [API] 비밀번호 설정 실패: {e}")
        raise HTTPException(status_code=500, detail=f"비밀번호 설정 실패: {str(e)}")

@router.delete("/patients/{patient_uuid}/password/reset", response_model=PasswordResponse)
async def reset_password(
    patient_uuid: str = Path(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    password_service: PasswordService = Depends(get_password_service)
):
    """비밀번호 리셋/삭제"""
    try:
        print(f"🗑️ [API] 비밀번호 리셋 요청 - UUID: {patient_uuid}, 병원: {hospital_id}")
        
        success = await password_service.reset_password(patient_uuid, hospital_id)
        
        if success:
            return PasswordResponse(
                success=True,
                message="비밀번호가 리셋되었습니다."
            )
        else:
            raise HTTPException(
                status_code=400, 
                detail="비밀번호 리셋에 실패했습니다."
            )
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [API] 비밀번호 리셋 실패: {e}")
        raise HTTPException(status_code=500, detail=f"비밀번호 리셋 실패: {str(e)}")

@router.post("/patients/{patient_uuid}/password/verify", response_model=PasswordResponse)
async def verify_password(
    request: PasswordVerifyRequest,
    patient_uuid: str = Path(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    password_service: PasswordService = Depends(get_password_service)
):
    """비밀번호 확인"""
    try:
        print(f"🔍 [API] 비밀번호 확인 요청 - UUID: {patient_uuid}, 병원: {hospital_id}")
        
        result = await password_service.verify_password(patient_uuid, hospital_id, request.password)
        
        return PasswordResponse(
            success=result["success"],
            message=result["message"],
            data={
                "attempts": result.get("attempts"),
                "isLocked": result.get("is_locked", False),
                "lockoutTime": result.get("lockout_time")
            }
        )
            
    except Exception as e:
        print(f"❌ [API] 비밀번호 확인 실패: {e}")
        raise HTTPException(status_code=500, detail=f"비밀번호 확인 실패: {str(e)}")

@router.put("/patients/{patient_uuid}/password/change", response_model=PasswordResponse)
async def change_password(
    request: PasswordChangeRequest,
    patient_uuid: str = Path(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    password_service: PasswordService = Depends(get_password_service)
):
    """비밀번호 변경"""
    try:
        print(f"🔄 [API] 비밀번호 변경 요청 - UUID: {patient_uuid}, 병원: {hospital_id}")
        
        # 6자리 숫자 검증
        if not re.match(r'^\d{6}$', request.newPassword):
            raise HTTPException(
                status_code=400, 
                detail="새 비밀번호는 정확히 6자리 숫자여야 합니다."
            )
        
        result = await password_service.change_password(
            patient_uuid, hospital_id, request.currentPassword, request.newPassword
        )
        
        return PasswordResponse(
            success=result["success"],
            message=result["message"],
            data={
                "attempts": result.get("attempts")
            }
        )
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [API] 비밀번호 변경 실패: {e}")
        raise HTTPException(status_code=500, detail=f"비밀번호 변경 실패: {str(e)}")

@router.get("/patients/{patient_uuid}/password/should-prompt")
async def should_prompt_password(
    patient_uuid: str = Path(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    password_service: PasswordService = Depends(get_password_service)
):
    """비밀번호 설정 권유 필요 여부 확인"""
    try:
        print(f"🔍 [API] 비밀번호 권유 확인 - UUID: {patient_uuid}, 병원: {hospital_id}")
        
        should_prompt = await password_service.should_prompt_password(patient_uuid, hospital_id)
        
        return {
            "success": True,
            "data": {
                "shouldPrompt": should_prompt
            }
        }
        
    except Exception as e:
        print(f"❌ [API] 비밀번호 권유 확인 실패: {e}")
        raise HTTPException(status_code=500, detail=f"비밀번호 권유 확인 실패: {str(e)}")

@router.post("/patients/{patient_uuid}/password/update-access")
async def update_last_access(
    patient_uuid: str = Path(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    password_service: PasswordService = Depends(get_password_service)
):
    """마지막 접근 시간 업데이트"""
    try:
        print(f"⏰ [API] 접근 시간 업데이트 - UUID: {patient_uuid}, 병원: {hospital_id}")
        
        success = await password_service.update_last_access(patient_uuid, hospital_id)
        
        return {
            "success": success,
            "message": "접근 시간이 업데이트되었습니다." if success else "접근 시간 업데이트 실패"
        }
        
    except Exception as e:
        print(f"❌ [API] 접근 시간 업데이트 실패: {e}")
        raise HTTPException(status_code=500, detail=f"접근 시간 업데이트 실패: {str(e)}")

@router.post("/patients/{patient_uuid}/password/update-prompt")
async def update_password_prompt(
    patient_uuid: str = Path(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    password_service: PasswordService = Depends(get_password_service)
):
    """비밀번호 권유 시간 업데이트"""
    try:
        print(f"⏰ [API] 권유 시간 업데이트 - UUID: {patient_uuid}, 병원: {hospital_id}")
        
        success = await password_service.update_password_prompt(patient_uuid, hospital_id)
        
        return {
            "success": success,
            "message": "권유 시간이 업데이트되었습니다." if success else "권유 시간 업데이트 실패"
        }
        
    except Exception as e:
        print(f"❌ [API] 권유 시간 업데이트 실패: {e}")
        raise HTTPException(status_code=500, detail=f"권유 시간 업데이트 실패: {str(e)}")

# ========================================
# 🔐 세션 관리 API
# ========================================

@router.post("/patients/{patient_uuid}/sessions/create")
async def create_password_session(
    request: SessionCreateRequest,
    patient_uuid: str = Path(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    session_service: PasswordSessionService = Depends(get_session_service)
):
    """비밀번호 인증 후 세션 생성"""
    try:
        print(f"🔐 [API] 세션 생성 요청 - UUID: {patient_uuid}, 디바이스: {request.deviceFingerprint[:20]}...")
        
        result = await session_service.create_session(
            patient_uuid, hospital_id, request.deviceFingerprint
        )
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result.get("error", "세션 생성 실패"))
        
        return {
            "success": True,
            "message": "세션이 생성되었습니다.",
            "data": {
                "sessionToken": result["session_token"],
                "expiresAt": result["expires_at"],
                "durationMinutes": result["duration_minutes"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [API] 세션 생성 실패: {e}")
        raise HTTPException(status_code=500, detail=f"세션 생성 실패: {str(e)}")

@router.post("/sessions/verify")
async def verify_password_session(
    request: SessionVerifyRequest,
    session_service: PasswordSessionService = Depends(get_session_service)
):
    """세션 토큰 유효성 확인"""
    try:
        print(f"🔍 [API] 세션 확인 요청 - 토큰: {request.sessionToken[:8]}..., 디바이스: {request.deviceFingerprint[:20]}...")
        
        result = await session_service.verify_session(
            request.sessionToken, request.deviceFingerprint
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=401, 
                detail=result.get("message", "유효하지 않은 세션입니다.")
            )
        
        return {
            "success": True,
            "message": "유효한 세션입니다.",
            "data": {
                "patientUuid": result["patient_uuid"],
                "hospitalId": result["hospital_id"],
                "expiresAt": result["expires_at"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [API] 세션 확인 실패: {e}")
        raise HTTPException(status_code=500, detail=f"세션 확인 실패: {str(e)}")

@router.delete("/sessions/{session_token}")
async def invalidate_password_session(
    session_token: str = Path(..., description="세션 토큰"),
    session_service: PasswordSessionService = Depends(get_session_service)
):
    """세션 무효화 (로그아웃)"""
    try:
        print(f"🚪 [API] 세션 무효화 요청 - 토큰: {session_token[:8]}...")
        
        success = await session_service.invalidate_session(session_token)
        
        return {
            "success": success,
            "message": "세션이 무효화되었습니다." if success else "세션을 찾을 수 없습니다."
        }
        
    except Exception as e:
        print(f"❌ [API] 세션 무효화 실패: {e}")
        raise HTTPException(status_code=500, detail=f"세션 무효화 실패: {str(e)}")

@router.get("/patients/{patient_uuid}/sessions")
async def get_active_sessions(
    patient_uuid: str = Path(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    session_service: PasswordSessionService = Depends(get_session_service)
):
    """활성 세션 목록 조회"""
    try:
        print(f"📋 [API] 활성 세션 조회 - UUID: {patient_uuid}, 병원: {hospital_id}")
        
        result = await session_service.get_active_sessions(patient_uuid, hospital_id)
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result.get("error", "세션 조회 실패"))
        
        return {
            "success": True,
            "message": f"{result['count']}개의 활성 세션이 있습니다.",
            "data": {
                "sessions": result["sessions"],
                "count": result["count"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [API] 세션 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"세션 조회 실패: {str(e)}")

@router.post("/sessions/cleanup")
async def cleanup_expired_sessions(
    session_service: PasswordSessionService = Depends(get_session_service)
):
    """만료된 세션 정리 (관리자용)"""
    try:
        print(f"🧹 [API] 만료 세션 정리 요청")
        
        deleted_count = await session_service.cleanup_expired_sessions()
        
        return {
            "success": True,
            "message": f"{deleted_count}개의 만료된 세션을 정리했습니다.",
            "data": {
                "deletedCount": deleted_count
            }
        }
        
    except Exception as e:
        print(f"❌ [API] 세션 정리 실패: {e}")
        raise HTTPException(status_code=500, detail=f"세션 정리 실패: {str(e)}")

@router.get("/patients/{patient_uuid}/password/stats")
async def get_password_stats(
    patient_uuid: str = Path(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    password_service: PasswordService = Depends(get_password_service)
):
    """비밀번호 관련 통계 정보 (개발/디버깅용)"""
    try:
        print(f"📊 [API] 비밀번호 통계 조회 - UUID: {patient_uuid}, 병원: {hospital_id}")
        
        stats = await password_service.get_password_stats(patient_uuid, hospital_id)
        
        return {
            "success": True,
            "data": stats
        }
        
    except Exception as e:
        print(f"❌ [API] 비밀번호 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"비밀번호 통계 조회 실패: {str(e)}")
