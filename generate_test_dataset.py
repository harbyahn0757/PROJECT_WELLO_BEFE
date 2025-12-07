import json
import uuid
import random
import time

# --------------------------------------------------------------------------
# 1. Constants & Enums (데이터 표준화)
# --------------------------------------------------------------------------
AGE_RANGE = (30, 55)
JOB_TYPES = ["office", "sales", "labor", "freelance", "housewife", "executive"]
GENDERS = ["M", "F"]

SURVEY_OPTIONS = {
    "drinking": ["none", "monthly_1", "weekly_1", "weekly_3plus"],
    "smoking": ["none", "past_smoker", "current_smoker"],
    "exercise": ["none", "weekly_1", "weekly_3", "daily"],
    "weight_change": ["none", "increase", "decrease_diet", "decrease_bad"],
    "stress_level": ["low", "moderate", "high", "extreme"],
    "sleep_time": ["less_6h", "6h_to_8h", "more_8h"]
}

SYMPTOMS_LIST = ["fatigue", "indigestion", "heartburn", "headache", "dizziness", "chest_pain", "insomnia", "constipation"]
FAMILY_HISTORY_LIST = ["stomach_cancer", "liver_cancer", "colon_cancer", "hypertension", "diabetes", "stroke", "none"]
CONCERN_KEYWORDS = {
    "basic": ["건강검진", "위 내시경", "대장 내시경", "초음파"],
    "worry": ["암 표지자", "MRI", "CT", "정밀 검진", "뇌동맥류"],
    "optimizer": ["유전자 검사", "마이크로바이옴", "항산화 검사", "호르몬 나이"],
    "symptom": ["통증 원인", "만성 피로", "기능 의학"]
}

NAMES_KOREAN = {
    "last": ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"],
    "first": ["민수", "지훈", "현우", "성민", "준호", "영진", "도현", "수빈", "지은", "혜진", "서연", "민지", "광수", "철수", "영희"]
}

def get_random_name():
    return random.choice(NAMES_KOREAN["last"]) + random.choice(NAMES_KOREAN["first"])

# --------------------------------------------------------------------------
# 2. Generator Functions (Core Logic)
# --------------------------------------------------------------------------

def generate_base_profile(case_type="Random", specific_data=None):
    """기본 프로필 생성"""
    profile = {
        "uuid": str(uuid.uuid4()),
        "case_description": f"Case {case_type}: Generated Profile",
        "hospital_id": "KIM_HW_CLINIC",  # Real Hospital ID
        "patient_name": get_random_name(),
        "age": random.randint(*AGE_RANGE),
        "gender": random.choice(GENDERS),
        "selected_concerns": [],
        "survey_responses": {},
        "health_history": [],
        "user_attributes": []
    }
    
    if specific_data:
        profile.update(specific_data)
        
    return profile

# --------------------------------------------------------------------------
# 3. Target Scenarios (Edge Cases A-E)
# --------------------------------------------------------------------------

def get_edge_cases():
    cases = []
    
    # 1. Case A (The Anxious Manager - Conflict Test)
    cases.append(generate_base_profile("A", {
        "case_description": "Case A: [Conflict] Worrier(가족력) vs Manager(음주/흡연) 점수 충돌",
        "patient_name": "이모순",
        "age": 45,
        "gender": "M",
        "survey_responses": {
            "drinking": "weekly_3plus",
            "smoking": "current_smoker",
            "exercise": "none",
            "weight_change": "increase",
            "family_history": ["stomach_cancer"],
            "symptoms": ["heartburn"],
            "job_type": "sales",
            "stress_level": "high",
            "sleep_time": "less_6h"
        },
        "selected_concerns": [
            {"type": "checkup", "id": "c1", "name": "위 내시경", "status": "warning"},
            {"type": "keyword", "id": "k1", "name": "암 가족력", "status": "interest"}
        ],
        "user_attributes": [{
            "type": "dwell_time",
            "questionKey": "family_history",
            "value": "25000",
            "timestamp": int(time.time() * 1000)
        }]
    }))

    # 2. Case B (The Symptom Solver - Pain Driven)
    cases.append(generate_base_profile("B", {
        "case_description": "Case B: [Symptom Solver] 다발성 증상 및 스트레스 기반 추천 유도",
        "patient_name": "박통증",
        "age": 38,
        "gender": "F",
        "survey_responses": {
            "drinking": "monthly_1",
            "smoking": "none",
            "exercise": "none",
            "weight_change": "none",
            "family_history": ["none"],
            "symptoms": ["fatigue", "indigestion", "headache", "insomnia"], # 증상 4개
            "job_type": "office",
            "stress_level": "extreme",
            "sleep_time": "less_6h"
        },
        "selected_concerns": [
            {"type": "symptom", "id": "s1", "name": "만성 피로", "status": "high"}
        ],
        "user_attributes": []
    }))

    # 3. Case C (The Red Flag - Clinical Rule Test)
    cases.append(generate_base_profile("C", {
        "case_description": "Case C: [Red Flag Rule A] 의도치 않은 체중 감소 (Priority 강제 발동)",
        "patient_name": "최감소",
        "age": 52,
        "gender": "M",
        "survey_responses": {
            "drinking": "weekly_1",
            "smoking": "past_smoker",
            "exercise": "weekly_1",
            "weight_change": "decrease_bad", # Critical Trigger
            "family_history": ["diabetes"],
            "symptoms": ["fatigue"],
            "job_type": "executive",
            "stress_level": "moderate",
            "sleep_time": "6h_to_8h"
        },
        "selected_concerns": [],
        "user_attributes": []
    }))

    # 4. Case D (The Optimizer - Upselling Test)
    cases.append(generate_base_profile("D", {
        "case_description": "Case D: [Optimizer] 건강하지만 고관여층 (Upselling 테스트)",
        "patient_name": "정웰빙",
        "age": 32,
        "gender": "F",
        "survey_responses": {
            "drinking": "none",
            "smoking": "none",
            "exercise": "daily",
            "weight_change": "none",
            "family_history": ["none"],
            "symptoms": [],
            "job_type": "freelance",
            "stress_level": "low",
            "sleep_time": "more_8h"
        },
        "selected_concerns": [
            {"type": "premium", "id": "p1", "name": "유전자 검사", "status": "interest"},
            {"type": "premium", "id": "p2", "name": "마이크로바이옴", "status": "interest"}
        ],
        "user_attributes": [{
            "type": "interaction",
            "questionKey": "read_health_news",
            "value": "True",
            "timestamp": int(time.time() * 1000)
        }]
    }))

    # 5. Case E (The Neglectful Patient - History Logic Test)
    cases.append(generate_base_profile("E", {
        "case_description": "Case E: [Red Flag Rule B] 과거 이상 소견 방치 (Metabolic Risk)",
        "patient_name": "김방치",
        "age": 49,
        "gender": "M",
        "survey_responses": {
            "drinking": "weekly_3plus",
            "smoking": "current_smoker",
            "exercise": "none",
            "weight_change": "increase",
            "family_history": ["hypertension"],
            "symptoms": [],
            "job_type": "labor",
            "stress_level": "moderate",
            "sleep_time": "6h_to_8h"
        },
        "selected_concerns": [], # 약물 복용 없음
        "health_history": [
            {"year": 2023, "item": "BP", "result": "145/95", "status": "abnormal"},
            {"year": 2023, "item": "FBS", "result": "115", "status": "borderline"}
        ],
        "user_attributes": []
    }))
    
    return cases

# --------------------------------------------------------------------------
# 4. Randomized Case Generation (Filling up to 100)
# --------------------------------------------------------------------------

def generate_random_cases(count=95):
    random_cases = []
    
    for _ in range(count):
        # 1. Base Persona Decision (Probability Weighted)
        persona_type = random.choices(
            ["Manager", "Worrier", "Optimizer", "Symptom", "Normal"],
            weights=[35, 25, 10, 15, 15],
            k=1
        )[0]
        
        # 2. Set Attributes based on Persona
        survey = {}
        concerns = []
        attributes = []
        history = []
        
        # Job & Stress Logic
        survey["job_type"] = random.choice(JOB_TYPES)
        survey["stress_level"] = random.choice(SURVEY_OPTIONS["stress_level"])
        survey["sleep_time"] = random.choice(SURVEY_OPTIONS["sleep_time"])
        
        # Persona Specific Logic overrides
        if persona_type == "Manager":
            survey["drinking"] = random.choice(["weekly_3plus", "weekly_1"])
            survey["smoking"] = random.choice(["current_smoker", "past_smoker"])
            survey["exercise"] = "none"
            survey["weight_change"] = random.choice(["increase", "none"])
            survey["family_history"] = random.choices(FAMILY_HISTORY_LIST, k=1)
            survey["symptoms"] = random.sample(SYMPTOMS_LIST, k=random.randint(0, 2))
            
        elif persona_type == "Worrier":
            survey["drinking"] = random.choice(["none", "monthly_1"])
            survey["smoking"] = "none"
            survey["exercise"] = random.choice(["weekly_1", "none"])
            survey["weight_change"] = "none"
            # Worrier always has family history or high dwell time
            survey["family_history"] = random.choices(FAMILY_HISTORY_LIST[:3], k=1) # Cancer types
            attributes.append({
                "type": "dwell_time",
                "questionKey": "family_history",
                "value": str(random.randint(15000, 30000)),
                "timestamp": int(time.time() * 1000)
            })
            concerns.append({"type": "keyword", "id": "w1", "name": random.choice(CONCERN_KEYWORDS["worry"]), "status": "interest"})
            survey["symptoms"] = random.sample(SYMPTOMS_LIST, k=random.randint(1, 3))

        elif persona_type == "Symptom":
            survey["drinking"] = "monthly_1"
            survey["smoking"] = "none"
            survey["exercise"] = "none"
            survey["weight_change"] = random.choice(["decrease_diet", "none"])
            survey["family_history"] = ["none"]
            # High symptoms count
            survey["symptoms"] = random.sample(SYMPTOMS_LIST, k=random.randint(3, 6))
            survey["stress_level"] = "high"
            concerns.append({"type": "symptom", "id": "s1", "name": random.choice(CONCERN_KEYWORDS["symptom"]), "status": "pain"})

        elif persona_type == "Optimizer":
            survey["drinking"] = "none"
            survey["smoking"] = "none"
            survey["exercise"] = random.choice(["daily", "weekly_3"])
            survey["weight_change"] = "none"
            survey["family_history"] = random.choices(FAMILY_HISTORY_LIST, k=1)
            survey["symptoms"] = []
            concerns.append({"type": "premium", "id": "o1", "name": random.choice(CONCERN_KEYWORDS["optimizer"]), "status": "interest"})
            
        else: # Normal
            survey["drinking"] = "monthly_1"
            survey["smoking"] = "none"
            survey["exercise"] = "weekly_1"
            survey["weight_change"] = "none"
            survey["family_history"] = ["none"]
            survey["symptoms"] = []

        # 3. Add Clinical Logic (Random Red Flags - 5% chance)
        if random.random() < 0.05:
            # Rule A: Unexplained Weight Loss
            survey["weight_change"] = "decrease_bad"
            case_desc = f"Case Random (Red Flag A): {persona_type} with Weight Loss"
        elif random.random() < 0.05:
             # Rule B: Neglect
            history.append({"year": 2022, "item": "BP", "result": "150/90", "status": "abnormal"})
            case_desc = f"Case Random (Red Flag B): {persona_type} with Untreated History"
        else:
            case_desc = f"Case Random: {persona_type} Type"

        # Create Profile
        profile = generate_base_profile("Random", {
            "case_description": case_desc,
            "survey_responses": survey,
            "selected_concerns": concerns,
            "health_history": history,
            "user_attributes": attributes
        })
        random_cases.append(profile)

    return random_cases

# --------------------------------------------------------------------------
# 5. Main Execution
# --------------------------------------------------------------------------
def generate_dataset():
    # 5 Edge Cases + 15 Random Cases = 20 Total
    dataset = get_edge_cases() + generate_random_cases(15)
    return dataset

if __name__ == "__main__":
    full_dataset = generate_dataset()
    
    # Write to file
    filename = 'tests/integration_data/qa_dataset.json'
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(full_dataset, f, indent=2, ensure_ascii=False)
        
    print(f"✅ Generated {len(full_dataset)} cases. Saved to {filename}")
    print("--------------------------------------------------")
    print("Edge Case Preview:")
    for i in range(5):
        print(f"[{i+1}] {full_dataset[i]['case_description']} ({full_dataset[i]['patient_name']})")
