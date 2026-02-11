"""
파트너 전용 관리 API

파트너가 자신의 병원 목록과 대기 목록을 관리할 수 있는 API를 제공합니다.
- 파트너 인증 필수
- 파트너별 데이터 격리 적용
"""

from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from ....core.database import db_manager
from ....middleware.partner_auth import PartnerAuthInfo, verify_partner_api_key

router = APIRouter(prefix="/partner-management", tags=["partner-management"])


class PendingHospitalItem(BaseModel):
    """대기 중인 병원 정보"""
    id: int
    hospital_id: str
    first_seen_at: datetime
    last_seen_at: datetime
    request_count: int
    status: str = "pending"


class HospitalConfigItem(BaseModel):
    """병원 설정 정보"""
    partner_id: str
    hospital_id: str
    hospital_name: Optional[str] = None
    is_active: bool = True
    config: Dict[str, Any] = {}


class HospitalRegistrationRequest(BaseModel):
    """병원 등록 요청"""
    hospital_id: str
    hospital_name: str
    config: Optional[Dict[str, Any]] = {}


@router.get("/pending-hospitals", response_model=List[PendingHospitalItem])
async def get_partner_pending_hospitals(
    partner_info: PartnerAuthInfo = Depends(verify_partner_api_key)
):
    """
    파트너별 대기 중인 병원 목록 조회
    
    파트너는 자신의 대기 목록만 볼 수 있습니다.
    """
    try:
        query = """
            SELECT id, partner_id, hospital_id, first_seen_at, last_seen_at, request_count, status
            FROM welno.tb_pending_hospital_registration
            WHERE partner_id = %s AND status = 'pending'
            ORDER BY last_seen_at DESC
        """
        
        result = await db_manager.execute_query(query, (partner_info.partner_id,))
        
        return [
            PendingHospitalItem(
                id=row['id'],
                hospital_id=row['hospital_id'],
                first_seen_at=row['first_seen_at'],
                last_seen_at=row['last_seen_at'],
                request_count=row['request_count'],
                status=row['status']
            )
            for row in result
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"파트너 대기 병원 목록 조회 실패: {str(e)}"
        )


@router.get("/hospitals", response_model=List[HospitalConfigItem])
async def get_partner_hospitals(
    partner_info: PartnerAuthInfo = Depends(verify_partner_api_key)
):
    """
    파트너별 등록된 병원 목록 조회
    
    파트너는 자신의 병원 목록만 볼 수 있습니다.
    """
    try:
        query = """
            SELECT 
                rc.partner_id,
                rc.hospital_id,
                COALESCE(h.hospital_name, rc.hospital_id) as hospital_name,
                rc.is_active,
                rc.config
            FROM welno.tb_hospital_rag_config rc
            LEFT JOIN welno.welno_hospitals h ON rc.hospital_id = h.hospital_id AND rc.partner_id = h.partner_id
            WHERE rc.partner_id = %s AND rc.hospital_id != '*'
            ORDER BY hospital_name
        """
        
        result = await db_manager.execute_query(query, (partner_info.partner_id,))
        
        return [
            HospitalConfigItem(
                partner_id=row['partner_id'],
                hospital_id=row['hospital_id'],
                hospital_name=row['hospital_name'],
                is_active=row['is_active'],
                config=row['config'] or {}
            )
            for row in result
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"파트너 병원 목록 조회 실패: {str(e)}"
        )


@router.post("/hospitals/register")
async def register_hospital_from_pending(
    hospital_id: str,
    registration_data: HospitalRegistrationRequest,
    partner_info: PartnerAuthInfo = Depends(verify_partner_api_key)
):
    """
    대기 목록에서 병원을 정식 등록
    
    Args:
        hospital_id: 대기 목록의 병원 ID
        registration_data: 등록할 병원 정보
    """
    try:
        # 1. 대기 목록에서 해당 병원이 존재하는지 확인
        pending_check_query = """
            SELECT id FROM welno.tb_pending_hospital_registration
            WHERE partner_id = %s AND hospital_id = %s AND status = 'pending'
        """
        pending_result = await db_manager.execute_query(
            pending_check_query, 
            (partner_info.partner_id, hospital_id)
        )
        
        if not pending_result:
            raise HTTPException(
                status_code=404,
                detail=f"대기 목록에서 병원 {hospital_id}를 찾을 수 없습니다."
            )
        
        # 2. 병원 정보를 welno_hospitals 테이블에 추가 (중복 허용)
        hospital_insert_query = """
            INSERT INTO welno.welno_hospitals (partner_id, hospital_id, hospital_name, created_at)
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (partner_id, hospital_id) 
            DO UPDATE SET 
                hospital_name = EXCLUDED.hospital_name,
                updated_at = CURRENT_TIMESTAMP
        """
        await db_manager.execute_update(
            hospital_insert_query,
            (partner_info.partner_id, registration_data.hospital_id, registration_data.hospital_name)
        )
        
        # 3. RAG 설정을 tb_hospital_rag_config에 추가
        config_insert_query = """
            INSERT INTO welno.tb_hospital_rag_config (partner_id, hospital_id, config, is_active, created_at)
            VALUES (%s, %s, %s, true, CURRENT_TIMESTAMP)
            ON CONFLICT (partner_id, hospital_id)
            DO UPDATE SET
                config = EXCLUDED.config,
                is_active = true,
                updated_at = CURRENT_TIMESTAMP
        """
        import json
        await db_manager.execute_update(
            config_insert_query,
            (partner_info.partner_id, registration_data.hospital_id, json.dumps(registration_data.config))
        )
        
        # 4. 대기 목록에서 상태를 'registered'로 변경
        update_pending_query = """
            UPDATE welno.tb_pending_hospital_registration
            SET status = 'registered', last_seen_at = CURRENT_TIMESTAMP
            WHERE partner_id = %s AND hospital_id = %s
        """
        await db_manager.execute_update(
            update_pending_query,
            (partner_info.partner_id, hospital_id)
        )
        
        return {
            "success": True,
            "message": f"병원 {registration_data.hospital_name} ({registration_data.hospital_id})이 성공적으로 등록되었습니다.",
            "hospital_id": registration_data.hospital_id,
            "partner_id": partner_info.partner_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"병원 등록 실패: {str(e)}"
        )


@router.get("/hospitals/{hospital_id}/config")
async def get_hospital_config(
    hospital_id: str,
    partner_info: PartnerAuthInfo = Depends(verify_partner_api_key)
):
    """
    파트너의 특정 병원 설정 조회
    
    파트너는 자신의 병원 설정만 조회할 수 있습니다.
    """
    try:
        query = """
            SELECT 
                rc.partner_id,
                rc.hospital_id,
                COALESCE(h.hospital_name, rc.hospital_id) as hospital_name,
                rc.is_active,
                rc.config,
                rc.created_at,
                rc.updated_at
            FROM welno.tb_hospital_rag_config rc
            LEFT JOIN welno.welno_hospitals h ON rc.hospital_id = h.hospital_id AND rc.partner_id = h.partner_id
            WHERE rc.partner_id = %s AND rc.hospital_id = %s
        """
        
        result = await db_manager.execute_query(query, (partner_info.partner_id, hospital_id))
        
        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"병원 {hospital_id}의 설정을 찾을 수 없습니다."
            )
        
        row = result[0]
        return {
            "partner_id": row['partner_id'],
            "hospital_id": row['hospital_id'],
            "hospital_name": row['hospital_name'],
            "is_active": row['is_active'],
            "config": row['config'] or {},
            "created_at": row['created_at'],
            "updated_at": row['updated_at']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"병원 설정 조회 실패: {str(e)}"
        )


@router.put("/hospitals/{hospital_id}/config")
async def update_hospital_config(
    hospital_id: str,
    config_data: Dict[str, Any],
    partner_info: PartnerAuthInfo = Depends(verify_partner_api_key)
):
    """
    파트너의 특정 병원 설정 수정
    
    파트너는 자신의 병원 설정만 수정할 수 있습니다.
    """
    try:
        # 1. 해당 병원이 파트너 소유인지 확인
        check_query = """
            SELECT hospital_id FROM welno.tb_hospital_rag_config
            WHERE partner_id = %s AND hospital_id = %s
        """
        check_result = await db_manager.execute_query(
            check_query, 
            (partner_info.partner_id, hospital_id)
        )
        
        if not check_result:
            raise HTTPException(
                status_code=404,
                detail=f"병원 {hospital_id}를 찾을 수 없거나 접근 권한이 없습니다."
            )
        
        # 2. 설정 업데이트
        import json
        update_query = """
            UPDATE welno.tb_hospital_rag_config
            SET config = %s, updated_at = CURRENT_TIMESTAMP
            WHERE partner_id = %s AND hospital_id = %s
        """
        await db_manager.execute_update(
            update_query,
            (json.dumps(config_data), partner_info.partner_id, hospital_id)
        )
        
        return {
            "success": True,
            "message": f"병원 {hospital_id}의 설정이 성공적으로 업데이트되었습니다.",
            "hospital_id": hospital_id,
            "partner_id": partner_info.partner_id,
            "updated_config": config_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"병원 설정 업데이트 실패: {str(e)}"
        )


@router.get("/stats")
async def get_partner_stats(
    partner_info: PartnerAuthInfo = Depends(verify_partner_api_key)
):
    """
    파트너별 통계 정보 조회
    """
    try:
        # 1. 등록된 병원 수
        hospitals_query = """
            SELECT COUNT(*) as hospital_count
            FROM welno.tb_hospital_rag_config
            WHERE partner_id = %s AND hospital_id != '*' AND is_active = true
        """
        hospitals_result = await db_manager.execute_query(hospitals_query, (partner_info.partner_id,))
        
        # 2. 대기 중인 병원 수
        pending_query = """
            SELECT COUNT(*) as pending_count
            FROM welno.tb_pending_hospital_registration
            WHERE partner_id = %s AND status = 'pending'
        """
        pending_result = await db_manager.execute_query(pending_query, (partner_info.partner_id,))
        
        # 3. 최근 30일 채팅 세션 수 (대략적 추정)
        chat_query = """
            SELECT COUNT(DISTINCT session_id) as chat_sessions
            FROM welno.tb_partner_rag_chat_log
            WHERE partner_id = %s AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        """
        chat_result = await db_manager.execute_query(chat_query, (partner_info.partner_id,))
        
        return {
            "partner_info": {
                "partner_id": partner_info.partner_id,
                "partner_name": partner_info.partner_name
            },
            "stats": {
                "registered_hospitals": hospitals_result[0]['hospital_count'] if hospitals_result else 0,
                "pending_hospitals": pending_result[0]['pending_count'] if pending_result else 0,
                "chat_sessions_30d": chat_result[0]['chat_sessions'] if chat_result else 0
            },
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"파트너 통계 조회 실패: {str(e)}"
        )