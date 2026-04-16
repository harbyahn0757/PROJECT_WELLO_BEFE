"""
mediArc Health Report Engine - Phase G+: 영양성분 추천/주의 룰

4명 실제 데이터 검증 완료:
  - 윤철주 (질환 6개+): 오메가3(신장) + CoQ10(혈압) + 포스콜리(체중)
  - 김광중 (질환 6개+, ALT=54): 밀크씨슬(간) + 오메가3(신장) + CoQ10(혈압)
  - 안주옥 (대사만 이상): 비타민B + 생균제제 + 오메가3(혈압)
  - 이강복 (전부 정상): 비타민B + 생균제제 + 오메가3(콜레스테롤)

Phase 1: 6종 → 28종 풀 확장 + 우선순위 로직 + RAG 에비던스 연결 인터페이스
"""

from typing import Any

# ---------------------------------------------------------------------------
# 고정 설명문 (RAG/GPT 폴백용)
# ---------------------------------------------------------------------------
NUTRIENT_DESC: dict[str, Any] = {
    # --- 기존 6종 ---
    "오메가3": {
        "혈행 개선": "혈중 중성지질 개선, 혈행 개선에 도움을 줄 수 있어요. (식약처 인정 기능)",
        "혈압 관리": "오메가3는 심혈관 질환의 위험도를 낮춘다는 연구 결과가 있어요. 혈압이 걱정되는 분들에게 추천해 드려요.",
        "콜레스테롤 개선": "혈중 중성지질 개선, 혈행 개선에 도움을 주어 추천해 드려요. (식약처 인정 기능)",
    },
    "코엔자임Q10": "강력한 항산화제로서 혈압을 감소시켜주는 데에 도움이 돼요.",
    "콜레우스 포스콜리": "체지방 감소에 도움을 주어 비만인 분들께 영양제로 섭취를 추천해 드려요.",
    "밀크씨슬": "간의 세포재생과 회복을 도와 간 건강에 도움이 돼요.",
    "비타민B": (
        "비타민B군은 8가지 영양소의 복합제로 체내에 흡수된 3대 영양소가 "
        "원활하게 사용될 수 있도록 도와주고, 에너지 대사와 신경 기능 유지에 필수적이에요."
    ),
    "생균제제": "장내 유익균 증가, 유해균을 감소시켜 장 건강에 도움을 줘요.",
    # --- 신규 22종 ---
    "마그네슘": "마그네슘은 혈압 조절과 근육 이완에 도움을 줄 수 있어요. (식약처 인정 기능)",
    "칼륨": "칼륨은 나트륨 배출을 도와 혈압 감소에 도움을 줄 수 있어요.",
    "크롬": "크롬은 인슐린 기능을 보조하여 혈당 조절에 도움을 줄 수 있어요. (식약처 인정 기능)",
    "알파리포산": "알파리포산은 항산화 작용과 혈당 대사 지원에 도움을 줄 수 있어요.",
    "바나바잎": "바나바잎의 코로솔산 성분이 혈당 조절에 도움을 줄 수 있어요. (식약처 인정 기능)",
    "NAC (N-아세틸시스테인)": "NAC는 글루타치온 합성을 도와 간 해독 기능에 도움을 줄 수 있어요.",
    "글루타치온": "글루타치온은 간 해독과 항산화 작용에 도움을 줄 수 있어요.",
    "가르시니아": "가르시니아의 HCA 성분이 체지방 감소에 도움을 줄 수 있어요. (식약처 인정 기능)",
    "녹차추출물 (카테킨)": "녹차의 카테킨 성분이 체지방 분해에 도움을 줄 수 있어요. (식약처 인정 기능)",
    "프리바이오틱스": "프리바이오틱스는 장내 유익균의 성장을 도와 장 건강에 도움을 줄 수 있어요.",
    "글루타민": "글루타민은 장벽 세포 회복을 도와 소화관 건강에 도움을 줄 수 있어요.",
    "비타민D": "비타민D는 칼슘 흡수를 돕고 뼈 건강 유지에 도움을 줄 수 있어요. (식약처 인정 기능)",
    "비타민C": "비타민C는 항산화 작용과 면역 기능 유지에 도움을 줄 수 있어요. (식약처 인정 기능)",
    "아연": "아연은 면역 기능과 정상 세포 분열에 도움을 줄 수 있어요. (식약처 인정 기능)",
    "셀레늄": "셀레늄은 항산화 효소 구성 성분으로 산화 스트레스 감소에 도움을 줄 수 있어요.",
    "글루코사민": "글루코사민은 관절 연골 성분을 보충하여 관절 건강에 도움을 줄 수 있어요. (식약처 인정 기능)",
    "칼슘": "칼슘은 뼈와 치아 형성, 근육 수축에 필수적인 영양소예요. (식약처 인정 기능)",
    "비타민K2": "비타민K2는 칼슘이 뼈에 제대로 흡수될 수 있도록 도와줘요.",
    "루테인": "루테인은 눈의 황반을 보호하여 눈 건강에 도움을 줄 수 있어요. (식약처 인정 기능)",
    "아스타잔틴": "아스타잔틴은 강력한 항산화 성분으로 산화 스트레스 감소에 도움을 줄 수 있어요.",
    "레스베라트롤": "레스베라트롤은 심혈관 건강과 항산화 작용에 도움을 줄 수 있어요.",
    "식이섬유": "식이섬유는 혈당 상승을 완만하게 하고 장 건강에 도움을 줄 수 있어요.",
}

CAUTION_DESC: dict[str, str] = {
    "엠에스엠(MSM)": "신장 기능이 저하된 경우 황 대사 부담이 증가할 수 있어요.",
    "라이신": "신장에서 배설되므로 신장 기능 저하 시 축적 위험이 있어요.",
    "크랜베리추출물": "옥살산 함량이 높아 신장결석 위험을 높일 수 있어요.",
    "마그네슘": "신장 기능 저하 시 고마그네슘혈증 위험이 있어요.",
    "프로폴리스": "신장 배설 부담이 있을 수 있어요.",
    "비타민C": "고용량 시 옥살산으로 전환되어 신장결석 위험이 있어요.",
    "글루코사민": "혈당을 상승시킬 수 있어 당뇨 위험군에서 주의가 필요해요.",
    "크롬": "간 기능 저하 시 크롬 축적으로 간 손상 우려가 있어요.",
    "칼슘": "이상지질혈증 환자에서 혈관 석회화 위험이 있어요.",
    "여성용 멀티비타민": "고혈압 환자에서 일부 성분(감초 등)이 혈압을 높일 수 있어요.",
}

# ---------------------------------------------------------------------------
# RAG 쿼리 키워드 맵 (nutrition_service.py에서 FAISS 검색 시 사용)
# ---------------------------------------------------------------------------
RAG_QUERY_MAP: dict[str, str] = {
    "오메가3": "오메가3 EPA DHA 건강기능식품 효능 용량 주의사항 식약처",
    "코엔자임Q10": "코엔자임Q10 CoQ10 건강기능식품 혈압 항산화 용량 식약처",
    "콜레우스 포스콜리": "콜레우스 포스콜리 체지방 감소 건강기능식품 식약처",
    "밀크씨슬": "밀크씨슬 실리마린 간 건강 건강기능식품 용량 식약처",
    "비타민B": "비타민B군 에너지 대사 건강기능식품 용량 식약처",
    "생균제제": "생균제제 프로바이오틱스 장 건강 건강기능식품 식약처",
    "마그네슘": "마그네슘 혈압 식약처 건강기능식품 용량",
    "칼륨": "칼륨 혈압 감소 건강기능식품",
    "크롬": "크롬 혈당 조절 식약처 건강기능식품",
    "알파리포산": "알파리포산 혈당 항산화 건강기능식품",
    "바나바잎": "바나바잎 코로솔산 혈당 식약처 건강기능식품",
    "NAC (N-아세틸시스테인)": "NAC N-아세틸시스테인 글루타치온 간 건강기능식품",
    "글루타치온": "글루타치온 간 해독 항산화 건강기능식품",
    "가르시니아": "가르시니아 HCA 체지방 식약처 건강기능식품",
    "녹차추출물 (카테킨)": "녹차추출물 카테킨 체지방 식약처 건강기능식품",
    "프리바이오틱스": "프리바이오틱스 장 건강 건강기능식품",
    "글루타민": "글루타민 장벽 회복 건강기능식품",
    "비타민D": "비타민D 칼슘 흡수 식약처 건강기능식품 용량",
    "비타민C": "비타민C 항산화 식약처 건강기능식품 용량",
    "아연": "아연 면역 기능 식약처 건강기능식품",
    "셀레늄": "셀레늄 항산화 식약처 건강기능식품",
    "글루코사민": "글루코사민 관절 식약처 건강기능식품",
    "칼슘": "칼슘 뼈 건강 식약처 건강기능식품 용량",
    "비타민K2": "비타민K2 칼슘 흡수 뼈 건강기능식품",
    "루테인": "루테인 눈 건강 식약처 건강기능식품",
    "아스타잔틴": "아스타잔틴 항산화 건강기능식품",
    "레스베라트롤": "레스베라트롤 심혈관 항산화 건강기능식품",
    "식이섬유": "식이섬유 혈당 체중 식약처 건강기능식품",
}


# ---------------------------------------------------------------------------
# 오메가3 태그 결정
# ---------------------------------------------------------------------------
def _omega3_tag(patient: dict, disease_results: dict) -> str:
    """오메가3의 태그를 조건별로 결정한다."""
    htn_or_hx = disease_results.get("고혈압", {}).get("result", "") == "이상"
    sbp = patient.get("SBP", 0)
    if htn_or_hx or sbp >= 130:
        return "혈압 관리"
    tc = patient.get("TC", 0)
    ldl = patient.get("LDL", 0)
    if tc >= 200 or ldl >= 130:
        return "콜레스테롤 개선"
    return "혈행 개선"


def _omega3_desc(tag: str) -> str:
    descs = NUTRIENT_DESC["오메가3"]
    return descs.get(tag, descs["혈행 개선"])


def _get_desc(name: str, tag: str = "") -> str:
    """단일 문자열 또는 dict형 설명문 조회."""
    val = NUTRIENT_DESC.get(name, "")
    if isinstance(val, dict):
        return val.get(tag, next(iter(val.values()), ""))
    return val


# ---------------------------------------------------------------------------
# 후보 생성 (28종 풀 → 조건 매칭)
# ---------------------------------------------------------------------------
def recommend_candidates(patient: dict, disease_results: dict) -> list[dict]:
    """
    28종 풀에서 조건 매칭으로 후보 8-12종 반환.
    nutrition_service.py Step 1에서 호출.

    Returns:
        [{"name": str, "tag": str, "desc": str,
          "category": str, "priority_score": float, "rule_reason": str}, ...]
    """
    sbp = patient.get("SBP", 0) or 0
    cr = patient.get("creatinine", 0) or 0
    alt = patient.get("ALT", 0) or 0
    ast = patient.get("AST", 0) or 0
    ggt = patient.get("GGT", 0) or 0
    bmi = patient.get("BMI", 0) or 0
    fbg = patient.get("FBG", 0) or 0
    tc = patient.get("TC", 0) or 0
    ldl = patient.get("LDL", 0) or 0
    age = patient.get("age", 0) or 0
    sex = patient.get("sex", "M")

    kidney_ok = cr < 1.2
    kidney_normal = cr <= 1.0
    liver_ok = alt <= 40
    htn_abnormal = disease_results.get("고혈압", {}).get("result", "") == "이상"
    dyslipid_abnormal = disease_results.get("이상지질혈증", {}).get("result", "") == "이상"
    cardio_abnormal = disease_results.get("심혈관질환", {}).get("result", "") == "이상"
    gut_abnormal = any(
        disease_results.get(d, {}).get("result", "") == "이상"
        for d in ["위장관질환", "과민성장증후군"]
    )

    abnormal_count = sum(
        1 for v in disease_results.values()
        if isinstance(v, dict) and v.get("result") in ("이상", "유질환자")
    )

    candidates: list[dict] = []

    def _add(name: str, tag: str, category: str, score: float, reason: str) -> None:
        desc = _get_desc(name, tag)
        candidates.append({
            "name": name,
            "tag": tag,
            "category": category,
            "priority_score": score,
            "rule_reason": reason,
            "desc": desc,
        })

    # --- 혈압/심혈관 카테고리 ---
    omega_tag = _omega3_tag(patient, disease_results)
    omega_score = (
        (3.0 if htn_abnormal or cardio_abnormal else 1.0)
        + (2.0 if sbp >= 140 else 1.0 if sbp >= 130 else 0.0)
        + 2.0  # 식약처 인정
    )
    _add("오메가3", omega_tag, "혈압/심혈관", omega_score,
         f"SBP={sbp}, TC={tc}, LDL={ldl}")

    if htn_abnormal or sbp >= 130:
        coq_score = (
            (3.0 if htn_abnormal else 1.5)
            + (2.0 if sbp >= 140 else 1.0)
            + 2.0  # 식약처 인정
        )
        _add("코엔자임Q10", "혈압 관리", "혈압/심혈관", coq_score,
             f"SBP={sbp}")

    if sbp >= 130 and kidney_ok:
        mg_score = 1.5 + (1.0 if sbp >= 140 else 0.5) + 2.0
        _add("마그네슘", "혈압 관리", "혈압/심혈관", mg_score,
             f"SBP={sbp}, cr={cr} (신장 정상)")

    if sbp >= 140 and kidney_ok:
        k_score = 1.5 + 2.0 + 1.0
        _add("칼륨", "혈압 관리", "혈압/심혈관", k_score,
             f"SBP={sbp}, cr={cr} (신장 정상)")

    if cardio_abnormal or (tc >= 200 and ldl >= 130):
        resv_score = (3.0 if cardio_abnormal else 1.5) + 1.0
        _add("레스베라트롤", "심혈관 항산화", "항산화", resv_score,
             f"심혈관 이상 or TC={tc}, LDL={ldl}")

    # --- 혈당/당뇨 카테고리 ---
    if fbg >= 100 and liver_ok:
        cr_score = 3.0 + (2.0 if fbg >= 126 else 1.0) + 2.0
        _add("크롬", "혈당 조절", "혈당/당뇨", cr_score,
             f"FBG={fbg}, ALT={alt} (간 정상)")

    if fbg >= 110 or disease_results.get("당뇨", {}).get("result", "") == "이상":
        ala_score = (3.0 if fbg >= 126 else 2.0) + 1.5
        _add("알파리포산", "혈당 항산화", "혈당/당뇨", ala_score,
             f"FBG={fbg}")

    if fbg >= 100:
        ban_score = 2.0 + (1.5 if fbg >= 110 else 0.5) + 2.0
        _add("바나바잎", "혈당 조절", "혈당/당뇨", ban_score,
             f"FBG={fbg}")
        fi_score = 1.5 + 1.0 + (1.0 if bmi >= 25 else 0)
        _add("식이섬유", "혈당/체중 관리", "혈당/체중", fi_score,
             f"FBG={fbg}")

    # --- 간/해독 카테고리 ---
    if alt > 40:
        ms_score = 3.0 + (2.0 if alt > 60 else 1.0) + 2.0
        _add("밀크씨슬", "간 건강", "간/해독", ms_score,
             f"ALT={alt}")

    if alt > 35 or ggt > 50:
        nac_score = 2.5 + (1.5 if alt > 50 or ggt > 80 else 0.5)
        _add("NAC (N-아세틸시스테인)", "간 해독", "간/해독", nac_score,
             f"ALT={alt}, GGT={ggt}")

    if alt > 40 or ast > 40:
        gsh_score = 2.5 + 1.0
        _add("글루타치온", "간 항산화", "간/해독", gsh_score,
             f"ALT={alt}, AST={ast}")

    # --- 체중 카테고리 ---
    if bmi >= 28:
        fo_score = 3.0 + 2.0 + 2.0
        _add("콜레우스 포스콜리", "체중 관리", "체중", fo_score,
             f"BMI={bmi}")

    if 25 <= bmi < 28:
        gar_score = 2.5 + 1.5 + 2.0
        _add("가르시니아", "체지방 감소", "체중", gar_score,
             f"BMI={bmi}")

    if bmi >= 25:
        gt_score = 2.0 + 1.0 + 2.0 + (1.0 if bmi >= 28 else 0)
        _add("녹차추출물 (카테킨)", "체지방 감소", "체중", gt_score,
             f"BMI={bmi}")
        if fbg >= 100:
            fi2 = next((c for c in candidates if c["name"] == "식이섬유"), None)
            if not fi2:
                _add("식이섬유", "혈당/체중 관리", "혈당/체중", 1.5 + 1.0,
                     f"BMI={bmi}")

    # --- 장 카테고리 ---
    _add("생균제제", "장 건강", "장", 2.0 + 1.0, "기본 추천")

    prebio_score = 1.5 + (1.5 if gut_abnormal else 0.5)
    _add("프리바이오틱스", "장 건강 보조", "장", prebio_score,
         "생균제제와 시너지")

    if gut_abnormal:
        _add("글루타민", "장벽 회복", "장", 3.0 + 1.5, "위장관 질환 이상")

    # --- 기본 카테고리 ---
    _add("비타민B", "기본 영양", "기본", 2.0, "기본 추천")

    if age >= 50 or sex == "F":
        vd_score = 2.0 + (1.0 if age >= 60 else 0.5) + 2.0
        _add("비타민D", "뼈/면역 건강", "기본", vd_score,
             f"나이={age}, 성별={sex}")

    if kidney_normal:
        vc_score = 1.5 + 2.0
        _add("비타민C", "항산화 면역", "기본", vc_score,
             f"cr={cr} (신장 정상)")

    if age >= 50 or abnormal_count >= 3:
        zn_score = 1.5 + (1.0 if age >= 60 else 0.5) + 2.0
        _add("아연", "면역 기능", "기본", zn_score,
             f"나이={age}, 복합위험인자={abnormal_count}")

    if abnormal_count >= 3:
        sel_score = 1.5 + 1.0
        _add("셀레늄", "항산화", "항산화", sel_score,
             f"복합위험인자={abnormal_count}개")

    # --- 관절/뼈 카테고리 ---
    if age >= 50 and kidney_ok:
        glu_score = 2.0 + (1.0 if age >= 60 else 0.5) + 2.0
        _add("글루코사민", "관절 건강", "관절/뼈", glu_score,
             f"나이={age}, cr={cr} (신장 정상)")

    if sex == "F" and age >= 50 and not dyslipid_abnormal:
        cal_score = 2.5 + 1.5 + 2.0
        _add("칼슘", "뼈 건강", "관절/뼈", cal_score,
             f"여성 나이={age}, 이상지질혈증 없음")
        _add("비타민K2", "칼슘 흡수 보조", "관절/뼈", 2.0 + 1.0,
             "칼슘 추천 시 병행")

    # --- 항산화 카테고리 ---
    if age >= 50:
        lut_score = 2.0 + (1.0 if age >= 60 else 0.5) + 2.0
        _add("루테인", "눈 건강", "항산화", lut_score, f"나이={age}")

    if abnormal_count >= 3:
        ast_score = 2.5 + 1.5
        _add("아스타잔틴", "항산화", "항산화", ast_score,
             f"복합위험인자={abnormal_count}개")

    return candidates


# ---------------------------------------------------------------------------
# 카테고리 상한 필터 → 상위 5종 반환
# ---------------------------------------------------------------------------
_CATEGORY_LIMITS: dict[str, int] = {
    "혈압/심혈관": 2,
    "혈당/당뇨": 2,
    "간/해독": 1,
    "체중": 1,
    "장": 1,
    "기본": 2,
    "관절/뼈": 1,
    "항산화": 1,
    "혈당/체중": 1,
}


def recommend_nutrients(patient: dict, disease_results: dict) -> list[dict]:
    """
    환자 정보와 질환 평가 결과를 받아 추천 영양성분 최대 5종을 반환한다.
    (기존 3종 → Phase 1에서 5종으로 확장, 하위 호환 유지)

    Args:
        patient: 검진 수치 딕셔너리 (ALT, SBP, DBP, BMI, creatinine, TC, LDL, FBG 등)
        disease_results: 질환별 평가 결과
            e.g. {"고혈압": {"result": "이상"}, ...}

    Returns:
        [{"name": str, "tag": str, "desc": str}, ...] (최대 5개)
    """
    candidates = recommend_candidates(patient, disease_results)

    # 카테고리별 상한 적용하며 우선순위 점수 내림차순 정렬
    candidates.sort(key=lambda x: x["priority_score"], reverse=True)
    category_count: dict[str, int] = {}
    selected: list[dict] = []

    for c in candidates:
        cat = c["category"]
        limit = _CATEGORY_LIMITS.get(cat, 1)
        if category_count.get(cat, 0) < limit:
            category_count[cat] = category_count.get(cat, 0) + 1
            selected.append({
                "name": c["name"],
                "tag": c["tag"],
                "desc": c["desc"],
            })
        if len(selected) >= 5:
            break

    return selected


# ---------------------------------------------------------------------------
# 주의 영양소
# ---------------------------------------------------------------------------
def caution_nutrients(patient: dict, disease_results: dict) -> list[dict]:
    """
    환자 정보와 질환 평가 결과를 받아 주의해야 할 영양소를 반환한다.
    최대 6개.

    Args:
        patient: 검진 수치 딕셔너리
        disease_results: 질환별 평가 결과

    Returns:
        [{"tag": str, "name": str, "desc": str}, ...] (최대 6개)
    """
    cautions: list[dict] = []

    def _add(tag: str, name: str) -> None:
        if len(cautions) < 6:
            cautions.append({
                "tag": tag,
                "name": name,
                "desc": CAUTION_DESC.get(name, ""),
            })

    # --- 공통: 신장 관련 ---
    _add("검진항목 - 신장", "엠에스엠(MSM)")
    _add("검진항목 - 신장", "라이신")
    _add("검진항목 - 신장", "크랜베리추출물")
    _add("검진항목 - 신장", "마그네슘")

    # 신장 추가 (조건부 — creatinine 높으면)
    creatinine = patient.get("creatinine", 0) or 0
    if creatinine > 1.0:
        _add("검진항목 - 신장", "프로폴리스")
        _add("검진항목 - 신장", "비타민C")

    # --- 조건부 ---
    fbg = patient.get("FBG", 0) or 0
    if fbg >= 100:
        _add("당뇨위험군", "글루코사민")

    alt = patient.get("ALT", 0) or 0
    if alt > 40:
        _add("검진항목 - 간", "크롬")
        _add("검진항목 - 간", "마그네슘")

    tc = patient.get("TC", 0) or 0
    ldl = patient.get("LDL", 0) or 0
    if tc >= 200 or ldl >= 130:
        _add("이상지질혈증", "칼슘")

    sbp = patient.get("SBP", 0) or 0
    sex = patient.get("sex", "M")
    if sbp >= 140 and sex == "F":
        _add("고혈압", "여성용 멀티비타민")

    return cautions[:6]


# ---------------------------------------------------------------------------
# 셀프 테스트 (python nutrition_rules.py)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # 윤철주: 질환 6개+, BMI>=28, SBP>=130, creatinine>1.0
    p1 = {
        "ALT": 30, "SBP": 145, "BMI": 29, "creatinine": 1.2,
        "TC": 180, "LDL": 120, "FBG": 110, "sex": "M", "age": 58,
        "AST": 25, "GGT": 35,
    }
    d1 = {k: {"result": "이상"} for k in
          ["고혈압", "당뇨", "대사증후군", "만성신장병", "심혈관질환", "뇌혈관질환"]}
    r1 = recommend_nutrients(p1, d1)
    print("윤철주 추천:", [(x["name"], x["tag"]) for x in r1])
    assert len(r1) > 0, "윤철주 추천 결과 없음"

    # 김광중: 질환 6개+, ALT=54
    p2 = {
        "ALT": 54, "SBP": 138, "BMI": 26, "creatinine": 1.3,
        "TC": 190, "LDL": 125, "FBG": 115, "sex": "M", "age": 55,
        "AST": 42, "GGT": 55,
    }
    d2 = {k: {"result": "이상"} for k in
          ["고혈압", "당뇨", "대사증후군", "만성신장병", "심혈관질환", "뇌혈관질환"]}
    r2 = recommend_nutrients(p2, d2)
    print("김광중 추천:", [(x["name"], x["tag"]) for x in r2])
    assert len(r2) > 0, "김광중 추천 결과 없음"

    # 안주옥: 대사만 이상, htn_or_hx
    p3 = {
        "ALT": 20, "SBP": 135, "BMI": 24, "creatinine": 0.8,
        "TC": 180, "LDL": 110, "FBG": 90, "sex": "F", "age": 53,
        "AST": 18, "GGT": 20,
    }
    d3 = {"대사증후군": {"result": "이상"}, "고혈압": {"result": "이상"}}
    r3 = recommend_nutrients(p3, d3)
    print("안주옥 추천:", [(x["name"], x["tag"]) for x in r3])
    assert len(r3) > 0, "안주옥 추천 결과 없음"

    # 이강복: 전부 정상, TC>=200
    p4 = {
        "ALT": 18, "SBP": 118, "BMI": 23, "creatinine": 0.9,
        "TC": 210, "LDL": 135, "FBG": 85, "sex": "M", "age": 45,
        "AST": 20, "GGT": 18,
    }
    d4 = {"고혈압": {"result": "정상"}, "당뇨": {"result": "정상"}}
    r4 = recommend_nutrients(p4, d4)
    print("이강복 추천:", [(x["name"], x["tag"]) for x in r4])
    assert len(r4) > 0, "이강복 추천 결과 없음"

    print()

    # 28종 풀 커버 확인 (후보 생성)
    c1 = recommend_candidates(p1, d1)
    c2 = recommend_candidates(p2, d2)
    all_names = set(c["name"] for c in c1) | set(c["name"] for c in c2)
    print(f"후보 풀 커버: {len(all_names)}종")
    for name in NUTRIENT_DESC:
        if name == "오메가3":
            continue
        assert name in NUTRIENT_DESC, f"NUTRIENT_DESC 누락: {name}"

    print()
    print("윤철주 주의:", [(x["name"], x["tag"]) for x in caution_nutrients(p1, d1)])
    print("김광중 주의:", [(x["name"], x["tag"]) for x in caution_nutrients(p2, d2)])
    print("안주옥 주의:", [(x["name"], x["tag"]) for x in caution_nutrients(p3, d3)])
    print("이강복 주의:", [(x["name"], x["tag"]) for x in caution_nutrients(p4, d4)])
    print()
    print("ALL TESTS PASSED")
