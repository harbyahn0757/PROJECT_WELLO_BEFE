"""
설문조사 구조 데이터 정의
"""
from typing import Dict, Any

# 공통 설정
DEFAULT_SETTINGS = {
    "allowBack": True,
    "autoSave": True,
    "showProgress": True
}

# 1. 건강 설문조사 (페르소나 판정용 - 8개 핵심 카테고리)
HEALTH_QUESTIONNAIRE = {
    "id": "health-questionnaire",
    "title": "정밀 건강 문진",
    "description": "귀하의 건강 상태와 생활 습관을 분석하여 맞춤형 관리를 제안합니다.",
    "pages": [
        {
            "id": "history-page",
            "title": "질환 및 가족력",
            "subtitle": "본인과 가족의 건강 이력을 알려주세요.",
            "sections": [
                {
                    "id": "family-history-section",
                    "title": "가족력",
                    "subtitle": "부모, 형제, 자매 중 해당 질환이 있나요?",
                    "questions": [
                        {
                            "id": "family-history",
                            "title": "가족력 선택",
                            "type": "checkbox",
                            "required": True,
                            "options": [
                                {"id": "cancer", "label": "암", "value": "cancer"},
                                {"id": "stroke", "label": "뇌졸중", "value": "stroke"},
                                {"id": "heart", "label": "심장질환", "value": "heart_disease"},
                                {"id": "hypertension", "label": "고혈압", "value": "hypertension"},
                                {"id": "diabetes", "label": "당뇨병", "value": "diabetes"},
                                {"id": "none", "label": "해당없음", "value": "none", "isNone": True}
                            ]
                        }
                    ]
                },
                {
                    "id": "personal-history-section",
                    "title": "과거력",
                    "subtitle": "현재 치료 중이거나 과거에 앓았던 질환이 있나요?",
                    "questions": [
                        {
                            "id": "personal-history",
                            "title": "과거력 선택",
                            "type": "checkbox",
                            "required": True,
                            "options": [
                                {"id": "p-cancer", "label": "암", "value": "cancer"},
                                {"id": "p-stroke", "label": "뇌졸중", "value": "stroke"},
                                {"id": "p-heart", "label": "심장질환", "value": "heart_disease"},
                                {"id": "p-hypertension", "label": "고혈압", "value": "hypertension"},
                                {"id": "p-diabetes", "label": "당뇨병", "value": "diabetes"},
                                {"id": "p-none", "label": "해당없음", "value": "none", "isNone": True}
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "lifestyle-page-1",
            "title": "생활 습관 (1)",
            "subtitle": "평소의 생활 패턴을 알려주세요.",
            "sections": [
                {
                    "id": "routine-section",
                    "title": "일과 패턴",
                    "questions": [
                        {
                            "id": "daily_routine",
                            "title": "평소 일과 중 해당하는 것을 선택하세요 (중복 가능)",
                            "type": "checkbox",
                            "required": True,
                            "options": [
                                {"id": "desk", "label": "주로 앉아서 업무 (모니터 집중)", "value": "desk_job"},
                                {"id": "stress", "label": "정신적 압박이 큰 의사결정 업무", "value": "mental_stress"},
                                {"id": "service", "label": "사람을 상대하는 서비스/영업직", "value": "service_job"},
                                {"id": "physical", "label": "몸을 많이 쓰는 현장/기술직", "value": "physical_job"},
                                {"id": "irregular", "label": "밤낮이 바뀌거나 식사가 불규칙함", "value": "irregular"},
                                {"id": "home", "label": "가사 노동 또는 휴식 중", "value": "home_maker"}
                            ]
                        }
                    ]
                },
                {
                    "id": "weight-section",
                    "title": "체중 변화",
                    "questions": [
                        {
                            "id": "weight_change",
                            "title": "최근 6개월간 체중 변화는 어떠했나요?",
                            "type": "radio",
                            "required": True,
                            "options": [
                                {"id": "w-maintain", "label": "거의 변화 없음", "value": "maintain"},
                                {"id": "w-inc-1", "label": "조금 쪘음 (1~3kg)", "value": "increase_some"},
                                {"id": "w-inc-3", "label": "많이 쪘음 (3kg 이상)", "value": "increase_more"},
                                {"id": "w-dec-diet", "label": "다이어트로 감량함", "value": "decrease_good"},
                                {"id": "w-dec-bad", "label": "의도치 않게 빠짐 (3kg 이상)", "value": "decrease_bad"}
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "lifestyle-page-2",
            "title": "생활 습관 (2)",
            "subtitle": "음주, 흡연, 수면에 대한 질문입니다.",
            "sections": [
                {
                    "id": "smoking-section",
                    "title": "흡연",
                    "questions": [
                        {
                            "id": "smoking",
                            "title": "현재 흡연 상태는?",
                            "type": "radio",
                            "required": True,
                            "options": [
                                {"id": "s-never", "label": "비흡연 (평생 안 함)", "value": "non_smoker"},
                                {"id": "s-ex", "label": "과거에 피웠으나 현재 금연 중", "value": "ex_smoker"},
                                {"id": "s-current", "label": "현재 흡연 중", "value": "current_smoker"}
                            ]
                        }
                    ]
                },
                {
                    "id": "drinking-section",
                    "title": "음주",
                    "questions": [
                        {
                            "id": "drinking",
                            "title": "술을 얼마나 자주 드시나요?",
                            "type": "radio",
                            "required": True,
                            "options": [
                                {"id": "d-never", "label": "거의 안 함 (비음주)", "value": "never"},
                                {"id": "d-social", "label": "월 1~2회 정도", "value": "monthly_1_2"},
                                {"id": "d-weekly-1", "label": "주 1~2회", "value": "weekly_1_2"},
                                {"id": "d-weekly-3", "label": "주 3회 이상 (애주가)", "value": "weekly_3plus"}
                            ]
                        }
                    ]
                },
                {
                    "id": "sleep-section",
                    "title": "수면",
                    "questions": [
                        {
                            "id": "sleep_hours",
                            "title": "하루 평균 수면 시간은?",
                            "type": "radio",
                            "required": True,
                            "options": [
                                {"id": "sl-5", "label": "5시간 미만 (매우 부족)", "value": "less_5"},
                                {"id": "sl-6", "label": "5~6시간 (부족)", "value": "5_6"},
                                {"id": "sl-7", "label": "6~7시간 (보통)", "value": "6_7"},
                                {"id": "sl-8", "label": "7~8시간 (충분)", "value": "7_8"},
                                {"id": "sl-9", "label": "8시간 이상", "value": "more_8"}
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "pnt-trigger-page",
            "title": "기타 및 관심사",
            "subtitle": "마지막으로 궁금한 점을 알려주세요.",
            "sections": [
                {
                    "id": "concerns-section",
                    "title": "관심사",
                    "questions": [
                        {
                            "id": "additional_concerns",
                            "title": "현재 가장 걱정되는 건강 증상이나 궁금한 점을 자유롭게 적어주세요.",
                            "type": "input",
                            "inputType": "text",
                            "placeholder": "예: 최근 부쩍 피곤하고 눈이 침침해요."
                        }
                    ]
                },
                {
                    "id": "colonoscopy-section",
                    "title": "내시경 경험",
                    "questions": [
                        {
                            "id": "colonoscopy_experience",
                            "title": "최근 5년 내 대장내시경을 받아보신 적이 있나요?",
                            "type": "radio",
                            "options": [
                                {"id": "c-yes", "label": "네, 정기적으로 받습니다.", "value": "yes_comfortable"},
                                {"id": "c-yes-hard", "label": "네, 하지만 과정이 힘들었습니다.", "value": "yes_uncomfortable"},
                                {"id": "c-no-afraid", "label": "과정이 무서워(겁나서) 아직 못 받았습니다.", "value": "no_afraid"},
                                {"id": "c-no-never", "label": "아니요, 아직 받아본 적 없습니다.", "value": "no_never"}
                            ]
                        }
                    ]
                }
            ]
        }
    ],
    "settings": DEFAULT_SETTINGS
}

# 2. PNT 정밀 문진 (건기식 상담용)
PNT_SURVEY = {
    "id": "pnt-survey",
    "title": "PNT 정밀 영양 문진",
    "description": "내 몸에 꼭 맞는 정밀 영양 치료와 건강기능식품 설계를 위한 전문 문진입니다.",
    "pages": [
        {
            "id": "pnt-nutrition",
            "title": "영양 및 대사 상태",
            "subtitle": "정밀 영양 분석을 위한 상세 질문입니다.",
            "sections": [
                {
                    "id": "pnt-nutrient-deficiency",
                    "title": "영양 결핍 징후",
                    "questions": [
                        {
                            "id": "pnt_fatigue",
                            "title": "충분히 쉬어도 풀리지 않는 만성 피로가 있나요?",
                            "type": "radio",
                            "options": [
                                {"id": "pf-1", "label": "매일 느낀다", "value": "daily"},
                                {"id": "pf-2", "label": "자주 느낀다", "value": "often"},
                                {"id": "pf-3", "label": "가끔 느낀다", "value": "sometimes"},
                                {"id": "pf-4", "label": "거의 없다", "value": "none"}
                            ]
                        },
                        {
                            "id": "pnt_skin_condition",
                            "title": "피부가 건조하거나 염증이 자주 생기나요?",
                            "type": "radio",
                            "options": [
                                {"id": "ps-1", "label": "네, 심한 편입니다", "value": "severe"},
                                {"id": "ps-2", "label": "약간 그런 편입니다", "value": "mild"},
                                {"id": "ps-3", "label": "아니요, 괜찮습니다", "value": "good"}
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "pnt-toxicity",
            "title": "독소 및 해독 기능",
            "sections": [
                {
                    "id": "pnt-detox",
                    "title": "해독 능력 평가",
                    "questions": [
                        {
                            "id": "pnt_digestive_issue",
                            "title": "가스가 자주 차거나 소화가 잘 안 되나요?",
                            "type": "radio",
                            "options": [
                                {"id": "pd-1", "label": "항상 그렇다", "value": "always"},
                                {"id": "pd-2", "label": "식후에 자주 그렇다", "value": "after_meal"},
                                {"id": "pd-3", "label": "거의 없다", "value": "none"}
                            ]
                        },
                        {
                            "id": "pnt_chemical_sensitivity",
                            "title": "강한 향수나 담배 연기에 민감하게 반응하나요?",
                            "type": "radio",
                            "options": [
                                {"id": "pc-1", "label": "매우 민감하다 (어지러움 등)", "value": "very_sensitive"},
                                {"id": "pc-2", "label": "약간 민감하다", "value": "mild_sensitive"},
                                {"id": "pc-3", "label": "보통이다", "value": "normal"}
                            ]
                        }
                    ]
                }
            ]
        }
    ],
    "settings": DEFAULT_SETTINGS
}

# 설문조사 맵핑
SURVEY_MAP = {
    "health-questionnaire": HEALTH_QUESTIONNAIRE,
    "health-habits": HEALTH_QUESTIONNAIRE, # 일원화
    "pnt-survey": PNT_SURVEY,
    "checkup-design": HEALTH_QUESTIONNAIRE # 일원화
}

def get_survey_data(survey_id: str) -> Dict[str, Any]:
    return SURVEY_MAP.get(survey_id, HEALTH_QUESTIONNAIRE)
