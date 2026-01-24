"""
파트너 설정 관리 유틸리티
"""

from typing import Dict, Any, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


def get_partner_config(partner_id: str, conn=None) -> Optional[Dict[str, Any]]:
    """
    파트너 설정 조회
    
    Args:
        partner_id: 파트너 ID (예: 'medilinx', 'kindhabit')
        conn: DB 커넥션 (선택사항)
        
    Returns:
        파트너 설정 딕셔너리 또는 None
        {
            "partner_id": "medilinx",
            "partner_name": "MediLinx",
            "config": {
                "payment": {"required": true, "amount": 7900},
                "iframe": {"allowed": false, "domains": []},
                "encryption": {"aes_key": "...", "aes_iv": "..."}
            },
            "is_active": true
        }
    """
    from ..core.database import DatabaseManager
    
    try:
        db_manager = DatabaseManager()
        
        if conn is None:
            with db_manager.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT partner_id, partner_name, config, is_active, created_at, updated_at
                        FROM welno.tb_partner_config
                        WHERE partner_id = %s AND is_active = true
                    """, (partner_id,))
                    
                    row = cur.fetchone()
        else:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT partner_id, partner_name, config, is_active, created_at, updated_at
                    FROM welno.tb_partner_config
                    WHERE partner_id = %s AND is_active = true
                """, (partner_id,))
                
                row = cur.fetchone()
        
        if not row:
            logger.warning(f"파트너 설정을 찾을 수 없음: {partner_id}")
            return None
        
        result = {
            "partner_id": row[0],
            "partner_name": row[1],
            "config": row[2],  # JSONB는 자동으로 dict로 변환됨
            "is_active": row[3],
            "created_at": row[4],
            "updated_at": row[5]
        }
        
        logger.info(f"파트너 설정 조회 성공: {partner_id}")
        return result
            
    except Exception as e:
        logger.error(f"파트너 설정 조회 실패: {partner_id}, 오류: {e}")
        return None


def get_partner_config_by_api_key(api_key: str, conn=None) -> Optional[Dict[str, Any]]:
    """
    API Key로 파트너 설정 조회
    """
    from ..core.database import DatabaseManager
    
    try:
        db_manager = DatabaseManager()
        query = """
            SELECT partner_id, partner_name, config, is_active, created_at, updated_at
            FROM welno.tb_partner_config
            WHERE config->>'api_key' = %s AND is_active = true
            LIMIT 1
        """
        
        if conn is None:
            with db_manager.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(query, (api_key,))
                    row = cur.fetchone()
        else:
            with conn.cursor() as cur:
                cur.execute(query, (api_key,))
                row = cur.fetchone()
        
        if not row:
            logger.warning(f"API Key에 해당하는 파트너를 찾을 수 없음: {api_key}")
            return None
        
        return {
            "partner_id": row[0],
            "partner_name": row[1],
            "config": row[2],
            "is_active": row[3],
            "created_at": row[4],
            "updated_at": row[5]
        }
    except Exception as e:
        logger.error(f"API Key 기반 파트너 조회 실패: {e}")
        return None


def get_partner_encryption_keys(partner_id: str, conn=None) -> Optional[Tuple[str, str]]:
    """
    파트너 암호화 키 조회 (내부 사용)
    
    Args:
        partner_id: 파트너 ID
        conn: DB 커넥션 (선택사항)
        
    Returns:
        (aes_key, aes_iv) 튜플 또는 None
    """
    config = get_partner_config(partner_id, conn)
    
    if not config:
        return None
    
    encryption = config.get("config", {}).get("encryption", {})
    aes_key = encryption.get("aes_key")
    aes_iv = encryption.get("aes_iv")
    
    if not aes_key or not aes_iv:
        logger.warning(f"파트너 암호화 키 없음: {partner_id}")
        return None
    
    return (aes_key, aes_iv)


def requires_payment(partner_id: str, conn=None) -> bool:
    """
    파트너가 결제를 필요로 하는지 확인
    
    Args:
        partner_id: 파트너 ID
        conn: DB 커넥션 (선택사항)
        
    Returns:
        결제 필요 여부
    """
    config = get_partner_config(partner_id, conn)
    
    if not config:
        # 기본값: 결제 필요
        return True
    
    payment = config.get("config", {}).get("payment", {})
    return payment.get("required", True)


def get_payment_amount(partner_id: str, conn=None) -> int:
    """
    파트너 결제 금액 조회
    
    Args:
        partner_id: 파트너 ID
        conn: DB 커넥션 (선택사항)
        
    Returns:
        결제 금액 (원)
    """
    config = get_partner_config(partner_id, conn)
    
    if not config:
        # 기본값: 7900원
        return 7900
    
    payment = config.get("config", {}).get("payment", {})
    return payment.get("amount", 7900)


def is_iframe_allowed(partner_id: str, conn=None) -> bool:
    """
    파트너의 iframe 허용 여부 확인
    
    Args:
        partner_id: 파트너 ID
        conn: DB 커넥션 (선택사항)
        
    Returns:
        iframe 허용 여부
    """
    config = get_partner_config(partner_id, conn)
    
    if not config:
        # 기본값: 비허용
        return False
    
    iframe = config.get("config", {}).get("iframe", {})
    return iframe.get("allowed", False)


def get_public_partner_config(partner_id: str, conn=None) -> Optional[Dict[str, Any]]:
    """
    공개 가능한 파트너 설정만 반환 (암호화 키 제외)
    
    Args:
        partner_id: 파트너 ID
        conn: DB 커넥션 (선택사항)
        
    Returns:
        공개 설정 딕셔너리
        {
            "partner_id": "medilinx",
            "partner_name": "MediLinx",
            "payment": {"required": true, "amount": 7900},
            "iframe": {"allowed": false}
        }
    """
    config = get_partner_config(partner_id, conn)
    
    if not config:
        return None
    
    full_config = config.get("config", {})
    
    return {
        "partner_id": config["partner_id"],
        "partner_name": config["partner_name"],
        "payment": full_config.get("payment", {}),
        "iframe": {
            "allowed": full_config.get("iframe", {}).get("allowed", False)
            # domains는 보안상 제외
        }
    }
