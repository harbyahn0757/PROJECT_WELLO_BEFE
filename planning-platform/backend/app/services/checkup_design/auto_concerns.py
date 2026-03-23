"""
검진 데이터에서 자동 관심항목(concerns) 추출

FE checkupDesignParser.ts의 extractAbnormalCheckupItems() BE 미러.
사용자 선택 없이 자동 플래닝(Step1)을 실행할 때 사용.
"""

import json
import re
import logging
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# FE HEALTH_METRICS 미러
HEALTH_METRICS = [
    '신장', '체중', 'BMI', '허리둘레', '혈압 (수축기)',
    '혈압 (이완기)', '혈당', '총콜레스테롤', 'HDL 콜레스테롤',
    'LDL 콜레스테롤', '중성지방', '헤모글로빈',
]

# 지표별 단위
METRIC_UNITS = {
    '신장': 'cm', '체중': 'kg', 'BMI': 'kg/m²', '허리둘레': 'cm',
    '혈압 (수축기)': 'mmHg', '혈압 (이완기)': 'mmHg', '혈당': 'mg/dL',
    '총콜레스테롤': 'mg/dL', 'HDL 콜레스테롤': 'mg/dL',
    'LDL 콜레스테롤': 'mg/dL', '중성지방': 'mg/dL', '헤모글로빈': 'g/dL',
}


def auto_extract_concerns(
    health_data: List[Dict[str, Any]],
    prescription_data: Optional[List[Dict[str, Any]]] = None,
    gender: str = 'M',
) -> List[Dict[str, Any]]:
    """건강 데이터에서 비정상/경계 항목을 자동 추출하여 ConcernItem 리스트 반환.

    Args:
        health_data: welno_checkup_data 레코드 리스트 (raw_data 포함)
        prescription_data: 처방전 데이터 (있으면 약물 관련 concern 추가)
        gender: 성별 ('M' or 'F')

    Returns:
        ConcernItem 딕셔너리 리스트 (checkup_design.py의 ConcernItem 형식)
    """
    concerns: List[Dict[str, Any]] = []

    for record in health_data:
        raw_data = record.get('raw_data') or record
        if isinstance(raw_data, str):
            try:
                raw_data = json.loads(raw_data)
            except (json.JSONDecodeError, TypeError):
                continue

        if not isinstance(raw_data, dict) or not raw_data.get('Inspections'):
            continue

        checkup_date = raw_data.get('CheckUpDate') or record.get('checkup_date', '')
        location = raw_data.get('Location') or record.get('location', '병원')

        for metric in HEALTH_METRICS:
            if metric == '신장':
                continue  # 신장은 neutral, 관심항목 아님

            value, item_refs = _find_metric_value(raw_data, metric)
            if value is None:
                continue

            status = _determine_status(metric, value, item_refs, gender)
            if status in ('warning', 'abnormal'):
                concerns.append({
                    'type': 'checkup',
                    'id': f"auto-{metric}-{checkup_date}",
                    'name': metric,
                    'value': value,
                    'unit': METRIC_UNITS.get(metric, ''),
                    'date': checkup_date,
                    'location': location,
                    'status': status,
                })

    # 처방전 기반 concern 추가
    if prescription_data:
        med_concerns = _extract_medication_concerns(prescription_data)
        concerns.extend(med_concerns)

    # 중복 제거 (같은 metric + 같은 date)
    seen = set()
    unique = []
    for c in concerns:
        key = (c['name'], c.get('date', ''))
        if key not in seen:
            seen.add(key)
            unique.append(c)

    logger.info(f"[auto_concerns] 자동 추출 완료: {len(unique)}개 concern")
    return unique


def _find_metric_value(
    raw_data: Dict[str, Any], metric: str
) -> Tuple[Optional[float], List[Dict]]:
    """Inspections 구조에서 지표 값 + ItemReferences 추출."""
    for inspection in raw_data.get('Inspections', []):
        for illness in inspection.get('Illnesses', []):
            for item in illness.get('Items', []):
                if not item.get('Name'):
                    continue
                if _matches_metric(item['Name'], metric):
                    val_str = item.get('Value', '')
                    try:
                        value = float(val_str)
                        if value > 0:
                            refs = item.get('ItemReferences', [])
                            return value, refs
                    except (ValueError, TypeError):
                        pass
    return None, []


def _matches_metric(item_name: str, metric: str) -> bool:
    """FE checkupDesignParser의 항목명 매칭 로직."""
    name = item_name.lower()
    m = metric.lower()

    if metric == 'HDL 콜레스테롤':
        return 'hdl' in name or '고밀도' in name
    if metric == 'LDL 콜레스테롤':
        return 'ldl' in name or '저밀도' in name
    if metric == '총콜레스테롤':
        return '총콜레스테롤' in name or (
            '콜레스테롤' in name and 'hdl' not in name and 'ldl' not in name
            and '고밀도' not in name and '저밀도' not in name
        )
    if metric == 'BMI':
        return '체질량지수' in name or 'bmi' in name
    if metric == '허리둘레':
        return '허리' in name or 'waist' in name
    if '혈압' in m:
        return '혈압' in name
    if metric == '중성지방':
        return '중성지방' in name
    if metric == '헤모글로빈':
        return '혈색소' in name or '헤모글로빈' in name

    clean = m.replace(' (수축기)', '').replace(' (이완기)', '')
    return clean in name


def _determine_status(
    metric: str,
    value: float,
    item_refs: List[Dict],
    gender: str = 'M',
) -> str:
    """FE getHealthStatus의 범위 판정 로직. 'normal'/'warning'/'abnormal' 반환."""
    if not item_refs:
        # ItemReferences 없으면 수치 기반 간이 판정
        return _fallback_status(metric, value, gender)

    # 질환의심 범위 체크
    abnormal_ref = next((r for r in item_refs if r.get('Name') == '질환의심'), None)
    if abnormal_ref and _is_in_range(value, abnormal_ref.get('Value', ''), gender):
        return 'abnormal'

    # 정상 범위 체크
    normal_ref = next(
        (r for r in item_refs if r.get('Name') in ('정상', '정상(A)', '정상(B)')),
        None,
    )
    if normal_ref and _is_in_range(value, normal_ref.get('Value', ''), gender):
        return 'normal'

    # 경계 범위
    border_ref = next(
        (r for r in item_refs if r.get('Name') in ('정상(B)', '정상(경계)')),
        None,
    )
    if border_ref and _is_in_range(value, border_ref.get('Value', ''), gender):
        return 'warning'

    # 어디에도 안 들어가면 abnormal 간주
    return 'abnormal'


def _fallback_status(metric: str, value: float, gender: str = 'M') -> str:
    """ItemReferences 없을 때 수치 기반 간이 판정."""
    thresholds = {
        'BMI': (18.5, 25.0, 30.0),
        '혈당': (70, 100, 126),
        '혈압 (수축기)': (90, 120, 140),
        '혈압 (이완기)': (60, 80, 90),
        '총콜레스테롤': (0, 200, 240),
        'LDL 콜레스테롤': (0, 130, 160),
        'HDL 콜레스테롤': None,  # 역방향
        '중성지방': (0, 150, 200),
    }
    t = thresholds.get(metric)
    if t is None:
        if metric == 'HDL 콜레스테롤':
            if value < 40:
                return 'abnormal'
            if value < 60:
                return 'warning'
            return 'normal'
        return 'normal'

    low, warn, high = t
    if value >= high:
        return 'abnormal'
    if value >= warn:
        return 'warning'
    return 'normal'


def _is_in_range(value: float, range_str: str, gender: str = 'M') -> bool:
    """FE isInRange/checkRange의 범위 체크."""
    if not range_str:
        return False

    # 성별 구분 (남:..../여:....)
    if '/' in range_str:
        parts = range_str.split('/')
        target = parts[0] if gender == 'M' else (parts[1] if len(parts) > 1 else parts[0])
        target = re.sub(r'^남:|^여:', '', target).strip()
        return _check_range(value, target)

    return _check_range(value, range_str)


def _check_range(value: float, range_str: str) -> bool:
    """수치 범위 문자열 파싱 ('100미만', '100~200', '100이상' 등)."""
    # "N미만"
    m = re.search(r'(\d+(?:\.\d+)?)미만', range_str)
    if m:
        return value < float(m.group(1))

    # "N이상"
    m = re.search(r'(\d+(?:\.\d+)?)이상', range_str)
    if m:
        return value >= float(m.group(1))

    # "A~B" 또는 "A-B"
    m = re.search(r'(\d+(?:\.\d+)?)\s*[~\-]\s*(\d+(?:\.\d+)?)', range_str)
    if m:
        lo, hi = float(m.group(1)), float(m.group(2))
        return lo <= value <= hi

    return False


def _extract_medication_concerns(
    prescription_data: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """처방전에서 만성질환 관련 약물 기반 concern 추출."""
    concerns = []
    chronic_keywords = {
        '혈압': '고혈압 관련 약물 복용',
        '당뇨': '당뇨 관련 약물 복용',
        '콜레스테롤': '이상지질혈증 관련 약물 복용',
        '갑상선': '갑상선 관련 약물 복용',
    }

    for rx in prescription_data:
        rx_str = str(rx).lower()
        for keyword, desc in chronic_keywords.items():
            if keyword in rx_str:
                concerns.append({
                    'type': 'medication',
                    'id': f"auto-med-{keyword}",
                    'name': desc,
                    'status': 'warning',
                })
                break  # 한 처방에서 하나만

    return concerns


# ── mdx_agr_list 평탄 컬럼용 ─────────────────────────────────

# 컬럼명 → (지표명, 단위, warning, abnormal)
_FLAT_THRESHOLDS = {
    'bmi':         ('BMI',            'kg/m²', 25.0, 30.0),
    'bphigh':      ('혈압 (수축기)',   'mmHg',  120.0, 140.0),
    'bplwst':      ('혈압 (이완기)',   'mmHg',  80.0, 90.0),
    'blds':        ('혈당',           'mg/dL', 100.0, 126.0),
    'hdlchole':    ('HDL 콜레스테롤', 'mg/dL', None, None),  # 역방향
    'ldlchole':    ('LDL 콜레스테롤', 'mg/dL', 130.0, 160.0),
    'triglyceride': ('중성지방',       'mg/dL', 150.0, 200.0),
    'gfr':         ('GFR',           'mL/min', None, None),  # 역방향
}


def auto_extract_concerns_from_flat(row: Dict[str, Any]) -> List[Dict[str, Any]]:
    """mdx_agr_list 행에서 직접 concerns 추출 (Tilko raw_data 없이).

    Args:
        row: mdx_agr_list 레코드 (bmi, bphigh, blds 등 평탄 컬럼)

    Returns:
        ConcernItem 리스트
    """
    concerns: List[Dict[str, Any]] = []

    for col, (metric, unit, warn_th, abnormal_th) in _FLAT_THRESHOLDS.items():
        val = row.get(col)
        if val is None:
            continue
        try:
            v = float(val)
        except (ValueError, TypeError):
            continue
        if v <= 0:
            continue

        # HDL: 낮을수록 위험 (역방향)
        if col == 'hdlchole':
            if v < 40:
                status = 'abnormal'
            elif v < 60:
                status = 'warning'
            else:
                continue
        # GFR: 낮을수록 위험 (역방향)
        elif col == 'gfr':
            if v < 60:
                status = 'abnormal'
            elif v < 90:
                status = 'warning'
            else:
                continue
        # 일반: 높을수록 위험
        else:
            if abnormal_th and v >= abnormal_th:
                status = 'abnormal'
            elif warn_th and v >= warn_th:
                status = 'warning'
            else:
                continue

        concerns.append({
            'type': 'checkup',
            'id': f"flat-{col}",
            'name': metric,
            'value': v,
            'unit': unit,
            'status': status,
        })

    logger.info(f"[auto_concerns_flat] 추출 완료: {len(concerns)}개")
    return concerns
