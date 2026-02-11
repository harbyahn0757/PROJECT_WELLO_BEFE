"""
파트너 관련 상수 정의
"""

# 파트너 ID 상수
class PartnerIDs:
    """파트너 ID 상수 클래스"""
    WELNO = "welno"                    # WELNO 기본 파트너
    WELNO_INTERNAL = "welno_internal"  # WELNO 내부 회원 (기존 웰노 회원)
    KINDHABIT = "kindhabit"            # KindHabit 파트너
    MEDILINX = "medilinx"              # MediLinx 파트너
    TEST_PARTNER = "test_partner"      # 테스트 파트너

# 파트너별 특성
PARTNER_CHARACTERISTICS = {
    PartnerIDs.WELNO: {
        "name": "WELNO (기본)",
        "description": "기본 WELNO 파트너",
        "is_internal": True,
        "default_payment_required": False,
        "default_amount": 0
    },
    PartnerIDs.WELNO_INTERNAL: {
        "name": "WELNO 내부 회원",
        "description": "기존 WELNO 플랫폼 회원",
        "is_internal": True,
        "default_payment_required": True,
        "default_amount": 1000
    },
    PartnerIDs.KINDHABIT: {
        "name": "KindHabit",
        "description": "KindHabit 파트너",
        "is_internal": False,
        "default_payment_required": True,
        "default_amount": 7900
    },
    PartnerIDs.MEDILINX: {
        "name": "MediLinx",
        "description": "MediLinx 파트너",
        "is_internal": False,
        "default_payment_required": True,
        "default_amount": 7900
    },
    PartnerIDs.TEST_PARTNER: {
        "name": "Test Partner",
        "description": "테스트용 파트너",
        "is_internal": False,
        "default_payment_required": False,
        "default_amount": 0
    }
}

def get_welno_partner_for_member(is_existing_member: bool = False) -> str:
    """
    WELNO 회원 타입에 따른 파트너 ID 반환
    
    Args:
        is_existing_member: 기존 회원 여부
        
    Returns:
        적절한 파트너 ID
    """
    return PartnerIDs.WELNO_INTERNAL if is_existing_member else PartnerIDs.WELNO

def is_welno_partner(partner_id: str) -> bool:
    """
    WELNO 계열 파트너인지 확인
    
    Args:
        partner_id: 파트너 ID
        
    Returns:
        WELNO 계열 파트너 여부
    """
    return partner_id in [PartnerIDs.WELNO, PartnerIDs.WELNO_INTERNAL]

def get_partner_display_name(partner_id: str) -> str:
    """
    파트너 표시명 반환
    
    Args:
        partner_id: 파트너 ID
        
    Returns:
        파트너 표시명
    """
    return PARTNER_CHARACTERISTICS.get(partner_id, {}).get("name", partner_id)