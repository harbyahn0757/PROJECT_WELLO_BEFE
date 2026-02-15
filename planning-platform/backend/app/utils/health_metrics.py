"""
건강 지표 관련 공통 유틸리티

WELNO 프로젝트 전체에서 사용하는 건강 지표 필드 목록 및 계산 함수를 제공합니다.
- 환자정보 파싱 (initial_data + client_info → 표준 구조)
- 검진 메트릭스 추출
- 지표 검증/품질 판정
"""

import json
import logging
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)


# ─── 환자정보 + 검진데이터 파싱 (공통) ─────────────────────────

# SQL COALESCE 프래그먼트 — 쿼리에서 재사용
PATIENT_SELECT_COLUMNS = """
    COALESCE(
        l.initial_data->'patient_info'->>'name',
        l.client_info->>'patient_name',
        ''
    ) AS user_name,
    COALESCE(
        l.initial_data->'patient_info'->>'contact',
        l.client_info->>'patient_contact',
        ''
    ) AS user_phone,
    COALESCE(
        l.initial_data->'patient_info'->>'gender',
        l.client_info->>'patient_gender',
        ''
    ) AS user_gender,
    COALESCE(
        l.initial_data->'patient_info'->>'birth_date',
        l.client_info->>'patient_birth',
        ''
    ) AS user_birth,
    COALESCE(
        l.initial_data->'health_metrics'->>'checkup_date', ''
    ) AS checkup_date
""".strip()


def _safe_json(raw) -> dict:
    """JSONB 또는 문자열을 dict로 안전하게 파싱"""
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            return {}
    return {}


def parse_patient_info(
    initial_data, client_info
) -> Tuple[str, Optional[Dict[str, Any]]]:
    """
    initial_data + client_info에서 환자정보 + 검진 메트릭스를 표준 구조로 추출.

    Returns:
        (patient_name, health_data_dict_or_None)
        - patient_name: 환자 이름 (없으면 빈 문자열)
        - health_data: {patient_name, gender, birth_date, contact, checkup_date,
                        hospital_name, metrics} 또는 None
    """
    ci = _safe_json(client_info)
    raw = _safe_json(initial_data)

    # 환자 이름: client_info 우선 → initial_data 폴백
    patient_name = (
        ci.get("patient_name", "")
        or (raw.get("patient_info") or {}).get("name", "")
    )

    # 검진 메트릭스
    health_data = None
    if isinstance(raw, dict) and raw.get("has_data"):
        pi = raw.get("patient_info") or {}
        metrics = raw.get("health_metrics") or raw.get("checkup_results") or {}
        health_data = {
            "patient_name": patient_name or pi.get("name", ""),
            "gender": pi.get("gender", "") or ci.get("patient_gender", ""),
            "birth_date": pi.get("birth_date", "") or ci.get("patient_birth", ""),
            "contact": pi.get("contact", "") or ci.get("patient_contact", ""),
            "checkup_date": metrics.get("checkup_date", ""),
            "hospital_name": ci.get("hospital_name", ""),
            "metrics": metrics,
        }
    elif patient_name:
        # initial_data 없어도 client_info에서 기본 정보 제공
        health_data = {
            "patient_name": patient_name,
            "gender": ci.get("patient_gender", ""),
            "birth_date": ci.get("patient_birth", ""),
            "contact": ci.get("patient_contact", ""),
            "checkup_date": "",
            "hospital_name": ci.get("hospital_name", ""),
            "metrics": {},
        }

    return patient_name, health_data


def extract_metrics_json(initial_data) -> str:
    """initial_data에서 health_metrics를 JSON 문자열로 추출 (엑셀 내보내기용)"""
    raw = _safe_json(initial_data)
    metrics = raw.get("health_metrics", {})
    return json.dumps(metrics, ensure_ascii=False) if metrics else ""

# 건강 지표 필드 목록 (표준화된 필드명)
HEALTH_METRICS_FIELDS = [
    'height',           # 키
    'weight',           # 체중
    'waist',            # 허리둘레
    'waist_circumference',  # 허리둘레 (대체 필드명)
    'bmi',              # 체질량지수
    'sbp',              # 수축기혈압
    'bphigh',           # 수축기혈압 (대체 필드명)
    'dbp',              # 이완기혈압
    'bplwst',           # 이완기혈압 (대체 필드명)
    'fbs',              # 공복혈당
    'blds',             # 공복혈당 (대체 필드명)
    'tc',               # 총콜레스테롤
    'totchole',         # 총콜레스테롤 (대체 필드명)
    'hdl',              # HDL콜레스테롤
    'hdlchole',         # HDL콜레스테롤 (대체 필드명)
    'ldl',              # LDL콜레스테롤
    'ldlchole',         # LDL콜레스테롤 (대체 필드명)
    'tg',               # 중성지방
    'triglyceride',     # 중성지방 (대체 필드명)
    'ast',              # AST(간기능)
    'sgotast',          # AST (대체 필드명)
    'alt',              # ALT(간기능)
    'sgptalt',          # ALT (대체 필드명)
    'scr',              # 혈청크레아티닌(신기능)
    'creatinine'        # 혈청크레아티닌 (대체 필드명)
]

def get_metric_count(data: Dict[str, Any]) -> int:
    """
    건강 지표 개수 계산 (공통 유틸)
    
    주어진 데이터에서 유효한 건강 지표의 개수를 계산합니다.
    None, 빈 문자열, 0, 0.0은 유효하지 않은 값으로 간주합니다.
    
    Args:
        data: 건강 지표 데이터 딕셔너리
        
    Returns:
        유효한 지표의 개수
        
    Example:
        >>> data = {'height': 170, 'weight': 70, 'bmi': 24.2, 'sbp': None}
        >>> get_metric_count(data)
        3
    """
    return sum(
        1 for field in HEALTH_METRICS_FIELDS 
        if data.get(field) not in [None, '', 0, 0.0]
    )

def get_metric_count_from_tilko(raw_data: Dict[str, Any]) -> int:
    """
    틸코 raw_data에서 직접 건강 지표 개수 계산 (키값 매핑 활용)
    
    인덱스 기반 Inspections 구조를 키값 매핑으로 변환하여 빠르게 계산합니다.
    
    Args:
        raw_data: 틸코 검진 데이터 (Inspections 포함)
        
    Returns:
        유효한 지표의 개수
        
    Example:
        >>> raw_data = {"Inspections": [...]}
        >>> get_metric_count_from_tilko(raw_data)
        12
    """
    from ..services.welno_data_service import WelnoDataService
    
    service = WelnoDataService()
    key_value_mapping = service._extract_key_value_mapping(raw_data)
    
    # 유효한 지표 개수 계산
    return sum(
        1 for value in key_value_mapping.values()
        if value not in [None, '', 0, 0.0, '음성', '정상', 'N/A']
    )

def get_key_value_mapping_from_tilko(raw_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    틸코 raw_data를 키값 매핑 구조로 변환
    
    Args:
        raw_data: 틸코 검진 데이터 (Inspections 포함)
        
    Returns:
        키값 매핑 딕셔너리 {"height": 181.3, "weight": 82.2, ...}
        
    Example:
        >>> raw_data = {"Inspections": [...]}
        >>> mapping = get_key_value_mapping_from_tilko(raw_data)
        >>> print(mapping["height"])  # 181.3
    """
    from ..services.welno_data_service import WelnoDataService
    
    service = WelnoDataService()
    return service._extract_key_value_mapping(raw_data)

def is_data_sufficient(data: Dict[str, Any], threshold: int = 5) -> bool:
    """
    데이터 충족 여부 판단
    
    건강 지표 개수가 임계값 이상인지 확인합니다.
    기본 임계값은 5개입니다.
    
    Args:
        data: 건강 지표 데이터 딕셔너리
        threshold: 최소 필요 지표 개수 (기본값: 5)
        
    Returns:
        충족 여부 (True/False)
        
    Example:
        >>> data = {'height': 170, 'weight': 70, 'bmi': 24.2, 'sbp': 120, 'dbp': 80}
        >>> is_data_sufficient(data)
        True
    """
    return get_metric_count(data) >= threshold


# 질병예측 리포트에 필수적인 핵심 지표 (숫자여야 의미 있는 분석 가능)
CRITICAL_NUMERIC_FIELDS = {
    'blds': '공복혈당',
    'fbs': '공복혈당',
    'totchole': '총콜레스테롤',
    'tc': '총콜레스테롤',
    'hdlchole': 'HDL콜레스테롤',
    'hdl': 'HDL콜레스테롤',
    'triglyceride': '중성지방',
    'tg': '중성지방',
    'bphigh': '수축기혈압',
    'sbp': '수축기혈압',
    'bplwst': '이완기혈압',
    'dbp': '이완기혈압',
    'sgotast': 'AST',
    'ast': 'AST',
    'sgptalt': 'ALT',
    'alt': 'ALT',
    'creatinine': '크레아티닌',
    'scr': '크레아티닌',
}

# 숫자가 아닌 값으로 판정되는 패턴
INVALID_VALUE_PATTERNS = ['비해당', '비대상', '경계', '해당없음', '미실시', '검사안함', '정상', '이상']


def _is_valid_numeric(value) -> bool:
    """값이 유효한 숫자인지 검사"""
    if value is None or value == '':
        return False
    try:
        v = float(str(value).strip())
        return v > 0  # 0 이하는 무효
    except (ValueError, TypeError):
        return False


def validate_data_quality(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    검진데이터 품질을 검증하여 결과를 반환.
    
    Returns:
        {
            "quality": "good" | "partial" | "insufficient",
            "valid_count": int,       # 유효한 핵심 지표 수
            "total_count": int,       # 전체 핵심 지표 수 (중복 제거)
            "invalid_fields": [...],  # 비정상 값이 있는 필드 목록
            "message": str            # 사용자에게 보여줄 메시지
        }
    """
    # 중복 필드(대체명) 그룹핑: 하나라도 유효하면 OK
    field_groups = {
        '공복혈당': ['blds', 'fbs'],
        '총콜레스테롤': ['totchole', 'tc'],
        'HDL콜레스테롤': ['hdlchole', 'hdl'],
        '중성지방': ['triglyceride', 'tg'],
        '수축기혈압': ['bphigh', 'sbp'],
        '이완기혈압': ['bplwst', 'dbp'],
        'AST': ['sgotast', 'ast'],
        'ALT': ['sgptalt', 'alt'],
        '크레아티닌': ['creatinine', 'scr'],
    }
    
    valid_count = 0
    total_count = len(field_groups)
    invalid_fields = []
    
    for label, fields in field_groups.items():
        group_valid = False
        group_has_invalid = False
        for field in fields:
            val = data.get(field)
            if val is not None and val != '':
                if _is_valid_numeric(val):
                    group_valid = True
                    break
                else:
                    group_has_invalid = True
        
        if group_valid:
            valid_count += 1
        elif group_has_invalid:
            # 값은 있는데 숫자가 아닌 경우
            raw_vals = [str(data.get(f, '')) for f in fields if data.get(f)]
            invalid_fields.append({"field": label, "values": raw_vals})
    
    # 품질 판정
    if valid_count >= 7:
        quality = "good"
        message = ""
    elif valid_count >= 4:
        quality = "partial"
        message = f"일부 검진 항목({total_count - valid_count}개)의 데이터가 부족하여 분석 정확도가 낮을 수 있습니다."
    else:
        quality = "insufficient"
        message = "검진 데이터가 충분하지 않아 질병 예측 분석이 어렵습니다. 검진 결과를 확인 후 다시 시도해주세요."
    
    return {
        "quality": quality,
        "valid_count": valid_count,
        "total_count": total_count,
        "invalid_fields": invalid_fields,
        "message": message
    }
