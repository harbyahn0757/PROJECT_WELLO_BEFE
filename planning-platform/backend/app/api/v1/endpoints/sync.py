"""
mdx_agr_list ↔ wello 동기화 API 엔드포인트
"""

from fastapi import APIRouter, Query, HTTPException, Depends
from typing import Dict, Any, List, Optional
from datetime import date
from app.services.sync.mdx_wello_sync_service import MdxWelloSyncService

router = APIRouter(prefix="/sync", tags=["sync"])

# 서비스 인스턴스
sync_service = MdxWelloSyncService()


@router.get("/mdx-patients")
async def get_mdx_patients(
    phoneno: str = Query(..., description="전화번호"),
    birthday: str = Query(..., description="생년월일 (YYYYMMDD 형식)"),
    name: str = Query(..., description="이름")
) -> Dict[str, Any]:
    """
    wello → mdx: 전화번호, 생년월일, 이름으로 mdx 환자 조회
    여러 년도 데이터가 있을 수 있으므로 리스트 반환
    """
    try:
        # 생년월일 문자열을 date 객체로 변환
        if len(birthday) == 8:
            birth_date = date(
                int(birthday[:4]),
                int(birthday[4:6]),
                int(birthday[6:8])
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="생년월일은 YYYYMMDD 형식이어야 합니다"
            )
        
        # MDX 환자 조회
        patients = await sync_service.get_mdx_patients_by_combo(
            phoneno=phoneno,
            birthday=birth_date,
            name=name
        )
        
        return {
            "success": True,
            "data": patients,
            "count": len(patients)
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"날짜 형식 오류: {str(e)}")
    except Exception as e:
        print(f"❌ [MDX 환자 조회] 오류: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"MDX 환자 조회 중 오류가 발생했습니다: {str(e)}"
        )

