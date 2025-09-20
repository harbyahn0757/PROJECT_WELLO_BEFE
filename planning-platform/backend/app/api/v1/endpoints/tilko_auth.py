"""
틸코 인증 관련 API 엔드포인트
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from app.utils.tilko_utils import (
    get_public_key,
    simple_auth,
    get_health_screening_data,
    get_prescription_data
)
from pydantic import BaseModel

router = APIRouter()

class SimpleAuthRequest(BaseModel):
    private_auth_type: str
    user_name: str
    birthdate: str
    phone_no: str

class HealthDataRequest(BaseModel):
    cx_id: str
    private_auth_type: str
    req_tx_id: str
    token: str
    tx_id: str
    user_name: str
    birthday: str
    phone_no: str

@router.get("/public-key")
async def get_tilko_public_key() -> Dict[str, Any]:
    """
    틸코 공개키 조회
    """
    try:
        public_key = await get_public_key()
        return {
            "success": True,
            "data": {
                "publicKey": public_key
            },
            "message": "틸코 공개키를 조회했습니다."
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"틸코 공개키 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/simple-auth")
async def request_simple_auth(request: SimpleAuthRequest) -> Dict[str, Any]:
    """
    카카오 간편인증 요청
    """
    try:
        result = await simple_auth(
            request.private_auth_type,
            request.user_name,
            request.birthdate,
            request.phone_no
        )
        return {
            "success": True,
            "data": result,
            "message": "카카오 간편인증을 요청했습니다."
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"카카오 간편인증 요청 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/health-screening")
async def get_health_screening(request: HealthDataRequest) -> Dict[str, Any]:
    """
    건강검진 데이터 조회
    """
    try:
        result = await get_health_screening_data({
            "cxId": request.cx_id,
            "privateAuthType": request.private_auth_type,
            "reqTxId": request.req_tx_id,
            "token": request.token,
            "txId": request.tx_id,
            "userName": request.user_name,
            "birthday": request.birthday,
            "phoneNo": request.phone_no
        })
        return {
            "success": True,
            "data": result,
            "message": "건강검진 데이터를 조회했습니다."
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"건강검진 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/prescription")
async def get_prescription(request: HealthDataRequest) -> Dict[str, Any]:
    """
    처방전 데이터 조회
    """
    try:
        result = await get_prescription_data({
            "cxId": request.cx_id,
            "privateAuthType": request.private_auth_type,
            "reqTxId": request.req_tx_id,
            "token": request.token,
            "txId": request.tx_id,
            "userName": request.user_name,
            "birthday": request.birthday,
            "phoneNo": request.phone_no
        })
        return {
            "success": True,
            "data": result,
            "message": "처방전 데이터를 조회했습니다."
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"처방전 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )
