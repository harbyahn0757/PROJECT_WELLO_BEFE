"""
검진설계 문진 응답을 Mediarc 코드로 변환하는 매퍼
=======================================================

이 파일은 검진설계에서 수집한 문진 응답을 Mediarc API가 요구하는 코드 형식으로
변환합니다. 상수 기반 매핑을 사용하여 유지보수성을 높이고, 향후 확장 가능하도록
함수를 구조화했습니다.

## 주요 함수

1. `map_checkup_design_survey_to_mediarc()`: 
   - 검진설계 문진 전체를 Mediarc 코드로 변환
   - 상수 파일 (questionnaire_constants.py) 기반 매핑

2. `_map_family_history()`:
   - 가족력 배열 변환 (복수 선택 처리)

3. `_map_personal_history()`:
   - 본인 질환 배열 변환 (현재 미수집)

## 사용 예시

```python
# 검진설계에서 수집한 문진 데이터
survey_responses = {
    "smoking": "current_smoker",
    "drinking": "weekly_1_2",
    "family_history": ["heart_disease", "diabetes"]
}

# Mediarc 코드로 변환
codes = map_checkup_design_survey_to_mediarc(survey_responses)
# 결과:
# {
#     "smoke": "SMK0003",
#     "drink": "DRK0002",
#     "family": ["FH0006", "FH0004"],
#     "disease": ["DIS0001"],  # 기본값
#     "cancer": ["CNR0001"]    # 기본값
# }
```

## 변환 흐름

```
검진설계 문진 (survey_responses)
  ↓
questionnaire_constants.py (매핑 상수)
  ↓
questionnaire_mapper.py (변환 함수)
  ↓
Mediarc 코드 (twobecon_data.drink/smoke/family/disease/cancer)
  ↓
Mediarc API 호출
```
"""

from typing import Dict, Any, List, Optional
import logging
from .questionnaire_constants import (
    SMOKING_MAP,
    DRINKING_MAP,
    FAMILY_HISTORY_MAP,
    PERSONAL_HISTORY_MAP,
    CANCER_HISTORY_MAP,
    DEFAULT_CODES
)

logger = logging.getLogger(__name__)


def map_checkup_design_survey_to_mediarc(survey_responses: Dict[str, Any]) -> Dict[str, Any]:
    """
    검진설계 문진 응답을 Mediarc 코드로 변환 (상수 기반)
    
    ## 입력 형식 (검진설계 survey_responses)
    ```json
    {
        "smoking": "current_smoker",           // 필수: 흡연 여부
        "drinking": "weekly_1_2",              // 필수: 음주 빈도
        "family_history": ["heart_disease", "diabetes"],  // 필수: 가족력 (배열)
        "personal_history": ["hypertension"],  // 선택: 본인 질환 (현재 미수집)
        "cancer_history": ["none"],            // 선택: 본인 암 (현재 미수집)
        
        // 아래는 Mediarc 미사용 (검진설계/페르소나 전용)
        "exercise_frequency": "sometimes",
        "sleep_hours": "6_7",
        "daily_routine": ["physical_job"],
        "weight_change": "decrease_bad",
        "additional_concerns": "..."
    }
    ```
    
    ## 출력 형식 (Mediarc twobecon_data)
    ```json
    {
        "smoke": "SMK0003",        // 현재흡연
        "drink": "DRK0002",        // 주 1-2회
        "family": ["FH0006", "FH0004"],  // 심혈관질환, 당뇨
        "disease": ["DIS0001"],    // 없음 (기본값)
        "cancer": ["CNR0001"]      // 없음 (기본값)
    }
    ```
    
    Args:
        survey_responses: 검진설계 문진 응답 데이터 (DB의 survey_responses 컬럼)
        
    Returns:
        Mediarc 코드 형식 데이터 (generate_mediarc_report_async의 questionnaire_data 인자)
    
    Raises:
        None: 에러 발생 시 기본값 사용 (안정성 우선)
    """
    
    codes = {}
    
    # -------------------------------------------------------------------------
    # 1. 흡연 코드 변환
    # -------------------------------------------------------------------------
    # 검진설계 키: "smoking"
    # 값: non_smoker, ex_smoker, current_smoker
    # 매핑 정확도: 100%
    # -------------------------------------------------------------------------
    smoking = survey_responses.get("smoking")
    if smoking and smoking in SMOKING_MAP:
        codes["smoke"] = SMOKING_MAP[smoking]
    else:
        codes["smoke"] = DEFAULT_CODES["smoke"]  # SMK0001 (비흡연)
        logger.warning(f"⚠️ [문진매핑] 흡연 데이터 없음 → 기본값 사용: {codes['smoke']}")
    
    # -------------------------------------------------------------------------
    # 2. 음주 코드 변환
    # -------------------------------------------------------------------------
    # 검진설계 키: "drinking"
    # 값: never, monthly_less, monthly_1_2, weekly_1_2, weekly_3plus
    # 매핑 정확도: ~80% (월 단위를 주 단위로 근사)
    # -------------------------------------------------------------------------
    drinking = survey_responses.get("drinking")
    if drinking and drinking in DRINKING_MAP:
        codes["drink"] = DRINKING_MAP[drinking]
    else:
        codes["drink"] = DEFAULT_CODES["drink"]  # DRK0001 (안마심)
        logger.warning(f"⚠️ [문진매핑] 음주 데이터 없음 → 기본값 사용: {codes['drink']}")
    
    # -------------------------------------------------------------------------
    # 3. 가족력 코드 변환 (복수 선택)
    # -------------------------------------------------------------------------
    # 검진설계 키: "family_history"
    # 값: 배열 ["cancer", "stroke", "heart_disease", "diabetes", "hypertension", "none"]
    # 매핑 정확도: ~60% (일반 "암"을 대장암으로 임시 매핑)
    # 
    # 특수 처리:
    # - "none" 포함 시: ["FH0001"]만 반환
    # - 빈 배열: ["FH0001"] 반환
    # - 복수 선택: 각각 변환 후 배열로 반환
    # -------------------------------------------------------------------------
    family_history = survey_responses.get("family_history", [])
    codes["family"] = _map_family_history(family_history)
    
    # -------------------------------------------------------------------------
    # 4. 본인 질환 코드 변환 (복수 선택)
    # -------------------------------------------------------------------------
    # 검진설계 키: "personal_history" (현재 미수집!)
    # 값: 배열 ["cancer", "stroke", "heart_disease", "hypertension", "diabetes", "none"]
    # 매핑 정확도: N/A (데이터 없음)
    # 
    # 현재 상태:
    # - 프론트엔드 코드에는 정의되어 있으나 실제 수집 안 함
    # - DB 통계: 0/16건
    # - 대응: 기본값 (DIS0001: 없음) 사용
    # -------------------------------------------------------------------------
    personal_history = survey_responses.get("personal_history", [])
    codes["disease"] = _map_personal_history(personal_history)
    
    # -------------------------------------------------------------------------
    # 5. 본인 암 이력 코드 변환 (복수 선택)
    # -------------------------------------------------------------------------
    # 검진설계 키: "cancer_history" (현재 미수집!)
    # 값: 배열 (세부 암 종류)
    # 매핑 정확도: N/A (데이터 없음)
    # 
    # 현재 상태:
    # - 가족력에 일반 "암"은 있으나 본인 암 이력은 미수집
    # - 대응: 기본값 (CNR0001: 없음) 사용
    # -------------------------------------------------------------------------
    cancer_history = survey_responses.get("cancer_history", [])
    codes["cancer"] = _map_cancer_history(cancer_history)
    
    # 로그 출력
    logger.info(f"✅ [문진매핑] 검진설계 문진 → Mediarc 코드 변환 완료")
    logger.info(f"   - smoke: {codes['smoke']} (흡연)")
    logger.info(f"   - drink: {codes['drink']} (음주)")
    logger.info(f"   - family: {codes['family']} (가족력 {len(codes['family'])}개)")
    logger.info(f"   - disease: {codes['disease']} (본인 질환)")
    logger.info(f"   - cancer: {codes['cancer']} (본인 암)")
    
    return codes


def _map_family_history(values: List[str]) -> List[str]:
    """
    가족력 배열 변환 (복수 선택 처리)
    
    Args:
        values: 검진설계 가족력 배열
            예: ["heart_disease", "diabetes"]
    
    Returns:
        Mediarc 가족력 코드 배열
            예: ["FH0006", "FH0004"]
    
    처리 규칙:
    1. "none" 포함 시: ["FH0001"]만 반환
    2. 빈 배열: ["FH0001"] 반환 (없음)
    3. 복수 선택: 각각 변환 후 배열로 반환
    4. 매핑 안 되는 값: 제외 (로그 경고)
    """
    if not values or len(values) == 0:
        return DEFAULT_CODES["family"]  # ["FH0001"]
    
    # "none"이 포함되어 있으면 다른 값 무시
    if "none" in values:
        return ["FH0001"]
    
    # 각 값을 Mediarc 코드로 변환
    mapped = []
    for item in values:
        if item in FAMILY_HISTORY_MAP:
            code = FAMILY_HISTORY_MAP[item]
            if code not in mapped:  # 중복 제거
                mapped.append(code)
        else:
            logger.warning(f"⚠️ [문진매핑] 알 수 없는 가족력: {item}")
    
    # 매핑 결과가 없으면 기본값
    if not mapped:
        logger.warning(f"⚠️ [문진매핑] 가족력 매핑 실패 → 기본값 사용")
        return DEFAULT_CODES["family"]
    
    return mapped


def _map_personal_history(values: List[str]) -> List[str]:
    """
    본인 질환 이력 배열 변환
    
    Args:
        values: 검진설계 본인 질환 배열
            예: ["hypertension", "diabetes"]
    
    Returns:
        Mediarc 질환 코드 배열
            예: ["DIS0004", "DIS0010"]
    
    현재 상태:
    - 검진설계에서 수집하지 않음 (DB 통계: 0/16건)
    - 항상 기본값 ["DIS0001"] 반환
    
    향후 개선:
    - 프론트엔드에서 personal_history 질문 활성화 시 사용 가능
    """
    if not values or len(values) == 0:
        return DEFAULT_CODES["disease"]  # ["DIS0001"]
    
    # "none"이 포함되어 있으면 다른 값 무시
    if "none" in values:
        return ["DIS0001"]
    
    # 각 값을 Mediarc 코드로 변환
    mapped = []
    for item in values:
        if item in PERSONAL_HISTORY_MAP:
            code = PERSONAL_HISTORY_MAP[item]
            if code not in mapped:
                mapped.append(code)
        else:
            logger.warning(f"⚠️ [문진매핑] 알 수 없는 질환: {item}")
    
    if not mapped:
        return DEFAULT_CODES["disease"]
    
    return mapped


def _map_cancer_history(values: List[str]) -> List[str]:
    """
    본인 암 이력 배열 변환
    
    Args:
        values: 검진설계 본인 암 이력 배열
            예: ["stomach", "liver"]
    
    Returns:
        Mediarc 암 코드 배열
            예: ["CNR0007", "CNR0002"]
    
    현재 상태:
    - 검진설계에서 수집하지 않음
    - 항상 기본값 ["CNR0001"] 반환
    
    향후 개선:
    - 프론트엔드에서 cancer_history 질문 추가 시 사용 가능
    """
    if not values or len(values) == 0:
        return DEFAULT_CODES["cancer"]  # ["CNR0001"]
    
    if "none" in values:
        return ["CNR0001"]
    
    mapped = []
    for item in values:
        if item in CANCER_HISTORY_MAP:
            code = CANCER_HISTORY_MAP[item]
            if code not in mapped:
                mapped.append(code)
        else:
            logger.warning(f"⚠️ [문진매핑] 알 수 없는 암: {item}")
    
    if not mapped:
        return DEFAULT_CODES["cancer"]
    
    return mapped


# ============================================================================
# 레거시 호환 함수 (기존 코드 호환용)
# ============================================================================
def map_survey_to_mediarc_codes(survey_responses: Dict[str, Any]) -> Dict[str, Any]:
    """
    레거시 함수 (하위 호환성)
    
    새 코드에서는 map_checkup_design_survey_to_mediarc() 사용 권장
    """
    return map_checkup_design_survey_to_mediarc(survey_responses)
