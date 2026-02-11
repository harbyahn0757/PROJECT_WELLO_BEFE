"""
통합 파트너 식별 서비스

모든 API 엔드포인트에서 일관된 파트너 식별 로직을 제공합니다.
- API 키 기반 파트너 식별
- 헤더 기반 파트너 식별  
- 세션 기반 파트너 식별
- 캠페인 데이터 기반 파트너 식별
"""

from typing import Optional, Dict, Any
from fastapi import Request, HTTPException
from ..services.dynamic_config_service import dynamic_config
from ..data.redis_session_manager import RedisSessionManager
import logging

logger = logging.getLogger(__name__)

class PartnerIdentificationService:
    """통합 파트너 식별 서비스"""
    
    def __init__(self):
        self.session_manager = RedisSessionManager()
    
    async def identify_partner_from_request(self, request: Request) -> str:
        """
        요청에서 파트너 ID를 식별합니다.
        
        우선순위:
        1. X-Partner-ID 헤더
        2. X-API-Key 헤더에서 파트너 조회
        3. 요청 body의 partner_id
        4. 기본값: welno
        
        Args:
            request: FastAPI Request 객체
            
        Returns:
            str: 파트너 ID
        """
        try:
            # 1. 헤더에서 직접 파트너 ID 확인
            partner_id = request.headers.get("X-Partner-ID")
            if partner_id:
                logger.info(f"🔍 [파트너식별] 헤더에서 파트너 ID 발견: {partner_id}")
                return partner_id
            
            # 2. API 키에서 파트너 조회
            api_key = request.headers.get("X-API-Key")
            if api_key:
                partner_info = await dynamic_config.get_partner_by_api_key(api_key)
                if partner_info:
                    partner_id = partner_info.get('partner_id')
                    if partner_id:
                        logger.info(f"🔍 [파트너식별] API 키에서 파트너 ID 발견: {partner_id}")
                        return partner_id
            
            # 3. 요청 body에서 파트너 ID 확인 (JSON 요청인 경우)
            if request.headers.get("content-type") == "application/json":
                try:
                    body = await request.json()
                    if isinstance(body, dict) and body.get("partner_id"):
                        partner_id = body["partner_id"]
                        logger.info(f"🔍 [파트너식별] 요청 body에서 파트너 ID 발견: {partner_id}")
                        return partner_id
                except:
                    pass  # JSON 파싱 실패 시 무시
            
            # 4. 기본값 반환
            logger.info(f"🔍 [파트너식별] 기본 파트너 ID 사용: welno")
            return "welno"
            
        except Exception as e:
            logger.warning(f"⚠️ [파트너식별] 파트너 식별 중 오류: {e}, 기본값 사용")
            return "welno"
    
    def identify_partner_from_session_id(self, session_id: str) -> Optional[str]:
        """
        세션 ID에서 파트너 ID를 추출합니다.
        
        Args:
            session_id: 세션 ID (형식: partner_id_hash)
            
        Returns:
            Optional[str]: 파트너 ID 또는 None
        """
        return self.session_manager.extract_partner_from_session_id(session_id)
    
    async def identify_partner_from_campaign_data(self, oid: str = None, uuid: str = None) -> str:
        """
        캠페인 데이터에서 파트너 ID를 식별합니다.
        
        Args:
            oid: 캠페인 주문 ID
            uuid: 사용자 UUID
            
        Returns:
            str: 파트너 ID
        """
        try:
            if oid:
                # tb_campaign_payments에서 파트너 ID 조회
                from ..core.database import db_manager
                
                query = "SELECT partner_id FROM welno.tb_campaign_payments WHERE oid = %s LIMIT 1"
                with db_manager.get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(query, (oid,))
                        result = cur.fetchone()
                        if result:
                            partner_id = result[0]
                            logger.info(f"🔍 [파트너식별] 캠페인 OID에서 파트너 ID 발견: {partner_id}")
                            return partner_id
            
            if uuid:
                # welno_patients에서 파트너 ID 조회 (가장 최근 레코드)
                from ..core.database import db_manager
                
                query = "SELECT partner_id FROM welno.welno_patients WHERE uuid = %s ORDER BY created_at DESC LIMIT 1"
                with db_manager.get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(query, (uuid,))
                        result = cur.fetchone()
                        if result:
                            partner_id = result[0]
                            logger.info(f"🔍 [파트너식별] 환자 UUID에서 파트너 ID 발견: {partner_id}")
                            return partner_id
            
            # 기본값 반환
            logger.info(f"🔍 [파트너식별] 캠페인 데이터에서 파트너 ID를 찾을 수 없음, 기본값 사용: welno")
            return "welno"
            
        except Exception as e:
            logger.warning(f"⚠️ [파트너식별] 캠페인 데이터에서 파트너 식별 중 오류: {e}, 기본값 사용")
            return "welno"
    
    async def validate_partner_access(self, partner_id: str, resource_type: str, resource_id: str) -> bool:
        """
        파트너의 리소스 접근 권한을 검증합니다.
        
        Args:
            partner_id: 파트너 ID
            resource_type: 리소스 타입 ('session', 'patient', 'campaign')
            resource_id: 리소스 ID
            
        Returns:
            bool: 접근 권한 여부
        """
        try:
            if resource_type == "session":
                # 세션 소유권 검증
                return self.session_manager.verify_session_ownership(resource_id, partner_id)
            
            elif resource_type == "patient":
                # 환자 데이터 소유권 검증
                from ..core.database import db_manager
                
                query = "SELECT COUNT(*) FROM welno.welno_patients WHERE uuid = %s AND partner_id = %s"
                with db_manager.get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(query, (resource_id, partner_id))
                        count = cur.fetchone()[0]
                        return count > 0
            
            elif resource_type == "campaign":
                # 캠페인 데이터 소유권 검증
                from ..core.database import db_manager
                
                query = "SELECT COUNT(*) FROM welno.tb_campaign_payments WHERE oid = %s AND partner_id = %s"
                with db_manager.get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(query, (resource_id, partner_id))
                        count = cur.fetchone()[0]
                        return count > 0
            
            return False
            
        except Exception as e:
            logger.error(f"❌ [파트너식별] 접근 권한 검증 중 오류: {e}")
            return False
    
    def get_partner_context(self, partner_id: str) -> Dict[str, Any]:
        """
        파트너 컨텍스트 정보를 반환합니다.
        
        Args:
            partner_id: 파트너 ID
            
        Returns:
            Dict[str, Any]: 파트너 컨텍스트 정보
        """
        return {
            "partner_id": partner_id,
            "session_prefix": f"{partner_id}_",
            "redis_key_prefix": f"welno:partner:{partner_id}:",
            "log_prefix": f"[{partner_id.upper()}]"
        }

# 싱글톤 인스턴스
partner_identification_service = PartnerIdentificationService()