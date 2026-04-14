"""
Phase H: 참고문헌 + Phase I: 특수 항목
"""

# 투비콘 참고문헌 45건 (PDF p22~23에서 추출)
REFERENCES_45 = [
    "Kirk-Gardner R, Crossman J. Can J Cardiovasc Nurs. 1991;2(1):9-14.",
    "Korean Society of Hypertension. Korea Hypertension Fact Sheet 2021.",
    "대한고혈압학회 표준교육슬라이드",
    "Pan H et al. Eur J Epidemiol. 2020;35(5):443-454.",
    "Vlajinac H et al. Eur J Epidemiol. 1992;8(6):783-8.",
    "Kaze AD et al. J Am Heart Assoc. 2021;10(7):e016947.",
    "Woodward M et al. Int J Epidemiol. 2005;34(5):1036-45.",
    "Duran EK et al. J Am Coll Cardiol. 2020;75(17):2122-2135.",
    "Bhatt DL et al. N Engl J Med. 2019;380(1):11-22.",
    "Hunt SC et al. J Chronic Dis 1986;39:809-821.",
    "박성희 et al. J Nutr Health. 2008;41(3):232-241.",
    "KDA. Diabetes fact sheet in Korea. 2018.",
    "KDA. Clinical Practice Guidelines for Diabetes 2021 7th.",
    "Pan A et al. Circulation. 2015;132(19):1795-804.",
    "Hyun MK et al. Int J Environ Res Public Health. 2021;19(1):123.",
    "Abdullah A et al. Diabetes Res Clin Pract. 2010;89(3):309-19.",
    "Wing RR et al. Diabetes Care. 2011;34(7):1481-6.",
    "김민현 et al. Korean J Family Practice. 2020;10(1):44-52.",
    "KSoLA. Korean Guidelines for Dyslipidemia 4th ed.",
    "Kim CH et al. Metab Syndr Relat Disord. 2012;10(5):321-5.",
    "Zhou T et al. Medicine. 2019;98(20):e15581.",
    "Chen Y et al. BMJ. 2013;347:f5446.",
    "CKD Primary Care Guideline 2022.",
    "Korea Heart Failure Fact Sheet 2020.",
    "KSSO Quick Reference Guideline 2020.",
    "Lau LH et al. J Diabetes Investig. 2019;10(3):780-792.",
    "Sarwar N et al. Lancet. 2010;375(9733):2215-22.",
    "Chrysohoou C et al. QJM. 2010;103(6):413-22.",
    "Li WY et al. BMC Cancer. 2019;19(1):377.",
    "Trédaniel J et al. Int J Cancer. 1997;72(4):565-73.",
    "Deng W et al. Chem Biol Interact. 2021;336:109365.",
    "Miao ZF et al. Oncotarget. 2017;8(27):44881-44892.",
    "Yoon JM et al. World J Gastroenterol. 2013;19(6):936-45.",
    "Zhang YB et al. Br J Cancer. 2020;122(7):1085-1093.",
    "Lee YC et al. Int J Epidemiol. 2009;38(6):1497-511.",
    "Gu J et al. Zhongguo Fei Ai Za Zhi. 2010;13(3):224-9.",
    "Gandini S et al. Int J Cancer. 2008;122(1):155-164.",
    "Kiciński M et al. PLoS One. 2011;6(10):e27130.",
    "Liu X et al. Medicine. 2018;97(44):e12860.",
    "Liu X et al. Crit Rev Oncol Hematol. 2019;142:86-93.",
    "Kim CS et al. Hypertension. 2020;75(6):1439-1446.",
    "Xie et al. Aging. 2020;12(2):1545-1562.",
    "Kim SK et al. Korean J Intern Med. 2020;35(3):641-651.",
    "Kwon H et al. Sci Rep. 2019;9(1):1546.",
    "Zhao Z et al. J Int Med Res. 2012;40(6):2041-2050.",
    "Bagnardi V et al. Br J Cancer. 2015;112(3):580-93.",
    "McGee EE et al. J Natl Cancer Inst. 2019;111(12):1263-1278.",
    "Nagaraja V, Eslick GD. Aliment Pharmacol Ther. 2014;39(8):745-50.",
    "Sadeghi H et al. J Public Health. 2018;40(2):e91-e98.",
    "Akter S et al. J Epidemiol. 2017;27(12):553-561.",
    "Van Gaal LF et al. Eur Heart J Suppl. 2005;7(suppl L):L21-26.",
]

# 고혈압 목표혈압표 (대한고혈압학회)
HTN_TARGET_TABLE = [
    {"상황": "고혈압", "수축기": "140 미만", "이완기": "90 미만"},
    {"상황": "65세 이상", "수축기": "140 미만", "이완기": "90 미만"},
    {"상황": "당뇨병과 심혈관질환", "수축기": "130 미만", "이완기": "80 미만"},
    {"상황": "당뇨병", "수축기": "140 미만", "이완기": "85 미만"},
    {"상황": "심혈관질환", "수축기": "130 미만", "이완기": "80 미만"},
    {"상황": "뇌혈관질환", "수축기": "140 미만", "이완기": "90 미만"},
    {"상황": "만성신장병과 알부민뇨", "수축기": "130 미만", "이완기": "80 미만"},
    {"상황": "만성신장병", "수축기": "140 미만", "이완기": "90 미만"},
]

# CKD 5단계표
CKD_STAGES = [
    {"단계": "정상 혹은 1단계", "사구체여과율": "분당 90ml이상", "특징": "신장기능 정상"},
    {"단계": "2단계", "사구체여과율": "분당 60~89ml", "특징": "신장기능이 감소하기 시작"},
    {"단계": "3단계", "사구체여과율": "분당 30~59ml", "특징": "신장기능이 더욱 감소"},
    {"단계": "4단계", "사구체여과율": "분당 15~29ml", "특징": "생명유지에 필요한 신장의 기능을 겨우 유지"},
    {"단계": "5단계", "사구체여과율": "분당 14ml이하", "특징": "신장기능이 심각하게 손상되어 투석이나 이식 없이는 생명을 유지하기 어려움"},
]

# Phase I: 특수 텍스트 분기
def get_medication_text(patient: dict) -> str:
    """복약순응도 텍스트 (고혈압 유질환자만)"""
    if patient.get("hx_htn"):
        return "처방받은 고혈압 약제가 확인되지 않습니다."
    return ""

def get_habit_label(disease: str, has_improvement: bool, factors: dict) -> str:
    """'나쁜 습관 개선하기' vs '좋은 습관 유지하기' 분기"""
    if has_improvement:
        return "나쁜 습관 개선하기"
    return "좋은 습관 유지하기"

def get_habit_message(patient: dict, has_improvement: bool) -> str:
    """습관 개선 메시지"""
    name = patient.get("name", "")
    if has_improvement:
        actions = []
        if patient.get("smoking") == "current": actions.append("금연")
        if patient.get("drinking") in ("yes", "heavy"): actions.append("금주")
        bmi = patient.get("bmi", 0) or 0
        if bmi >= 25: actions.append("정상 체중 유지")
        action_text = ", ".join(actions)
        return f"{name}님은 생활 습관 개선이 필요합니다.\n{action_text}는 수치 개선에 도움이 됩니다."
    else:
        maintained = []
        if patient.get("smoking") == "never": maintained.append("비흡연")
        if patient.get("drinking") == "none": maintained.append("금주")
        maintained_text = ", ".join(maintained) if maintained else "현재 상태"
        return f"{name}님은 올바른 생활 습관을 가지고 있습니다.\n{maintained_text} 상태를 꾸준히 유지해주세요."

def get_cancer_grade_display(patient: dict) -> str:
    """암 건강등급 (치료중인 암 필터)"""
    cancer_history = patient.get("cancer_history", [])
    if cancer_history:
        return f"치료중인 암: {', '.join(cancer_history)} (발병 통계 지수 미제공)"
    return ""  # 빈칸


if __name__ == "__main__":
    # 테스트
    print("=== Phase H: 참고문헌 ===")
    print(f"총 {len(REFERENCES_45)}건")
    print(f"첫 3건: {REFERENCES_45[:3]}")
    print()

    print("=== Phase I: 특수 항목 ===")
    # 윤철주 (유질환자)
    p_yun = {"name": "윤철주", "hx_htn": True, "smoking": "current", "drinking": "yes", "bmi": 28.73}
    print(f"복약순응도: {get_medication_text(p_yun)}")
    print(f"습관 라벨: {get_habit_label('고혈압', True, {})}")
    print(f"습관 메시지: {get_habit_message(p_yun, True)}")
    print()

    # 이강복 (정상)
    p_lee = {"name": "이강복", "hx_htn": False, "smoking": "never", "drinking": "yes", "bmi": 18.83}
    print(f"복약순응도: '{get_medication_text(p_lee)}'")
    print(f"습관 라벨 (개선O): {get_habit_label('담낭암', True, {})}")
    print(f"습관 라벨 (개선X): {get_habit_label('폐암', False, {})}")
    print(f"습관 메시지: {get_habit_message(p_lee, False)}")
