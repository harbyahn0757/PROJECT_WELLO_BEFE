"""
검진 기록 관련 API 엔드포인트
"""
from fastapi import APIRouter, HTTPException, status
from typing import Dict, Any, List
import uuid
from datetime import datetime

from ....data.dummy_data import CHECKUP_RESULTS_DATA

router = APIRouter()

# 검진 기록 더미 데이터
CHECKUP_RECORDS_DATA = {}

@router.get("/checkup-records/{web_app_key}")
async def get_checkup_record(web_app_key: str) -> Dict[str, Any]:
    """
    webAppKey로 검진 기록 조회
    """
    if web_app_key not in CHECKUP_RECORDS_DATA:
        raise HTTPException(
            status_code=404,
            detail="검진 기록을 찾을 수 없습니다."
        )
    
    return {
        "success": True,
        "data": CHECKUP_RECORDS_DATA[web_app_key],
        "message": "검진 기록을 조회했습니다."
    }

@router.post("/checkup-records")
async def create_checkup_record(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    검진 기록 생성
    """
    try:
        web_app_key = request.get("webAppKey")
        checkup_data = request.get("checkupData", {})
        
        if not web_app_key:
            raise HTTPException(
                status_code=400,
                detail="webAppKey가 필요합니다."
            )
        
        record_id = str(uuid.uuid4())
        
        checkup_record = {
            "id": record_id,
            "webAppKey": web_app_key,
            "checkupDate": checkup_data.get("checkupDate", datetime.now().isoformat()),
            "checkupType": checkup_data.get("checkupType", "basic"),
            "results": checkup_data.get("results", {}),
            "createdAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat()
        }
        
        CHECKUP_RECORDS_DATA[web_app_key] = checkup_record
        
        return {
            "success": True,
            "data": checkup_record,
            "message": "검진 기록이 생성되었습니다."
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"검진 기록 생성 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/checkup-records")
async def get_all_checkup_records() -> Dict[str, Any]:
    """
    모든 검진 기록 조회
    """
    return {
        "success": True,
        "data": list(CHECKUP_RECORDS_DATA.values()),
        "message": "모든 검진 기록을 조회했습니다."
    }
