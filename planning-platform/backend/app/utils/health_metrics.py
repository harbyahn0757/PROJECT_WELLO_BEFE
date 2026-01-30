"""
건강 지표 관련 공통 유틸리티

WELNO 프로젝트 전체에서 사용하는 건강 지표 필드 목록 및 계산 함수를 제공합니다.
"""

from typing import Dict, Any

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
