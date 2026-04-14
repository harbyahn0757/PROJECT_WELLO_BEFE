"""
adapter.py — 3소스(chat/campaign/welno) 검진수치 → engine.py patient dict 변환.

주요 함수:
    to_engine_input(source, health_data, patient_info) -> dict
        _normalize_health_metrics() 출력 + patient_info → engine.run_for_patient 입력 dict

    infer_group(age, sex) -> str
        엔진의 5세 단위 연령군 문자열 반환 (engine.get_age_sex_group 래퍼)

    adapt_report_to_fe_schema(engine_output) -> dict
        run_for_patient 원본 출력 → FE ReportData 필드명 정리

NOTE:
    - services/mediarc/ 는 import 금지 (독립 계산 계층)
    - welno_mediarc_reports 테이블에 write 하는 코드 없음
    - 가족력/과거력 필드는 3소스에 없으므로 전부 False 고정 (TODO 표시)
"""

import logging
from datetime import date
from typing import Optional

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# 키 매핑 테이블 (_normalize_health_metrics 출력 → engine 기대 키)
# spec 4.5 표 기반
# ──────────────────────────────────────────────────────────────────────────────

_KEY_MAP: dict = {
    "bp_high":         "sbp",
    "bp_low":          "dbp",
    "fasting_glucose": "fbg",
    "total_chol":      "tc",
    "sgot":            "ast",
    "sgpt":            "alt",
    "creatinine":      "cr",
    # 동일 키 (변환 불필요 — 안전하게 명시)
    "hdl": "hdl",
    "ldl": "ldl",
    "tg":  "tg",
    "ggt": "ggt",
    "gfr": "gfr",
    "hemoglobin": "hemoglobin",
    "height": "height",
    "weight": "weight",
    "waist":  "waist",
    "bmi":    "bmi",
}

# 엔진이 사용하지만 3소스에 없는 설문 기반 필드 → False 고정
# TODO: 향후 문진에 가족력/과거력 수집 시 이 목록에서 제거
_MISSING_BOOL_FIELDS = (
    "hx_htn", "hx_dm", "hx_cvd", "hx_stroke",
    "hx_cancer_liver", "hx_cancer_lung", "hx_cancer_colon",
    "family_dm", "family_cvd",
    "family_cancer_liver", "family_cancer_lung", "family_cancer_colon",
    "smoking", "ex_smoking",
)


# ──────────────────────────────────────────────────────────────────────────────
# 내부 헬퍼
# ──────────────────────────────────────────────────────────────────────────────

def _normalize_sex(raw_sex: Optional[str], source: str) -> str:
    """소스별 성별 값을 'M'/'F' 표준화.

    - welno/chat: 'M'/'F' 또는 '남'/'여'
    - campaign:   '1'→M, '2'→F (spec 6.3)
    알 수 없으면 'M' 기본값 + WARNING 로그.
    """
    if raw_sex is None:
        logger.warning("adapter: sex 없음 (source=%s) — 'M' 기본값 사용", source)
        return "M"
    s = str(raw_sex).strip()
    if s in ("M", "m", "남", "male", "Male"):
        return "M"
    if s in ("F", "f", "여", "female", "Female"):
        return "F"
    if source == "campaign":
        if s == "1":
            return "M"
        if s == "2":
            return "F"
    logger.warning("adapter: 알 수 없는 sex=%r (source=%s) — 'M' 기본값 사용", raw_sex, source)
    return "M"


def _calc_age(birth_date_raw: Optional[str], source: str) -> Optional[int]:
    """birth_date 문자열 → 만 나이 int.

    지원 형식:
      - 'YYYY-MM-DD'  (welno, chat)
      - 'YYYYMMDD'    (8자리)
      - 'YYMMDD'      (6자리, campaign) — 30년 기준으로 세기 추정
    실패 시 None 반환.
    """
    if not birth_date_raw:
        return None
    s = str(birth_date_raw).strip().replace("-", "")
    try:
        if len(s) == 8:  # YYYYMMDD
            bd = date(int(s[:4]), int(s[4:6]), int(s[6:8]))
        elif len(s) == 6:  # YYMMDD (campaign)
            yy = int(s[:2])
            mm = int(s[2:4])
            dd = int(s[4:6])
            # 30년 기준: yy<=30 → 2000s, yy>30 → 1900s
            yyyy = 2000 + yy if yy <= 30 else 1900 + yy
            bd = date(yyyy, mm, dd)
        else:
            return None
        today = date.today()
        age = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
        return age if 0 < age < 130 else None
    except Exception as e:
        logger.warning("adapter: birth_date 파싱 실패 birth=%r source=%s — %s", birth_date_raw, source, e)
        return None


# ──────────────────────────────────────────────────────────────────────────────
# 공개 API
# ──────────────────────────────────────────────────────────────────────────────

def to_engine_input(source: str, health_data: dict, patient_info: dict) -> dict:
    """3소스 정규화 수치 + 환자 기본정보 → engine.run_for_patient 입력 dict.

    Args:
        source:       'chat' | 'campaign' | 'welno'
        health_data:  _normalize_health_metrics() 출력
                      (bp_high, bp_low, fasting_glucose, total_chol, ... 등)
        patient_info: {'birth_date': str, 'sex': str, 'name': str, ...}

    Returns:
        engine.run_for_patient(name, patient_dict) 호출용 dict.
        _name 키에 name 포함 (facade에서 pop 처리).
    """
    result: dict = {}

    # 1. 키 이름 변환
    for norm_key, engine_key in _KEY_MAP.items():
        v = health_data.get(norm_key)
        if v is not None:
            try:
                result[engine_key] = float(v)
            except (TypeError, ValueError):
                pass  # None/알 수 없는 값은 제외 (엔진이 impute_missing 처리)

    # 2. age / sex
    age = _calc_age(patient_info.get("birth_date"), source)
    if age is None:
        # birth_date 없으면 age 필드 직접 확인
        raw_age = patient_info.get("age")
        if raw_age is not None:
            try:
                age = int(float(raw_age))
            except (TypeError, ValueError):
                pass
    if age is None:
        logger.warning("adapter: age 계산 불가 (source=%s) — engine 호출 불가", source)
        raise ValueError(f"age 계산 불가: source={source}, patient_info={patient_info!r}")

    sex = _normalize_sex(patient_info.get("sex") or patient_info.get("gender"), source)
    result["age"] = age
    result["sex"] = sex

    # 3. 설문 기반 누락 필드 → False 고정
    # TODO: 문진 항목에 가족력/과거력 추가 시 patient_info에서 읽도록 수정
    for field_name in _MISSING_BOOL_FIELDS:
        result.setdefault(field_name, False)

    # 4. _name 메타 (facade에서 pop)
    result["_name"] = str(patient_info.get("name") or "익명")

    return result


def to_engine_patient(health_data: dict, age: int, sex: str) -> dict:
    """partner_office.py 호출용 — 이미 추출된 age/sex + health_data → engine patient dict.

    Args:
        health_data: _normalize_health_metrics() 또는 동등 dict
                     (bp_high, bp_low, fasting_glucose, total_chol, hdl, ldl, tg, ...)
        age:  만 나이 (partner_office.py에서 계산 후 전달)
        sex:  'M' | 'F' (partner_office.py에서 정규화 후 전달)

    Returns:
        engine.run_for_patient / EngineFacade.run 호출용 patient dict.
        _name 키 미포함 (run() 호출 시 name 파라미터로 별도 전달).
    """
    result: dict = {}

    # 키 이름 변환 (to_engine_input과 동일 맵 재사용)
    for norm_key, engine_key in _KEY_MAP.items():
        v = health_data.get(norm_key)
        if v is not None:
            try:
                result[engine_key] = float(v)
            except (TypeError, ValueError):
                pass

    result["age"] = age
    result["sex"] = _normalize_sex(sex, "partner_office")

    # 설문 기반 누락 필드 → False 고정
    for field_name in _MISSING_BOOL_FIELDS:
        result.setdefault(field_name, False)

    return result


def infer_group(age: int, sex: str) -> str:
    """엔진의 연령군 문자열 반환. engine.get_age_sex_group 래퍼.

    엔진 임포트 실패 시 간단한 폴백 로직 사용.
    """
    try:
        from .engine import get_age_sex_group
        return get_age_sex_group(age, sex)
    except (ImportError, Exception):
        # 폴백: 5세 단위 단순 라벨
        bucket = (age // 5) * 5
        return f"{sex}_{bucket}"


def adapt_report_to_fe_schema(engine_output: dict) -> dict:
    """run_for_patient 원본 → FE ReportData 형식. facade.generate_report 밖에서 필요할 때 사용."""
    age_val = engine_output.get("age", 0)
    bodyage_raw = engine_output.get("bodyage")
    delta_raw = engine_output.get("bodyage_delta")

    # diseases: 엔진 원본 키 구조 그대로 노출 + FE 호환 rate/rank 추가
    diseases_out: dict = {}
    for disease_name, d in (engine_output.get("diseases") or {}).items():
        diseases_out[disease_name] = {
            "rank": d.get("rank"),
            "rate": d.get("ratio"),
            "grade": d.get("grade"),
            "five_year": d.get("five_year"),
            "chips": d.get("chips", []),
            "individual_rr": d.get("individual_rr"),
            "cohort_mean": d.get("cohort_mean"),
        }

    return {
        "name": engine_output.get("name"),
        "age": age_val,
        "sex": engine_output.get("sex"),
        "group": engine_output.get("group"),
        "bodyage": {
            "bodyage": bodyage_raw,
            "delta": delta_raw,
        },
        "rank": engine_output.get("bodyage_rank"),
        "diseases": diseases_out,
        "gauges": engine_output.get("gauges", {}),
        "improved": engine_output.get("improved", {}),
        "disease_ages": engine_output.get("disease_ages", {}),
        "patient_info": {
            "age": age_val,
            "sex": engine_output.get("sex"),
            "group": engine_output.get("group"),
        },
    }


__all__ = [
    "to_engine_input",
    "to_engine_patient",
    "infer_group",
    "adapt_report_to_fe_schema",
]
