"""
mediArc Health Report Engine - Phase G: 영양성분 추천/주의 룰

4명 실제 데이터 검증 완료:
  - 윤철주 (질환 6개+): 오메가3(신장) + CoQ10(혈압) + 포스콜리(체중)
  - 김광중 (질환 6개+, ALT=54): 밀크씨슬(간) + 오메가3(신장) + CoQ10(혈압)
  - 안주옥 (대사만 이상): 비타민B + 생균제제 + 오메가3(혈압)
  - 이강복 (전부 정상): 비타민B + 생균제제 + 오메가3(콜레스테롤)
"""

from typing import Any

# ---------------------------------------------------------------------------
# 고정 설명문
# ---------------------------------------------------------------------------
NUTRIENT_DESC: dict[str, Any] = {
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
# 오메가3 태그 결정
# ---------------------------------------------------------------------------
def _omega3_tag(patient: dict, disease_results: dict) -> str:
    """오메가3의 태그를 조건별로 결정한다."""
    # HTN 위험 (식약처 미인정 "신장 건강" 제거 → 혈행 개선으로 통합)
    htn_or_hx = disease_results.get("고혈압", {}).get("result", "") == "이상"
    sbp = patient.get("SBP", 0)
    if htn_or_hx or sbp >= 130:
        return "혈압 관리"

    # 이상지질혈증
    tc = patient.get("TC", 0)
    ldl = patient.get("LDL", 0)
    if tc >= 200 or ldl >= 130:
        return "콜레스테롤 개선"

    return "혈행 개선"


def _omega3_desc(tag: str) -> str:
    descs = NUTRIENT_DESC["오메가3"]
    return descs.get(tag, descs["혈행 개선"])


# ---------------------------------------------------------------------------
# 추천 영양성분
# ---------------------------------------------------------------------------
def recommend_nutrients(patient: dict, disease_results: dict) -> list[dict]:
    """
    환자 정보와 질환 평가 결과를 받아 추천 영양성분 3종을 반환한다.

    Args:
        patient: 검진 수치 딕셔너리
            - ALT, SBP, DBP, BMI, creatinine, TC, LDL, FBG 등
        disease_results: 질환별 평가 결과
            - e.g. {"고혈압": {"result": "이상"}, "당뇨": {"result": "정상"}, ...}

    Returns:
        [{"name": str, "tag": str, "desc": str}, ...] (3개)
    """
    # 질환 중 "이상" 또는 "유질환자" 개수 (B3 수정: 유질환자도 위험군에 포함)
    abnormal_count = sum(
        1 for v in disease_results.values()
        if isinstance(v, dict) and v.get("result") in ("이상", "유질환자")
    )

    recommendations: list[dict] = []

    if abnormal_count >= 3:
        # --- 질환 3개 이상: 타겟 3종 ---
        alt = patient.get("ALT", 0)
        sbp = patient.get("SBP", 0)
        bmi = patient.get("BMI", 0)
        htn_abnormal = disease_results.get("고혈압", {}).get("result", "") == "이상"

        # 우선순위대로 채움 (최대 3슬롯)
        if alt > 40 and len(recommendations) < 3:
            recommendations.append({
                "name": "밀크씨슬",
                "tag": "간 건강",
                "desc": NUTRIENT_DESC["밀크씨슬"],
            })

        # 오메가3는 항상 포함 (남은 슬롯에)
        omega_tag = _omega3_tag(patient, disease_results)
        if len(recommendations) < 3:
            recommendations.append({
                "name": "오메가3",
                "tag": omega_tag,
                "desc": _omega3_desc(omega_tag),
            })

        if (htn_abnormal or sbp >= 130) and len(recommendations) < 3:
            recommendations.append({
                "name": "코엔자임Q10",
                "tag": "혈압 관리",
                "desc": NUTRIENT_DESC["코엔자임Q10"],
            })

        if bmi >= 28 and len(recommendations) < 3:
            recommendations.append({
                "name": "콜레우스 포스콜리",
                "tag": "체중 관리",
                "desc": NUTRIENT_DESC["콜레우스 포스콜리"],
            })

        # 슬롯이 아직 남으면 fallback 순서대로 채움 (A4 버그 수정)
        existing_names = {r["name"] for r in recommendations}
        fallback_order = [
            ("코엔자임Q10", "항산화", NUTRIENT_DESC["코엔자임Q10"]),
            ("콜레우스 포스콜리", "체중 관리", NUTRIENT_DESC["콜레우스 포스콜리"]),
            ("비타민B", "기본 영양", NUTRIENT_DESC["비타민B"]),
            ("생균제제", "장 건강", NUTRIENT_DESC["생균제제"]),
        ]
        for fb_name, fb_tag, fb_desc in fallback_order:
            if len(recommendations) >= 3:
                break
            if fb_name not in existing_names:
                recommendations.append({"name": fb_name, "tag": fb_tag, "desc": fb_desc})
                existing_names.add(fb_name)

    else:
        # --- 질환 0~2개: 기본 2종 + 타겟 1종 ---
        recommendations.append({
            "name": "비타민B",
            "tag": "기본 영양",
            "desc": NUTRIENT_DESC["비타민B"],
        })
        recommendations.append({
            "name": "생균제제",
            "tag": "장 건강",
            "desc": NUTRIENT_DESC["생균제제"],
        })

        omega_tag = _omega3_tag(patient, disease_results)
        recommendations.append({
            "name": "오메가3",
            "tag": omega_tag,
            "desc": _omega3_desc(omega_tag),
        })

    return recommendations[:3]


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

    # --- 공통: 신장 관련 (거의 모든 사람) ---
    _add("검진항목 - 신장", "엠에스엠(MSM)")
    _add("검진항목 - 신장", "라이신")
    _add("검진항목 - 신장", "크랜베리추출물")
    _add("검진항목 - 신장", "마그네슘")

    # 신장 추가 (조건부 — creatinine 높으면)
    creatinine = patient.get("creatinine", 0)
    if creatinine > 1.0:
        _add("검진항목 - 신장", "프로폴리스")
        _add("검진항목 - 신장", "비타민C")

    # --- 조건부 ---
    fbg = patient.get("FBG", 0)
    if fbg >= 100:
        _add("당뇨위험군", "글루코사민")

    alt = patient.get("ALT", 0)
    if alt > 40:
        _add("검진항목 - 간", "크롬")
        _add("검진항목 - 간", "마그네슘")

    tc = patient.get("TC", 0)
    ldl = patient.get("LDL", 0)
    if tc >= 200 or ldl >= 130:
        _add("이상지질혈증", "칼슘")

    sbp = patient.get("SBP", 0)
    sex = patient.get("sex", "M")
    if sbp >= 140 and sex == "F":
        _add("고혈압", "여성용 멀티비타민")

    return cautions[:6]


# ---------------------------------------------------------------------------
# 셀프 테스트 (python nutrition_rules.py)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # 윤철주: 질환 6개+, BMI>=28, SBP>=130, creatinine>1.0
    p1 = {"ALT": 30, "SBP": 145, "BMI": 29, "creatinine": 1.2, "TC": 180, "LDL": 120, "FBG": 110, "sex": "M"}
    d1 = {k: {"result": "이상"} for k in ["고혈압", "당뇨", "대사증후군", "만성신장병", "심혈관질환", "뇌혈관질환"]}
    r1 = recommend_nutrients(p1, d1)
    print("윤철주 추천:", [(x["name"], x["tag"]) for x in r1])

    # 김광중: 질환 6개+, ALT=54
    p2 = {"ALT": 54, "SBP": 138, "BMI": 26, "creatinine": 1.3, "TC": 190, "LDL": 125, "FBG": 115, "sex": "M"}
    d2 = {k: {"result": "이상"} for k in ["고혈압", "당뇨", "대사증후군", "만성신장병", "심혈관질환", "뇌혈관질환"]}
    r2 = recommend_nutrients(p2, d2)
    print("김광중 추천:", [(x["name"], x["tag"]) for x in r2])

    # 안주옥: 대사만 이상, htn_or_hx
    p3 = {"ALT": 20, "SBP": 135, "BMI": 24, "creatinine": 0.8, "TC": 180, "LDL": 110, "FBG": 90, "sex": "F"}
    d3 = {"대사증후군": {"result": "이상"}, "고혈압": {"result": "이상"}}
    r3 = recommend_nutrients(p3, d3)
    print("안주옥 추천:", [(x["name"], x["tag"]) for x in r3])

    # 이강복: 전부 정상, TC>=200
    p4 = {"ALT": 18, "SBP": 118, "BMI": 23, "creatinine": 0.9, "TC": 210, "LDL": 135, "FBG": 85, "sex": "M"}
    d4 = {"고혈압": {"result": "정상"}, "당뇨": {"result": "정상"}}
    r4 = recommend_nutrients(p4, d4)
    print("이강복 추천:", [(x["name"], x["tag"]) for x in r4])

    print()
    print("윤철주 주의:", [(x["name"], x["tag"]) for x in caution_nutrients(p1, d1)])
    print("김광중 주의:", [(x["name"], x["tag"]) for x in caution_nutrients(p2, d2)])
    print("안주옥 주의:", [(x["name"], x["tag"]) for x in caution_nutrients(p3, d3)])
    print("이강복 주의:", [(x["name"], x["tag"]) for x in caution_nutrients(p4, d4)])
