"""
문진 응답 텍스트 매핑
value를 사람이 읽을 수 있는 텍스트로 변환합니다.
"""
from typing import Dict, Any, List


def generate_survey_section(survey_responses: Dict[str, Any]) -> str:
    """
    문진 응답을 프롬프트용 텍스트로 변환
    
    Args:
        survey_responses: 문진 응답 데이터
            {
                "weight_change": "decrease_bad",
                "daily_routine": "desk_job",
                "exercise_frequency": "regular",
                ...
            }
    
    Returns:
        ## 문진 응답 요약
        - 체중 변화: 의도치 않게 빠짐 3kg 이상 (⚠️ 질환 의심)
        - 일과 패턴: 주로 앉아서 모니터 집중 (사무/전문직, 소득 중~상)
        ...
    """
    # survey_responses가 None이면 빈 딕셔너리로 처리
    survey_responses = survey_responses or {}
    
    # 매핑 테이블
    weight_change_map = {
        "maintain": "변화 없음 (정상)",
        "decrease_bad": "의도치 않게 빠짐 3kg 이상 (⚠️ 질환 의심 - 암/갑상선/당뇨 등 검토 필요)",
        "decrease_good": "다이어트로 뺌 (자기관리 철저, Optimizer 성향)",
        "increase_some": "조금 쪘음 1~3kg (대사증후군 주의 단계)",
        "increase_more": "많이 쪘음 3kg 이상 (⚠️ 비만/지방간 위험 - 간/심혈관 집중 관리 필요)"
    }
    
    daily_routine_map = {
        "desk_job": "주로 앉아서 모니터 집중 (사무/전문직, 소득 중~상) → 거북목/안구건조/대사저하 주의",
        "mental_stress": "중요한 결정/정신적 압박 (임원/관리직, 소득 상) → 뇌심혈관/만성피로 주의",
        "service_job": "사람 상대/감정 소모 (영업/서비스, 소득 중) → 스트레스성 위장장애 주의",
        "physical_job": "몸을 쓰거나 서 있는 일 (현장/기술직, 소득 중~하) → 근골격계/육체피로 주의",
        "irregular": "밤낮 불규칙/식사 불규칙 (자영업/교대, 소득 다양) → 대사증후군/수면장애 주의",
        "home_maker": "가사/은퇴 후 휴식 (주부/은퇴) → 갱년기/노화/관절 주의, 가족 결정권자일 확률 높음"
    }
    
    exercise_frequency_map = {
        "regular": "규칙적으로 운동함 (주 3회 이상) - Optimizer 성향",
        "sometimes": "가끔 운동함 (주 1-2회)",
        "rarely": "거의 안 함 - 운동 필요성 인지 필요",
        "never": "전혀 안 함 - ⚠️ 심혈관/대사 위험 증가"
    }
    
    smoking_map = {
        "non_smoker": "비흡연 (평생 비흡연자)",
        "ex_smoker": "과거 흡연 (금연) - 금연 기간 확인 필요",
        "current_smoker": "현재 흡연 (⚠️ 폐암/COPD/심혈관 고위험군 - 폐 CT 필수)"
    }
    
    drinking_map = {
        "never": "전혀 안 함 (비음주)",
        "monthly_less": "월 1회 미만 (사회적 음주)",
        "monthly_1_2": "월 1-2회 (적정 음주)",
        "weekly_1_2": "주 1-2회 (⚠️ 간 관리 필요 - 복부 초음파/간 수치 모니터링)",
        "weekly_3plus": "주 3회 이상 (⚠️ 알코올성 간질환/지방간 고위험 - 간 섬유화 스캔 필수)"
    }
    
    sleep_hours_map = {
        "less_5": "5시간 미만 (⚠️ 심각한 수면 부족 - 만성피로/면역력 저하/심혈관 위험)",
        "5_6": "5-6시간 (수면 부족 - 수면장애 검사 권장)",
        "6_7": "6-7시간 (약간 부족)",
        "7_8": "7-8시간 (적정 수면)",
        "more_8": "8시간 이상 (충분한 수면)"
    }
    
    # stress_level_map (삭제됨)
    
    family_history_map = {
        "cancer": "암",
        "stroke": "뇌졸중",
        "heart_disease": "심장질환",
        "diabetes": "당뇨병",
        "hypertension": "고혈압",
        "none": "없음"
    }
    
    colonoscopy_experience_map = {
        "yes_comfortable": "예, 불편함 없이 받았습니다 → 정기 내시경 추천 가능",
        "yes_uncomfortable": "예, 불편했습니다 → 수면 내시경 또는 대체 검사(대장암 DNA) 권장",
        "no_afraid": "아니오, 두려워서 받지 않았습니다 → ⚠️ 대체 검사 적극 추천 (얼리텍-C, 대장암 DNA 검사)",
        "no_never": "아니오, 받아본 적이 없습니다 → 중요성 설명 + 편안한 옵션 제시 필요"
    }
    
    # 섹션 생성
    section = "## 문진 응답 요약\n\n"
    
    # Q1: 체중 변화
    weight_change = survey_responses.get("weight_change", "")
    if weight_change:
        section += f"- **체중 변화**: {weight_change_map.get(weight_change, weight_change)}\n"
    
    # Q2: 일과 패턴 (직업 환경) - 멀티셀렉트
    daily_routine = survey_responses.get("daily_routine", [])
    if daily_routine:
        if isinstance(daily_routine, str):
            # 단일 선택인 경우 (하위 호환)
            daily_routine = [daily_routine]
        
        routine_texts = []
        for routine in daily_routine:
            routine_text = daily_routine_map.get(routine, routine)
            routine_texts.append(routine_text)
        
        if routine_texts:
            section += f"- **일과 패턴** (복수 선택):\n"
            for idx, text in enumerate(routine_texts, 1):
                section += f"  {idx}) {text}\n"
    
    # Q3: 운동
    exercise_frequency = survey_responses.get("exercise_frequency", "")
    if exercise_frequency:
        section += f"- **운동**: {exercise_frequency_map.get(exercise_frequency, exercise_frequency)}\n"
    
    # Q4: 흡연
    smoking = survey_responses.get("smoking", "")
    if smoking:
        section += f"- **흡연**: {smoking_map.get(smoking, smoking)}\n"
    
    # Q5: 음주
    drinking = survey_responses.get("drinking", "")
    if drinking:
        section += f"- **음주**: {drinking_map.get(drinking, drinking)}\n"
    
    # Q6: 수면
    sleep_hours = survey_responses.get("sleep_hours", "")
    if sleep_hours:
        section += f"- **수면**: {sleep_hours_map.get(sleep_hours, sleep_hours)}\n"
    
    # Q7: 스트레스 (삭제됨 - daily_routine으로 통합)
    # stress_level = survey_responses.get("stress_level", "")
    # if stress_level:
    #     section += f"- **스트레스 수준**: {stress_level_map.get(stress_level, stress_level)}\n"
    
    # Q8: 가족력
    family_history = survey_responses.get("family_history", [])
    if family_history:
        if "none" in family_history:
            section += f"- **가족력**: 없음 (가족력 없음)\n"
        else:
            family_history_text = ", ".join([family_history_map.get(fh, fh) for fh in family_history])
            section += f"- **가족력**: {family_history_text} (⚠️ 유전적 위험 존재 - 해당 질환 정밀검사 필수)\n"
    
    # Q9: 대장내시경 경험 (35세 이상만)
    colonoscopy_experience = survey_responses.get("colonoscopy_experience", "")
    if colonoscopy_experience:
        section += f"- **대장내시경 경험**: {colonoscopy_experience_map.get(colonoscopy_experience, colonoscopy_experience)}\n"
    
    # Q10: 자유 텍스트 (추가 고민사항)
    additional_concerns = survey_responses.get("additional_concerns", "")
    if additional_concerns and additional_concerns.strip():
        section += f"\n### 환자가 직접 언급한 고민사항\n"
        section += f"> \"{additional_concerns}\"\n\n"
        section += f"⚠️ **위 고민사항을 최우선으로 반영하여 건강 분석을 수행하세요.**\n"
        section += f"   환자가 직접 언급한 증상/걱정은 매우 중요한 단서입니다.\n"
    
    return section


def get_persona_description(persona_type: str) -> str:
    """
    페르소나 유형별 상세 설명
    
    Args:
        persona_type: 페르소나 유형 (Worrier, Symptom Solver, Manager, Optimizer, Minimalist)
    
    Returns:
        페르소나 상세 설명 텍스트
    """
    persona_descriptions = {
        "Worrier": """**Worrier (가족력/불안형)**
- 특징: 가족력으로 인한 불안이 강한 유형
- 심리: "나도 가족처럼 병에 걸리면 어떡하지?"
- 니즈: 눈으로 확인하고 싶음, 조기 발견 욕구 강함
- 검진 접근: 해당 질환 정밀검사 필수 권장
- 설득 포인트: "가족력이 있어도 조기 발견하면 충분히 관리 가능합니다"
- 업셀링 강도: ⭐⭐⭐⭐⭐ (최고) - 불안 해소를 위해 추가 검사 수용도 높음""",
        
        "Symptom Solver": """**Symptom Solver (증상해결형)**
- 특징: 현재 불편한 증상/문제가 있는 유형
- 심리: "이 증상의 원인이 뭘까?"
- 니즈: 숨겨진 원인 규명, 데이터 기반 해결책
- 검진 접근: 증상 관련 정밀 검사로 원인 규명
- 설득 포인트: "단순 피로가 아닙니다. 정확한 원인을 찾아야 합니다"
- 업셀링 강도: ⭐⭐⭐⭐ (높음) - 문제 해결을 위해 추가 검사 수용 가능""",
        
        "Manager": """**Manager (만성질환 관리형)**
- 특징: 흡연/음주/비만 등 관리 필요한 위험 요인 보유
- 심리: "내가 관리를 안 하면 큰일 나겠지?"
- 니즈: 체계적 관리, 연결고리 이해
- 검진 접근: 위험 요인별 연쇄 반응 설명 + 모니터링
- 설득 포인트: "음주와 비만이 만나면 간이 굳어집니다. 끊어야 합니다"
- 업셀링 강도: ⭐⭐⭐ (중간) - 관리 필요성 인지 후 추가 검사 고려""",
        
        "Optimizer": """**Optimizer (웰니스/활력형)**
- 특징: 건강에 관심 많고 자기관리 철저, 구매력 있음
- 심리: "더 건강하고 활력 넘치고 싶어"
- 니즈: 최상의 컨디션, 최신 의학 정보
- 검진 접근: 프리미엄 검진, 노화 방지, 활력 증진
- 설득 포인트: "병이 없는 것과 활력이 넘치는 건 다릅니다"
- 업셀링 강도: ⭐⭐⭐⭐⭐ (최고) - 프리미엄 검사 수용도 매우 높음""",
        
        "Minimalist": """**Minimalist (실속형)**
- 특징: 특별한 위험 요인 없음, 가성비 중시
- 심리: "꼭 필요한 것만 효율적으로"
- 니즈: 핵심만 간결하게, 불필요한 것 제외
- 검진 접근: 필수 검사 중심, 간결한 설명
- 설득 포인트: "바쁘시겠지만, 이것 하나만 챙기시면 됩니다"
- 업셀링 강도: ⭐⭐ (낮음) - 필수 검사 외 추가 검사 수용도 낮음"""
    }
    
    return persona_descriptions.get(persona_type, "")

