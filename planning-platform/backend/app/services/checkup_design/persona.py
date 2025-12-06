"""
페르소나 판정 알고리즘
문진 응답을 기반으로 5가지 페르소나 유형을 판정합니다.
"""
from typing import Dict, Any, Optional


def determine_persona(survey_responses: Dict[str, Any], patient_age: int) -> Dict[str, Any]:
    """
    페르소나 판정 알고리즘 (점수 기반)
    
    우선순위:
    1. Worrier (가족력/불안형) - 가장 강력한 트리거
    2. Symptom Solver (증상해결형)
    3. Manager (만성질환 관리형)
    4. Optimizer (웰니스/활력형)
    5. Minimalist (실속형) - 기본값
    
    Args:
        survey_responses: 문진 응답 데이터
            {
                "weight_change": "decrease_bad",
                "daily_routine": "desk_job",
                "exercise_frequency": "regular",
                "smoking": "current_smoker",
                "drinking": "weekly_3plus",
                "sleep_hours": "less_5",
                "stress_level": "very_high",
                "family_history": ["cancer", "diabetes"],
                "colonoscopy_experience": "no_afraid",
                "additional_concerns": "최근 두통이 심합니다"
            }
        patient_age: 환자 나이
        
    Returns:
        {
            "primary_persona": "Worrier",
            "persona_score": {
                "Worrier": 85,
                "Symptom Solver": 40,
                "Manager": 30,
                "Optimizer": 10,
                "Minimalist": 0
            },
            "bridge_strategy": "Peace of Mind",
            "tone": "공감, 안심, 확신",
            "upselling_intensity": "very_high"
        }
    """
    # 점수 초기화
    scores = {
        "Worrier": 0,
        "Symptom Solver": 0,
        "Manager": 0,
        "Optimizer": 0,
        "Minimalist": 100  # 기본값
    }
    
    # survey_responses가 None이면 빈 딕셔너리로 처리
    survey_responses = survey_responses or {}
    
    # ==========================================
    # 1순위: Worrier (가족력) - 가장 강력한 트리거
    # ==========================================
    family_history = survey_responses.get("family_history", [])
    if family_history and "none" not in family_history:
        scores["Worrier"] = 100  # 최고 점수
        scores["Minimalist"] = 0
        
        # 가족력 종류별 가중치
        if "cancer" in family_history:
            scores["Worrier"] += 20  # 암 가족력은 더 강력
        if "stroke" in family_history or "heart_disease" in family_history:
            scores["Worrier"] += 15
    
    # ==========================================
    # 2순위: Symptom Solver (증상/문제 해결)
    # ==========================================
    
    # Q1: 의도치 않은 체중 감소 (질환 의심)
    weight_change = survey_responses.get("weight_change", "")
    if weight_change == "decrease_bad":
        scores["Symptom Solver"] += 50
        scores["Minimalist"] = 0
    
    # Q6: 심각한 수면 부족
    sleep_hours = survey_responses.get("sleep_hours", "")
    if sleep_hours == "less_5":
        scores["Symptom Solver"] += 30
        scores["Minimalist"] = 0
    
    # Q7: 스트레스 대체 (daily_routine 기반 추론)
    # mental_stress(정신적 압박) 또는 service_job(감정 소모) -> Symptom Solver 가중치
    daily_routine = survey_responses.get("daily_routine", [])
    if isinstance(daily_routine, str):
        daily_routine = [daily_routine]  # 하위 호환
    
    if any(job in daily_routine for job in ["mental_stress", "service_job"]):
        scores["Symptom Solver"] += 40
        scores["Worrier"] += 15  # 불안감 동반 가능성
        scores["Minimalist"] = 0
    
    # Q2: 육체노동 (신체 피로)
    if "physical_job" in daily_routine:
        scores["Symptom Solver"] += 20
        scores["Minimalist"] = 0
    
    # Q10: 자유 텍스트에 증상 언급 (키워드 분석)
    additional_concerns = survey_responses.get("additional_concerns", "")
    symptom_keywords = ["통증", "아픔", "아파", "불편", "두통", "피로", "어지럼", "답답", "저림", 
                        "숨", "가슴", "배", "허리", "무릎", "관절", "소화", "변비", "설사"]
    if additional_concerns and any(keyword in additional_concerns for keyword in symptom_keywords):
        scores["Symptom Solver"] += 35
        scores["Minimalist"] = 0
    
    # ==========================================
    # 3순위: Manager (만성질환 관리)
    # ==========================================
    
    # Q4: 현재 흡연
    smoking = survey_responses.get("smoking", "")
    if smoking == "current_smoker":
        scores["Manager"] += 40
        scores["Minimalist"] = 0
    
    # Q5: 잦은 음주 (주 2회 이상)
    drinking = survey_responses.get("drinking", "")
    if drinking in ["weekly_1_2", "weekly_3plus"]:
        scores["Manager"] += 30
        scores["Minimalist"] = 0
    
    # Q1: 체중 증가
    if weight_change in ["increase_some", "increase_more"]:
        scores["Manager"] += 25
        scores["Minimalist"] = 0
    
    # Q7: 스트레스 대체 (daily_routine 기반 추론)
    # irregular(불규칙한 생활) -> Manager 가중치
    if "irregular" in daily_routine:
        scores["Manager"] += 20
        scores["Minimalist"] = 0
    
    # 복합 위험 가중치 (흡연 + 음주 + 비만)
    if (smoking == "current_smoker" and
        drinking in ["weekly_1_2", "weekly_3plus"] and
        weight_change == "increase_more"):
        scores["Manager"] += 30  # 추가 가중치
    
    # ==========================================
    # 4순위: Optimizer (웰니스/활력)
    # ==========================================
    
    # Q3: 규칙적 운동
    exercise_frequency = survey_responses.get("exercise_frequency", "")
    if exercise_frequency == "regular":
        scores["Optimizer"] += 40
    
    # Q2: 고소득 직업군 (전문직/관리직) - 배열 처리
    if isinstance(daily_routine, list):
        if "desk_job" in daily_routine or "mental_stress" in daily_routine:
            scores["Optimizer"] += 30
    elif daily_routine in ["desk_job", "mental_stress"]:
        scores["Optimizer"] += 30
    
    # Q1: 다이어트 성공 (자기관리)
    if weight_change == "decrease_good":
        scores["Optimizer"] += 25
        scores["Minimalist"] = 0
    
    # Optimizer + 고소득 복합 (프리미엄 타겟) - 배열 처리
    if (exercise_frequency == "regular" and "mental_stress" in daily_routine):
        scores["Optimizer"] += 20  # 추가 가중치
    
    # ==========================================
    # 5순위: Minimalist (실속형) - 기본값
    # ==========================================
    # 다른 페르소나 점수가 낮으면 자동으로 Minimalist 유지
    
    # ==========================================
    # 최종 판정
    # ==========================================
    primary_persona = max(scores, key=scores.get)
    
    # 업셀링 강도 설정
    upselling_map = {
        "Worrier": "very_high",
        "Symptom Solver": "high",
        "Manager": "medium",
        "Optimizer": "very_high",
        "Minimalist": "low"
    }
    
    # Bridge Strategy 설정
    bridge_strategy_map = {
        "Worrier": "Peace of Mind",
        "Symptom Solver": "Gap Filling",
        "Manager": "Linkage",
        "Optimizer": "Vitality",
        "Minimalist": "Efficiency"
    }
    
    # 톤앤매너 설정
    tone_map = {
        "Worrier": "공감, 안심, 확신",
        "Symptom Solver": "분석적, 해결책 제시",
        "Manager": "경고, 관리, 체계적",
        "Optimizer": "프리미엄, 최신지견",
        "Minimalist": "간결, 핵심, 가성비"
    }
    
    # 설득 메시지 템플릿
    persuasion_message_map = {
        "Worrier": "가족력 때문에 불안하시죠? 눈으로 확인하고 마음의 짐을 덜으세요.",
        "Symptom Solver": "단순 피로가 아닙니다. 숨겨진 원인을 데이터로 찾아야 합니다.",
        "Manager": "음주와 비만이 만나면 간이 굳어집니다. 연결고리를 끊어야 합니다.",
        "Optimizer": "병이 없는 것과 활력이 넘치는 건 다릅니다. 최상의 컨디션을 만드세요.",
        "Minimalist": "바쁘시겠지만, 가성비 있게 딱 이것 하나만 챙기시면 됩니다."
    }
    
    return {
        "primary_persona": primary_persona,
        "persona_score": scores,
        "bridge_strategy": bridge_strategy_map[primary_persona],
        "tone": tone_map[primary_persona],
        "upselling_intensity": upselling_map[primary_persona],
        "persuasion_message": persuasion_message_map[primary_persona]
    }
