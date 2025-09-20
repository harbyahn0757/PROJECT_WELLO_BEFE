"""
더미 데이터 정의
"""
from ..models.value_objects import LayoutType, CheckupType, Gender

# 병원 데이터
HOSPITALS_DATA = {
    "KHW001": {
        "hospital_id": "KHW001",
        "name": "김현우내과의원",
        "phone": "02-2215-9964",
        "address": "서울특별시 동대문구 전농로 124 2층",
        "supported_checkup_types": [
            CheckupType.BASIC,
            CheckupType.PREMIUM,
            CheckupType.SPECIALIZED,
            CheckupType.CANCER,
            CheckupType.CARDIOVASCULAR
        ],
        "layout_type": LayoutType.HORIZONTAL,
        "brand_color": "#E6B17E",
        "logo_position": "center",
        "is_active": True
    },
    "BSN001": {
        "hospital_id": "BSN001",
        "name": "본솔병원", 
        "phone": "02-3468-3000",
        "address": "서울특별시 강남구 도산대로 107",
        "supported_checkup_types": [
            CheckupType.BASIC,
            CheckupType.PREMIUM,
            CheckupType.SPECIALIZED
        ],
        "layout_type": LayoutType.VERTICAL,
        "brand_color": "#4A90E2",
        "logo_position": "left",
        "is_active": True
    },
    "DGN001": {
        "hospital_id": "DGN001",
        "name": "대학내과의원",
        "phone": "02-929-2100",
        "address": "서울특별시 성북구 동소문로 20길 37-6",
        "supported_checkup_types": [
            CheckupType.BASIC,
            CheckupType.PREMIUM,
            CheckupType.CARDIOVASCULAR
        ],
        "layout_type": LayoutType.HORIZONTAL,
        "brand_color": "#50C878",
        "logo_position": "right",
        "is_active": True
    }
}

# 수검자 데이터
PATIENTS_DATA = {
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890": {
        "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "김철수",
        "age": 39,
        "gender": Gender.MALE,
        "phone": "010-1234-5678",
        "hospital": HOSPITALS_DATA["KHW001"],
        "last_checkup_date": "2024-09",
        "last_checkup_type": CheckupType.BASIC
    },
    "b2c3d4e5-f6a7-8901-bcde-f12345678901": {
        "uuid": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "name": "이영희",
        "age": 45,
        "gender": Gender.FEMALE,
        "phone": "010-2345-6789",
        "hospital": HOSPITALS_DATA["BSN001"],
        "last_checkup_date": "2024-08",
        "last_checkup_type": CheckupType.PREMIUM
    },
    "c3d4e5f6-7890-abcd-ef12-34567890abcd": {
        "uuid": "c3d4e5f6-7890-abcd-ef12-34567890abcd",
        "name": "박지민",
        "age": 52,
        "gender": Gender.MALE,
        "phone": "010-3456-7890",
        "hospital": HOSPITALS_DATA["DGN001"],
        "last_checkup_date": "2024-07",
        "last_checkup_type": CheckupType.CARDIOVASCULAR
    },
    "d4e5f6a7-8901-bcde-f123-456789abcdef": {
        "uuid": "d4e5f6a7-8901-bcde-f123-456789abcdef",
        "name": "최수진",
        "age": 35,
        "gender": Gender.FEMALE,
        "phone": "010-4567-8901",
        "hospital": HOSPITALS_DATA["KHW001"],
        "last_checkup_date": "2024-09",
        "last_checkup_type": CheckupType.SPECIALIZED
    },
    "e5f6a7b8-90cd-ef12-3456-7890abcdef12": {
        "uuid": "e5f6a7b8-90cd-ef12-3456-7890abcdef12",
        "name": "정민호",
        "age": 48,
        "gender": Gender.MALE,
        "phone": "010-5678-9012",
        "hospital": HOSPITALS_DATA["BSN001"],
        "last_checkup_date": "2024-08",
        "last_checkup_type": CheckupType.BASIC
    },
    "f6a7b8c9-d0e1-2345-6789-0abcdef12345": {
        "uuid": "f6a7b8c9-d0e1-2345-6789-0abcdef12345",
        "name": "강미영",
        "age": 41,
        "gender": Gender.FEMALE,
        "phone": "010-6789-0123",
        "hospital": HOSPITALS_DATA["DGN001"],
        "last_checkup_date": "2024-07",
        "last_checkup_type": CheckupType.PREMIUM
    }
}

# 현아 기반 설문조사 페이지 (공통 사용)
HYUNA_SURVEY_PAGES = [
            {
                "id": "family-history",
                "title": "첫번째, 일반정보 중 가족력",
                "subtitle": "부모님, 형제, 자매 중에 다음 질환을 앓으셨거나 사망한 경우가 있으신가요?",
                "sections": [
                    {
                        "id": "family-history-section",
                        "title": "",
                        "subtitle": "아래 중 해당되는 경우 모두 선택",
                        "questions": [
                            {
                                "id": "familyHistory",
                                "title": "가족력",
                                "type": "checkbox",
                                "required": True,
                                "options": [
                                    {"id": "familyCerebralHistory", "label": "뇌졸중", "value": "familyCerebralHistory"},
                                    {"id": "familyHeartDiseaseHistory", "label": "심근경색/협심증", "value": "familyHeartDiseaseHistory"},
                                    {"id": "familyHypertensionHistory", "label": "고혈압", "value": "familyHypertensionHistory"},
                                    {"id": "familyDiabetesHistory", "label": "당뇨병", "value": "familyDiabetesHistory"},
                                    {"id": "familyCancerHistory", "label": "암", "value": "familyCancerHistory"},
                                    {"id": "none", "label": "해당없음", "value": "none", "isNone": True}
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                "id": "personal-history",
                "title": "두번째, 일반정보 중 과거력",
                "subtitle": "회원님께서는 과거에 다음 질환을 앓으셨거나 현재 앓고 계신 질환이 있으신가요?",
                "sections": [
                    {
                        "id": "personal-history-section",
                        "title": "",
                        "subtitle": "아래 중 해당되는 경우 모두 선택",
                        "questions": [
                            {
                                "id": "personalHistory",
                                "title": "과거력",
                                "type": "checkbox",
                                "required": True,
                                "options": [
                                    {"id": "personalCerebralHistory", "label": "뇌졸중", "value": "personalCerebralHistory"},
                                    {"id": "personalHeartDiseaseHistory", "label": "심근경색/협심증", "value": "personalHeartDiseaseHistory"},
                                    {"id": "personalHypertensionHistory", "label": "고혈압", "value": "personalHypertensionHistory"},
                                    {"id": "personalDiabetesHistory", "label": "당뇨병", "value": "personalDiabetesHistory"},
                                    {"id": "personalCancerHistory", "label": "암", "value": "personalCancerHistory"},
                                    {"id": "none", "label": "해당없음", "value": "none", "isNone": True}
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                "id": "smoking-habits",
                "title": "세번째, 생활습관 중 흡연",
                "subtitle": "현재 흡연을 하고 계신가요?",
                "sections": [
                    {
                        "id": "smoking-section",
                        "title": "",
                        "subtitle": "선택해주세요",
                        "questions": [
                            {
                                "id": "livingHabits_smokingYN",
                                "title": "흡연 여부",
                                "type": "radio",
                                "required": True,
                                "options": [
                                    {"id": "smoking_1", "label": "흡연", "value": "1"},
                                    {"id": "smoking_2", "label": "금연", "value": "2"},
                                    {"id": "smoking_0", "label": "비흡연", "value": "0"}
                                ]
                            },
                            {
                                "id": "livingHabits_smokingTotalPeriod",
                                "title": "흡연 기간 (년)",
                                "type": "input",
                                "inputType": "number",
                                "showIf": {"questionId": "livingHabits_smokingYN", "value": "1"}
                            },
                            {
                                "id": "livingHabits_smokingAveragePerWeek",
                                "title": "주당 흡연량 (개비)",
                                "type": "input",
                                "inputType": "number",
                                "showIf": {"questionId": "livingHabits_smokingYN", "value": "1"}
                            }
                        ]
                    }
                ]
            },
            {
                "id": "drinking-habits",
                "title": "네번째, 생활습관 중 음주",
                "subtitle": "평소 얼마나 자주 술을 마시십니까?",
                "sections": [
                    {
                        "id": "drinking-section",
                        "title": "",
                        "subtitle": "선택해주세요",
                        "questions": [
                            {
                                "id": "livingHabits_drinkingFrequencyPerWeek",
                                "title": "음주 빈도",
                                "type": "radio",
                                "required": True,
                                "options": [
                                    {"id": "drinking_0", "label": "안 마심", "value": "0"},
                                    {"id": "drinking_1", "label": "주 1회", "value": "1"},
                                    {"id": "drinking_2", "label": "주 2회", "value": "2"},
                                    {"id": "drinking_3", "label": "주 3회", "value": "3"},
                                    {"id": "drinking_4", "label": "주 4회", "value": "4"},
                                    {"id": "drinking_5", "label": "주 5회", "value": "5"},
                                    {"id": "drinking_6", "label": "주 6회", "value": "6"},
                                    {"id": "drinking_7", "label": "매일", "value": "7"}
                                ]
                            },
                            {
                                "id": "livingHabits_drinkingOverdoseYN",
                                "title": "과음 여부",
                                "subtitle": "한 번에 7잔(또는 맥주 5캔) 이상 마시는 경우",
                                "type": "radio",
                                "showIf": {"questionId": "livingHabits_drinkingFrequencyPerWeek", "value": ["1", "2", "3", "4", "5", "6", "7"]},
                                "options": [
                                    {"id": "drinkingOverdose_Y", "label": "예", "value": "Y"},
                                    {"id": "drinkingOverdose_N", "label": "아니오", "value": "N"}
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                "id": "exercise-habits",
                "title": "다섯번째, 생활습관 중 신체활동",
                "subtitle": "평소 얼마나 자주 운동을 하십니까?",
                "sections": [
                    {
                        "id": "exercise-section",
                        "title": "",
                        "subtitle": "선택해주세요",
                        "questions": [
                            {
                                "id": "livingHabits_exerciseFrequencyPerWeek",
                                "title": "운동 빈도",
                                "type": "radio",
                                "required": True,
                                "options": [
                                    {"id": "exercise_0", "label": "안 함", "value": "0"},
                                    {"id": "exercise_1", "label": "주 1회", "value": "1"},
                                    {"id": "exercise_2", "label": "주 2회", "value": "2"},
                                    {"id": "exercise_3", "label": "주 3회", "value": "3"},
                                    {"id": "exercise_4", "label": "주 4회", "value": "4"},
                                    {"id": "exercise_5", "label": "주 5회", "value": "5"},
                                    {"id": "exercise_6", "label": "주 6회", "value": "6"},
                                    {"id": "exercise_7", "label": "매일", "value": "7"}
                                ]
                            },
                            {
                                "id": "livingHabits_regularExerciseHabitYN",
                                "title": "규칙적 운동 습관",
                                "subtitle": "30분 이상, 주 3회 이상의 규칙적인 운동",
                                "type": "radio",
                                "showIf": {"questionId": "livingHabits_exerciseFrequencyPerWeek", "value": ["1", "2", "3", "4", "5", "6", "7"]},
                                "options": [
                                    {"id": "regularExercise_Y", "label": "예", "value": "Y"},
                                    {"id": "regularExercise_N", "label": "아니오", "value": "N"}
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                "id": "diet-habits",
                "title": "여섯번째, 생활습관 중 식생활",
                "subtitle": "평소 식생활 습관에 대해 알려주세요",
                "sections": [
                    {
                        "id": "diet-section",
                        "title": "",
                        "subtitle": "선택해주세요",
                        "questions": [
                            {
                                "id": "livingHabits_regularEatingHabitYN",
                                "title": "규칙적인 식사",
                                "subtitle": "하루 세끼를 규칙적으로 드시나요?",
                                "type": "radio",
                                "required": True,
                                "options": [
                                    {"id": "regularEating_Y", "label": "예", "value": "Y"},
                                    {"id": "regularEating_N", "label": "아니오", "value": "N"}
                                ]
                            },
                            {
                                "id": "livingHabits_balancedDietYN",
                                "title": "균형잡힌 식단",
                                "subtitle": "다양한 음식을 골고루 드시나요?",
                                "type": "radio",
                                "required": True,
                                "options": [
                                    {"id": "balancedDiet_Y", "label": "예", "value": "Y"},
                                    {"id": "balancedDiet_N", "label": "아니오", "value": "N"}
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                "id": "stress-status",
                "title": "일곱번째, 스트레스",
                "subtitle": "평소 스트레스를 어느 정도 느끼고 계신가요?",
                "sections": [
                    {
                        "id": "stress-section",
                        "title": "",
                        "subtitle": "선택해주세요",
                        "questions": [
                            {
                                "id": "stress_stressStatusCode",
                                "title": "스트레스 정도",
                                "type": "radio",
                                "required": True,
                                "options": [
                                    {"id": "stress_1", "label": "대단히 많이", "value": "1"},
                                    {"id": "stress_2", "label": "많이", "value": "2"},
                                    {"id": "stress_3", "label": "조금", "value": "3"},
                                    {"id": "stress_4", "label": "거의 없음", "value": "4"}
                                ]
                            },
                            {
                                "id": "stress_stressRootCauseCode",
                                "title": "스트레스의 주된 원인",
                                "type": "radio",
                                "showIf": {"questionId": "stress_stressStatusCode", "value": ["1", "2"]},
                                "options": [
                                    {"id": "stressCause_1", "label": "일 또는 금전", "value": "1"},
                                    {"id": "stressCause_2", "label": "대인관계", "value": "2"},
                                    {"id": "stressCause_3", "label": "일상생활", "value": "3"},
                                    {"id": "stressCause_4", "label": "갑작스러운 사고", "value": "4"}
                                ]
                            }
                        ]
                    }
                ]
            }
]

# 설문조사 더미데이터 (현아 기반)
SURVEYS_DATA = {
    "health-questionnaire": {
        "id": "health-questionnaire",
        "title": "건강 설문조사",
        "description": "귀하의 건강 상태를 파악하기 위한 설문조사입니다",
        "pages": HYUNA_SURVEY_PAGES,
        "settings": {
            "allowBack": True,
            "autoSave": True,
            "showProgress": True
        }
    },
    "checkup-design": {
        "id": "checkup-design", 
        "title": "올해 검진 항목 설계",
        "description": "맞춤형 검진 프로그램을 설계해보세요",
        "pages": HYUNA_SURVEY_PAGES,  # 현아 기반 전체 설문조사 사용
        "settings": {
            "allowBack": True,
            "autoSave": True,
            "showProgress": True
        }
    },
    "health-habits": {
        "id": "health-habits",
        "title": "검진전 건강습관만들기", 
        "description": "검진 전 건강습관을 분석해보세요",
        "pages": HYUNA_SURVEY_PAGES,  # 현아 기반 전체 설문조사 사용
        "settings": {
            "allowBack": True,
            "autoSave": True,
            "showProgress": True
        }
    },
    "disease-prediction": {
        "id": "disease-prediction",
        "title": "질병 예측 리포트",
        "description": "AI 질병 예측 분석을 위한 설문조사입니다",
        "pages": HYUNA_SURVEY_PAGES,  # 현아 기반 전체 설문조사 사용
        "settings": {
            "allowBack": True,
            "autoSave": True,
            "showProgress": True
        }
    }
}

# 설문조사 응답 저장용 데이터
SURVEY_RESPONSES_DATA = {}

# 빈 데이터 (추후 확장용)
CHECKUP_RESULTS_DATA = {}
USER_SESSIONS_DATA = {}
