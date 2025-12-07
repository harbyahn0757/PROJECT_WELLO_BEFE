"""
페르소나 판정 알고리즘 (3-Layer Integrated Model)
문진(Lifestyle), 검진기록(Body Reality), 채팅선택(User Intent)을 통합 분석합니다.
"""
from typing import Dict, Any, Optional, List
from datetime import datetime
import re
import json

def determine_persona(
    survey_responses: Dict[str, Any], 
    patient_age: int,
    health_history: Optional[List[Dict[str, Any]]] = None,
    selected_concerns: Optional[List[Dict[str, Any]]] = None,
    prescription_data: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    3차원 통합 페르소나 판정 알고리즘
    
    Args:
        survey_responses: 문진 데이터
        patient_age: 환자 나이
        health_history: 과거 검진 기록 리스트
        selected_concerns: 채팅 선택 항목 리스트
        prescription_data: 처방 이력 리스트
        
    Returns:
        Dict: 페르소나 판정 결과 및 Risk Flags
    """
    # 0. 초기화
    scores: Dict[str, int] = {
        "Worrier": 0,
        "Symptom Solver": 0,
        "Manager": 0,
        "Optimizer": 0,
        "Minimalist": 100  # 기본값
    }
    risk_flags = []
    
    # 데이터 정규화
    survey = survey_responses or {}
    history = health_history or []
    concerns = selected_concerns or []
    prescriptions = prescription_data or []
    
    # ==========================================
    # Layer 1: Lifestyle Survey (문진) - Action First
    # ==========================================
    _calculate_survey_score(survey, scores, risk_flags)
    
    # ==========================================
    # Layer 2: Body Reality (검진기록) - Time Decay & Gap Analysis
    # ==========================================
    _calculate_body_score(history, prescriptions, scores, risk_flags)
    
    # ==========================================
    # Layer 3: User Intent (채팅선택)
    # ==========================================
    _calculate_intent_score(concerns, scores)
    
    # ==========================================
    # 최종 판정 로직
    # ==========================================
    # Minimalist는 다른 점수가 있으면 0점으로 처리
    if any(s > 0 for k, s in scores.items() if k != "Minimalist"):
        scores["Minimalist"] = 0
        
    # 우선순위: Manager(위급) > Symptom(고통) > Worrier(불안) > Optimizer > Minimalist
    persona_priority = ["Manager", "Symptom Solver", "Worrier", "Optimizer", "Minimalist"]

    # Primary 결정
    max_score = max(scores.values())
    candidates = [p for p, s in scores.items() if s == max_score]
    # 동점 시 우선순위 테이블 적용
    primary_persona = next(p for p in persona_priority if p in candidates)

    # Secondary 결정 (1위 점수의 70% 이상 또는 50점 이상)
    sorted_personas = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    secondary_persona = None
    
    if len(sorted_personas) > 1:
        second_name, second_score = sorted_personas[1]
        primary_score = scores[primary_persona]
        
        if primary_persona != "Minimalist" and second_score > 0:
            if second_score >= (primary_score * 0.7) or second_score >= 50:
                secondary_persona = second_name

    # 메타데이터 매핑
    combined_type = f"{primary_persona}_{secondary_persona}" if secondary_persona else primary_persona
    
    return {
        "type": primary_persona,
        "primary_persona": primary_persona,
        "secondary_persona": secondary_persona,
        "combined_type": combined_type,
        "persona_score": scores,
        "risk_flags": risk_flags, # Step 2에서 활용할 Red Flags
        "bridge_strategy": _get_strategy_map(primary_persona),
        "tone": _get_tone_map(primary_persona),
        "persuasion_message": _get_message_map(primary_persona)
    }

def _calculate_survey_score(survey: Dict[str, Any], scores: Dict[str, int], risk_flags: List[str]):
    """문진 데이터 기반 점수 계산 (행동 중심 가중치)"""
    
    # 1. Manager Factors (나쁜 습관 = 고득점)
    # 흡연
    if survey.get("smoking") == "current_smoker":
        scores["Manager"] += 60
    
    # 음주
    drinking = survey.get("drinking", "")
    if drinking == "weekly_3plus":
        scores["Manager"] += 50
    elif drinking == "weekly_1_2":
        scores["Manager"] += 20
        
    # 체중 증가
    weight_change = survey.get("weight_change", "")
    if weight_change == "increase_more": # 3kg 이상 증가
        scores["Manager"] += 40
        
    # 불규칙한 생활 (daily_routine)
    daily_routine = survey.get("daily_routine", [])
    if isinstance(daily_routine, str): daily_routine = [daily_routine]
    if "irregular" in daily_routine:
        scores["Manager"] += 40
    if "desk_job" in daily_routine: # 운동 부족 잠재
        scores["Manager"] += 20

    # 2. Symptom Solver Factors (통증/직업병)
    # 직업적 증상 유발
    if any(job in daily_routine for job in ["mental_stress", "service_job", "physical_job"]):
        scores["Symptom Solver"] += 30
        
    # 수면 부족
    if survey.get("sleep_hours") == "less_5":
        scores["Symptom Solver"] += 40
        
    # 직접 호소 (통증 키워드)
    concerns = survey.get("additional_concerns", "")
    pain_keywords = ["통증", "아픔", "아파", "불편", "두통", "피로", "어지럼", "소화", "변비"]
    if concerns and any(k in concerns for k in pain_keywords):
        scores["Symptom Solver"] += 50
        
    # Red Flag 처리 (점수 대신 Flag)
    if weight_change == "decrease_bad":
        risk_flags.append("unintended_weight_loss") # 체중 급감

    # 3. Worrier Factors (가족력 - 0점 시작)
    family_history = survey.get("family_history", [])
    if family_history and "none" not in family_history:
        if "cancer" in family_history: scores["Worrier"] += 30
        if "stroke" in family_history: scores["Worrier"] += 20
        if "heart_disease" in family_history: scores["Worrier"] += 20
        if "diabetes" in family_history: scores["Worrier"] += 10
        if "hypertension" in family_history: scores["Worrier"] += 10
        
        # 대장내시경 회피
        if survey.get("colonoscopy_experience") == "no_afraid":
            scores["Worrier"] += 40

    # 4. Optimizer Factors (좋은 습관)
    # 운동
    exercise = survey.get("exercise_frequency", "")
    if exercise == "regular":
        scores["Optimizer"] += 60
    
    # 다이어트 성공
    if weight_change == "decrease_good":
        scores["Optimizer"] += 40
        
    # 정기 내시경
    if survey.get("colonoscopy_experience") == "yes_comfortable":
        scores["Optimizer"] += 30
        
    # 금연 성공
    if survey.get("smoking") == "ex_smoker":
        scores["Optimizer"] += 20

def _calculate_body_score(history: List[Dict[str, Any]], prescriptions: List[Dict[str, Any]], scores: Dict[str, int], risk_flags: List[str]):
    """검진 기록 및 처방 이력 기반 점수 (Time Decay 적용)"""
    current_year = datetime.now().year
    
    # 투약 여부 확인 (최근 1년 내)
    has_medication = False
    for rx in prescriptions:
        # 간단한 로직: 처방 내역이 있으면 관리 중으로 간주
        # 실제로는 날짜 파싱이 필요하지만, 여기서는 존재 여부로 판단
        has_medication = True
        scores["Manager"] += 20 # 약을 먹는다는 건 평생 관리 대상임
        
    # 검진 데이터 분석
    for record in history:
        # 날짜 파싱
        checkup_year = current_year # Default
        checkup_date = record.get("checkup_date") or record.get("CheckUpDate")
        year_val = record.get("year")
        
        if year_val:
            try: checkup_year = int(year_val)
            except: pass
        elif checkup_date:
            try: checkup_year = int(checkup_date[:4])
            except: pass
            
        time_diff = current_year - checkup_year
        
        # Time Decay Factor
        if time_diff <= 1: decay = 1.0     # 1년 이내: 강력
        elif time_diff <= 3: decay = 0.5   # 3년 이내: 절반
        else: decay = 0.1                  # 3년 초과: 미미함
        
        # 이상 소견 추출 (정밀 파싱)
        raw_data = record.get('raw_data') or {}
        if isinstance(raw_data, str):
            try:
                raw_data = json.loads(raw_data)
            except:
                raw_data = {}
        
        found_risks = []
        is_normal = False
        
        # 구조적 파싱 (Inspections -> Illnesses -> Items -> ItemReferences)
        if isinstance(raw_data, dict) and raw_data.get("Inspections"):
            for inspection in raw_data["Inspections"]:
                if inspection.get("Illnesses"):
                    for illness in inspection["Illnesses"]:
                        if illness.get("Items"):
                            for item in illness["Items"]:
                                if item.get("ItemReferences"):
                                    for ref in item["ItemReferences"]:
                                        ref_name = ref.get("Name", "")
                                        # 정상 판정
                                        if "정상(A)" in ref_name:
                                            is_normal = True
                                        # 질환 판정
                                        elif any(k in ref_name for k in ["질환의심", "유질환", "고혈압", "당뇨", "비만", "고지혈", "이상지질", "간장질환"]):
                                            found_risks.append(ref_name)
        
        # 백업: 구조적 데이터가 없으면 문자열 검색 (단, '없음' 제외 등 방어 로직 추가)
        if not found_risks and not is_normal:
            summary = str(record).lower()
            # '이상 없음', '특이소견 없음' 등을 제외하고 키워드 매칭
            if "없음" not in summary:
                if any(x in summary for x in ["고혈압", "당뇨", "비만", "고지혈증", "이상지질", "지방간"]):
                    found_risks.append("detected_by_keyword")
                if "정상a" in summary or "정상(a)" in summary:
                    is_normal = True

        # 점수 반영
        if found_risks:
            score = 50 * decay
            # Untreated Risk Check
            if not has_medication and time_diff <= 2:
                score *= 1.5 
                risk_flags.append(f"untreated_risk_{checkup_year}")
            scores["Manager"] += int(score)
            
        if is_normal and not found_risks:
            scores["Optimizer"] += int(40 * decay)

def _calculate_intent_score(concerns: List[Dict[str, Any]], scores: Dict[str, int]):
    """채팅 선택 항목 기반 의도 분석"""
    
    for item in concerns:
        name = item.get("name") or ""
        # concernLevel = item.get("concernLevel", "implicit")
        
        # 키워드 매칭
        # Worrier
        if any(k in name for k in ["암", "종양", "유전자", "마커", "가족력", "뇌졸중", "치매", "심장"]):
            scores["Worrier"] += 15
            
        # Symptom Solver
        if any(k in name for k in ["초음파", "CT", "내시경", "MRI", "통증", "소화", "위", "대장"]):
            scores["Symptom Solver"] += 15
            
        # Optimizer
        if any(k in name for k in ["활력", "호르몬", "기능", "노화", "영양", "알레르기", "면역"]):
            scores["Optimizer"] += 15
            
        # Manager
        if any(k in name for k in ["간", "지방간", "혈관", "동맥경화", "당뇨", "혈압", "비만"]):
            scores["Manager"] += 10

def _get_strategy_map(persona):
    return {
        "Worrier": "Peace of Mind (불안 해소)",
        "Symptom Solver": "Gap Filling (원인 규명)",
        "Manager": "Linkage (연결고리 관리)",
        "Optimizer": "Vitality (최적화)",
        "Minimalist": "Efficiency (핵심만)"
    }.get(persona, "Standard")

def _get_tone_map(persona):
    return {
        "Worrier": "공감, 안심, 확신",
        "Symptom Solver": "분석적, 해결책 제시",
        "Manager": "경고, 관리, 체계적",
        "Optimizer": "프리미엄, 최신지견",
        "Minimalist": "간결, 핵심, 가성비"
    }.get(persona, "친근함")

def _get_message_map(persona):
    return {
        "Worrier": "가족력 때문에 불안하시죠? 눈으로 확인하고 마음의 짐을 덜으세요.",
        "Symptom Solver": "단순 피로가 아닙니다. 숨겨진 원인을 데이터로 찾아야 합니다.",
        "Manager": "음주와 비만이 만나면 간이 굳어집니다. 연결고리를 끊어야 합니다.",
        "Optimizer": "병이 없는 것과 활력이 넘치는 건 다릅니다. 최상의 컨디션을 만드세요.",
        "Minimalist": "바쁘시겠지만, 가성비 있게 딱 이것 하나만 챙기시면 됩니다."
    }.get(persona, "건강을 챙기세요.")
