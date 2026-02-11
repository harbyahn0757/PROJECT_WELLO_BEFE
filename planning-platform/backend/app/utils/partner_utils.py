"""
파트너 관련 공통 유틸리티

파트너 식별 및 설정 조회 공통 함수를 제공합니다.
"""

from typing import Optional, Dict, Tuple
from app.utils.partner_config import get_partner_config, get_partner_config_by_api_key

def identify_partner(
    api_key: Optional[str] = None, 
    partner_id: Optional[str] = None
) -> Tuple[Optional[Dict], Optional[str]]:
    """
    파트너 식별 (공통 유틸)
    
    API Key 또는 Partner ID를 통해 파트너 설정을 조회합니다.
    API Key가 우선순위를 가지며, 없을 경우 Partner ID로 조회합니다.
    
    Args:
        api_key: 파트너 API Key (선택)
        partner_id: 파트너 ID (선택)
        
    Returns:
        Tuple[partner_config, partner_id]
        - partner_config: 파트너 설정 딕셔너리 또는 None
        - partner_id: 파트너 ID 또는 None
        
    Example:
        >>> config, pid = identify_partner(api_key="test_key_123")
        >>> print(config['partner_id'])
        'medilinx'
        
        >>> config, pid = identify_partner(partner_id="medilinx")
        >>> print(pid)
        'medilinx'
    """
    partner_config = None
    
    # 1. API Key로 조회 (우선순위 높음)
    if api_key:
        partner_config = get_partner_config_by_api_key(api_key)
        if partner_config:
            partner_id = partner_config["partner_id"]
    
    # 2. Partner ID로 조회 (API Key 없거나 조회 실패 시)
    if not partner_config and partner_id:
        partner_config = get_partner_config(partner_id)
    
    return partner_config, partner_id

# requires_payment 함수는 partner_config.py로 통합됨
# from ..utils.partner_config import requires_payment 사용

def get_default_hospital_id(partner_config: Optional[Dict], fallback: str = "PARTNER") -> str:
    """
    파트너 기본 병원 ID 조회
    
    Args:
        partner_config: 파트너 설정 딕셔너리
        fallback: 기본값 (default: "PARTNER")
        
    Returns:
        병원 ID 문자열
        
    Example:
        >>> config = get_partner_config('medilinx')
        >>> get_default_hospital_id(config)
        'MEDILINX_HOSP'
    """
    if not partner_config:
        return fallback
    
    return partner_config.get('default_hospital_id', fallback)
