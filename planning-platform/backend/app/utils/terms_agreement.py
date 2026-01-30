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
    
    우선순위: terms_agreement_detail → terms_agreement (하위 호환)
    
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
    # hospital_id와 uuid로 먼저 시도
    row = await conn.fetchrow("""
        SELECT terms_agreement, terms_agreement_detail, terms_agreed_at, terms_all_required_agreed_at
        FROM welno.welno_patients
        WHERE uuid = $1 AND hospital_id = $2
    """, uuid, hospital_id)
    
    # 못 찾으면 uuid만으로 재시도 (hospital_id 불일치 대응)
    if not row:
        logger.info(f"[약관검증] hospital_id={hospital_id}로 찾지 못함, uuid만으로 재시도")
        row = await conn.fetchrow("""
            SELECT terms_agreement, terms_agreement_detail, terms_agreed_at, terms_all_required_agreed_at
            FROM welno.welno_patients
            WHERE uuid = $1
            ORDER BY updated_at DESC
            LIMIT 1
        """, uuid)
    
    if not row:
        return {
            "is_agreed": False,
            "agreed_at": None,
            "terms_details": {},
            "missing_terms": ['terms_service', 'terms_privacy', 'terms_sensitive']
        }
    
    # 필수 약관: 서비스 이용약관, 개인정보 수집/이용, 민감정보 수집/이용
    required_terms = ['terms_service', 'terms_privacy', 'terms_sensitive']
    terms_details = {}
    missing_terms = []
    is_agreed = False
    agreed_at = row.get('terms_all_required_agreed_at') or row.get('terms_agreed_at')
    
    # 1. terms_agreement_detail 우선 체크 (새 형식)
    if row.get('terms_agreement_detail'):
        terms_detail = row['terms_agreement_detail']
        if isinstance(terms_detail, str):
            try:
                terms_detail = json.loads(terms_detail)
            except:
                terms_detail = {}
        
        # terms_agreement_detail 형식: {term_name: {agreed: bool, agreed_at: str}}
        for term_name in required_terms:
            term_data = terms_detail.get(term_name, {})
            if isinstance(term_data, dict):
                agreed = term_data.get('agreed', False)
            else:
                # 하위 호환: 직접 bool 값인 경우
                agreed = bool(term_data)
            
            terms_details[term_name] = agreed
            if not agreed:
                missing_terms.append(term_name)
        
        # 마케팅 약관 (선택)
        marketing_data = terms_detail.get('terms_marketing', {})
        if isinstance(marketing_data, dict):
            terms_details['terms_marketing'] = marketing_data.get('agreed', False)
        else:
            terms_details['terms_marketing'] = bool(marketing_data)
        
        is_agreed = len(missing_terms) == 0
        
        if not is_agreed:
            logger.info(f"[약관검증] UUID={uuid}: 미동의 약관 = {missing_terms} (terms_agreement_detail)")
        
        return {
            "is_agreed": is_agreed,
            "agreed_at": agreed_at,
            "terms_details": terms_details,
            "missing_terms": missing_terms
        }
    
    # 2. terms_agreement 체크 (기존 형식, 하위 호환)
    if row.get('terms_agreement'):
        terms = row['terms_agreement']
        if isinstance(terms, str):
            try:
                terms = json.loads(terms)
            except:
                terms = {}
        
        for term_name in required_terms:
            agreed = terms.get(term_name, False)
            terms_details[term_name] = agreed
            if not agreed:
                missing_terms.append(term_name)
        
        terms_details['terms_marketing'] = terms.get('terms_marketing', False)
        is_agreed = len(missing_terms) == 0
        
        if not is_agreed:
            logger.info(f"[약관검증] UUID={uuid}: 미동의 약관 = {missing_terms} (terms_agreement)")
        
        return {
            "is_agreed": is_agreed,
            "agreed_at": agreed_at,
            "terms_details": terms_details,
            "missing_terms": missing_terms
        }
    
    # 3. 약관 데이터 없음
    return {
        "is_agreed": False,
        "agreed_at": None,
        "terms_details": {},
        "missing_terms": required_terms
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
