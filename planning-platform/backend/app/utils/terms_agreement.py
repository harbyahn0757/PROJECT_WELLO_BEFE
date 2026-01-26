"""
약관 동의 검증 유틸리티

유입 경로별 약관 동의 시점:
- WELNO 직접: Tilko 인증 → welno_patients 생성 → 약관 동의
- 파트너 (데이터 충분): tb_campaign_payments 저장 → 약관 동의 → welno_patients 생성
- 파트너 (데이터 부족): 약관 동의 → welno_patients 임시 생성 → Tilko 인증
"""
import json
from typing import Dict, Any, Optional, List
import asyncpg
import logging

logger = logging.getLogger(__name__)


async def verify_terms_agreement(
    uuid: str,
    hospital_id: str,
    conn: asyncpg.Connection
) -> Dict[str, Any]:
    """
    약관 동의 상태 검증 (DB 기준)
    
    Args:
        uuid: 환자 UUID
        hospital_id: 병원 ID
        conn: DB 연결
        
    Returns:
        {
            "is_agreed": bool,  # 필수 약관 모두 동의 여부
            "agreed_at": datetime,
            "terms_details": {
                "terms_service": bool,
                "terms_privacy": bool,
                "terms_sensitive": bool,
                "terms_marketing": bool
            },
            "missing_terms": List[str]  # 미동의 약관 목록
        }
    """
    row = await conn.fetchrow("""
        SELECT terms_agreement, terms_agreed_at
        FROM welno.welno_patients
        WHERE uuid = $1 AND hospital_id = $2
    """, uuid, hospital_id)
    
    if not row or not row['terms_agreement']:
        return {
            "is_agreed": False,
            "agreed_at": None,
            "terms_details": {},
            "missing_terms": ['terms_service', 'terms_privacy', 'terms_sensitive']
        }
    
    terms = row['terms_agreement']
    if isinstance(terms, str):
        try:
            terms = json.loads(terms)
        except:
            terms = {}
    
    # 필수 약관: 서비스 이용약관, 개인정보 수집/이용, 민감정보 수집/이용
    required_terms = ['terms_service', 'terms_privacy', 'terms_sensitive']
    missing_terms = [term for term in required_terms if not terms.get(term, False)]
    is_agreed = len(missing_terms) == 0
    
    if not is_agreed:
        logger.info(f"[약관검증] UUID={uuid}: 미동의 약관 = {missing_terms}")
    
    return {
        "is_agreed": is_agreed,
        "agreed_at": row['terms_agreed_at'],
        "terms_details": terms,
        "missing_terms": missing_terms
    }


def is_terms_fully_agreed(terms_json: Any) -> bool:
    """
    간단한 약관 동의 여부 체크 (dict 또는 JSON 문자열)
    
    Args:
        terms_json: 약관 동의 정보 (dict, str, 또는 None)
        
    Returns:
        bool: 필수 약관 모두 동의 여부
    """
    if not terms_json:
        return False
    
    if isinstance(terms_json, str):
        try:
            terms_json = json.loads(terms_json)
        except:
            return False
    
    # 필수 약관 체크
    required_terms = ['terms_service', 'terms_privacy', 'terms_sensitive']
    return all(terms_json.get(term, False) for term in required_terms)


async def check_patient_registration_status(
    uuid: str,
    hospital_id: str,
    partner_id: Optional[str],
    conn: asyncpg.Connection
) -> Dict[str, Any]:
    """
    환자 등록 상태 확인 (유입 경로 고려)
    
    Returns:
        {
            "is_welno_patient": bool,  # welno_patients에 등록 여부
            "is_partner_recorded": bool,  # tb_campaign_payments 기록 여부
            "registration_source": str,  # DIRECT, PARTNER, None
            "has_terms": bool,  # 약관 동의 여부
            "has_data": bool  # 데이터 존재 여부
        }
    """
    # 1. welno_patients 확인
    patient_row = await conn.fetchrow("""
        SELECT id, registration_source, terms_agreement, has_health_data
        FROM welno.welno_patients
        WHERE uuid = $1 AND hospital_id = $2
    """, uuid, hospital_id)
    
    is_welno_patient = bool(patient_row)
    has_terms = False
    has_data = False
    registration_source = None
    
    if patient_row:
        registration_source = patient_row['registration_source']
        has_terms = is_terms_fully_agreed(patient_row['terms_agreement'])
        has_data = patient_row['has_health_data'] or False
    
    # 2. tb_campaign_payments 확인 (파트너 유입)
    is_partner_recorded = False
    if partner_id:
        payment_row = await conn.fetchrow("""
            SELECT oid FROM welno.tb_campaign_payments
            WHERE uuid = $1 AND partner_id = $2
            LIMIT 1
        """, uuid, partner_id)
        is_partner_recorded = bool(payment_row)
    
    return {
        "is_welno_patient": is_welno_patient,
        "is_partner_recorded": is_partner_recorded,
        "registration_source": registration_source,
        "has_terms": has_terms,
        "has_data": has_data
    }
