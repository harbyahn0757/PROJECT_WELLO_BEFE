"""
채팅 세션 자동 태깅 서비스

대화 완료 후 비동기로 호출되어 interest_tags, risk_tags, sentiment 등을 자동 분석하고 DB에 저장합니다.
LLM(Gemini Flash Lite)을 사용하여 요약/감정/관심사를 분석하며, 실패 시 규칙 기반으로 폴백합니다.
"""

import logging
import json
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime

from ..core.database import db_manager
from ..core.config import settings

logger = logging.getLogger(__name__)


# ─── 관심사 키워드 사전 (규칙 기반 폴백용) ─────────────────────────

INTEREST_KEYWORDS: Dict[str, List[str]] = {
    "다이어트": ["다이어트", "살", "체중", "비만", "BMI", "감량"],
    "혈압": ["혈압", "고혈압", "저혈압", "수축기", "이완기", "맥박"],
    "당뇨": ["당뇨", "혈당", "공복혈당", "인슐린", "HbA1c", "당화혈색소", "A1c"],
    "간기능": ["간", "AST", "ALT", "감마", "GGT", "지방간", "간수치", "GTP"],
    "콜레스테롤": ["콜레스테롤", "중성지방", "HDL", "LDL", "이상지질"],
    "신장": ["신장", "크레아티닌", "사구체", "GFR", "콩팥", "신기능", "요산"],
    "암": ["암", "종양", "용종", "조직검사"],
    "위장": ["위", "위내시경", "위암", "헬리코박터", "역류"],
    "갑상선": ["갑상선", "TSH", "T3", "T4"],
    "빈혈": ["빈혈", "혈색소", "헤모글로빈", "철분", "적혈구"],
    "심장": ["심장", "심전도", "부정맥", "협심증"],
    "폐": ["폐", "흉부", "X-ray", "결핵"],
    "검진종류": ["유방", "내시경", "초음파", "CT", "MRI", "X선", "촬영"],
}

# 대화 의도 분류 키워드 (1차 전처리용)
INTENT_KEYWORDS: Dict[str, List[str]] = {
    "ux_issue": ["출력", "클릭", "로딩", "안 돼", "안됩니다", "오류", "에러",
                 "페이지", "화면", "버튼", "다운로드", "안 열", "먹통", "렉"],
    "greeting": ["안녕", "반갑", "처음", "시작", "하이", "헬로"],
}

# 세그먼트별 권장 액션 매핑
PROSPECT_ACTION_MAP: Dict[str, str] = {
    "needs_visit": "위험수치 확인, 진료 예약 권유",
    "borderline_worried": "경계수치 상담 권유",
    "chronic_management": "정기 관리 프로그램 안내",
    "lifestyle_improvable": "생활습관 개선 정보 제공",
    "low_engagement": "재참여 유도 메시지 발송",
    "uncertain": "수동 검토 후 분류 결정",
}

# 감정 키워드 사전 (규칙 기반 폴백용)
SENTIMENT_KEYWORDS: Dict[str, List[str]] = {
    "positive": ["감사", "고마워", "좋아", "좋겠", "도움", "이해", "알겠", "고맙", "감사합니다", "안심", "다행", "잘 됐", "넘 좋"],
    "negative": ["싫", "아닌데", "틀렸", "이상해", "불만", "화나", "짜증", "왜 안", "안 돼", "못 해", "에러", "오류"],
    "confused": ["모르겠", "어렵", "복잡", "이해가 안", "무슨 말", "뭔소리", "왜", "어떻게", "뭐지", "이상하게"],
    "curious": ["궁금", "알고 싶", "어떤", "기준이", "정상인가", "괜찮은"],
    "worried": ["걱정", "불안", "심각", "위험", "의심", "나빠"],
}

# 검진 데이터 품질 평가용 필수 필드
QUALITY_REQUIRED_FIELDS = [
    "height", "weight", "bmi",
    "systolic_bp", "diastolic_bp",
    "fasting_glucose",
    "total_cholesterol", "hdl_cholesterol", "ldl_cholesterol",
    "hemoglobin", "sgot_ast", "sgpt_alt", "gamma_gtp",
    "creatinine", "gfr",
]

# 위험도 심각도 키워드
RISK_SEVERITY_HIGH = ["위험", "이상", "질환의심"]
RISK_SEVERITY_MEDIUM = ["경계", "주의필요", "주의", "전단계"]

# 식단·영양제 키워드
NUTRITION_KEYWORDS: Dict[str, List[str]] = {
    "식단관리": ["식단", "식사", "음식", "먹", "섭취", "칼로리", "탄수화물", "저염", "저당"],
    "영양제": ["영양제", "비타민", "오메가", "유산균", "프로바이오틱", "철분제", "칼슘", "마그네슘", "아연", "보충제"],
    "다이어트식단": ["다이어트", "감량", "체중조절", "저탄고지", "간헐적단식"],
    "운동": ["운동", "걷기", "헬스", "유산소", "근력", "스트레칭"],
}

# 행동 의향 키워드
ACTION_INTENT_ACTIVE = ["가볼게", "가봐야", "예약", "병원", "방문", "검사받", "해볼게", "시작", "실천", "바꿔"]
ACTION_INTENT_CONSIDERING = ["고민", "생각", "고려", "해볼까", "할까", "괜찮을까", "어떨까"]

# 구매 신호 키워드 (Commerce 파이프라인)
BUYING_SIGNAL_HIGH = ["가격", "얼마", "어디서 사", "구매", "주문", "추천해", "제품", "살 수 있"]
BUYING_SIGNAL_MID = ["영양제", "보충제", "밀크씨슬", "오메가", "프로바이오틱", "비교"]

# 의학적 관심사 → 상품 카테고리 매핑
COMMERCIAL_MAPPING = {
    "간기능": {"category": "간건강", "product_hint": "밀크씨슬"},
    "콜레스테롤": {"category": "심혈관", "product_hint": "오메가3"},
    "당뇨": {"category": "혈당관리", "product_hint": "바나바잎추출물"},
    "혈압": {"category": "혈압관리", "product_hint": "코엔자임Q10"},
    "빈혈": {"category": "조혈", "product_hint": "철분제"},
    "위장": {"category": "소화건강", "product_hint": "프로바이오틱"},
    "다이어트": {"category": "체중관리", "product_hint": "가르시니아"},
}

# 검진 수치 한글 라벨 (LLM 프롬프트용)
METRIC_LABELS = {
    "systolic_bp": "수축기 혈압", "diastolic_bp": "이완기 혈압",
    "fasting_glucose": "공복혈당", "total_cholesterol": "총콜레스테롤",
    "hdl_cholesterol": "HDL", "ldl_cholesterol": "LDL",
    "hemoglobin": "헤모글로빈", "sgot_ast": "AST(간수치)",
    "sgpt_alt": "ALT(간수치)", "gamma_gtp": "감마GTP",
    "creatinine": "크레아티닌", "gfr": "사구체여과율(GFR)",
    "bmi": "BMI", "triglycerides": "중성지방",
    "height": "신장", "weight": "체중",
}

# 설문 항목 한글 라벨
SURVEY_LABELS = {
    "exercise_frequency": "운동", "smoking": "흡연",
    "alcohol": "음주", "sleep_quality": "수면",
    "stress_level": "스트레스",
}


def _format_health_data_for_prompt(
    health_metrics: Dict[str, Any],
    patient_info: Optional[Dict[str, Any]] = None,
    medical_history: Optional[list] = None,
) -> str:
    """검진 수치 + 환자 프로필 + 병력을 LLM-readable 텍스트로 변환."""
    sections = []

    # 환자 프로필
    if patient_info:
        age_str = ""
        if patient_info.get("birth_date"):
            try:
                bd = datetime.strptime(str(patient_info["birth_date"])[:10], "%Y-%m-%d")
                today = datetime.now()
                age = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
                age_str = f"{age}세"
            except Exception:
                pass
        gender_map = {"M": "남성", "F": "여성", "male": "남성", "female": "여성"}
        gender_str = gender_map.get(patient_info.get("gender", ""), "")
        if age_str or gender_str:
            sections.append(f"[환자 프로필]\n나이: {age_str or '미상'}, 성별: {gender_str or '미상'}")

    # 검진 데이터
    if health_metrics:
        checkup_date = health_metrics.get("checkup_date", "")
        header = f"[검진 데이터]{f' (검진일: {checkup_date})' if checkup_date else ''}"
        lines = []
        for key, label in METRIC_LABELS.items():
            val = health_metrics.get(key)
            if val is None or val == "" or val == 0:
                continue
            range_val = health_metrics.get(f"{key}_range", "")
            abnormal = health_metrics.get(f"{key}_abnormal", "정상")
            range_part = f" (기준: {range_val})" if range_val else ""
            lines.append(f"{label}: {val}{range_part} → {abnormal}")
        if lines:
            sections.append(header + "\n" + "\n".join(lines))

    # 병력
    if medical_history:
        history_text = ", ".join(str(h) for h in medical_history if h)
        sections.append(f"[병력]\n{history_text}" if history_text else "[병력]\n(해당 사항 없음)")

    return "\n\n".join(sections)


# ─── 서제스천 생성 (태깅 연동) ───────────────────────────────────

def extract_health_alerts(health_metrics: Dict[str, Any]) -> List[Dict[str, str]]:
    """검진 데이터에서 이상 항목 추출 (서제스천 개인화용)."""
    alerts = []
    if not health_metrics:
        return alerts
    for key, label in METRIC_LABELS.items():
        abnormal = health_metrics.get(f"{key}_abnormal", "")
        if abnormal and abnormal != "정상":
            val = health_metrics.get(key)
            alerts.append({"field": key, "label": label, "value": str(val or ""), "judgment": abnormal})
    return alerts


# 파트너별 서제스천 방향 — 구체적 질문은 모델이 맥락에서 생성
# hospital: 가볍게 관리할 수 있다는 맥락에서 재방문 유도
# commerce: 식단/영양/생활습관 관심 자연스럽게 확장
# healthcare: 수치 이해 + 일상 실천 방향
_PARTNER_DIRECTION = {
    "hospital": (
        "서제스천 방향: 환자가 검진 수치를 이해하고 가볍게 관리해볼 수 있는 질문.\n"
        "수치 간 연관성, 관리 주기, 생활에서 개선 가능한 부분 등.\n"
        "병원 방문/진단/겁주기 식 질문은 피하세요 — 환자가 알아서 물어봅니다."
    ),
    "commerce": (
        "서제스천 방향: 식단, 영양소, 생활습관 개선으로 자연스럽게 확장하는 질문.\n"
        "어떤 음식/영양소가 도움 되는지, 일상에서 실천 가능한 방법 등.\n"
        "상품 추천이나 구매 유도 느낌은 절대 내지 마세요."
    ),
    "healthcare": (
        "서제스천 방향: 수치의 의미를 쉽게 이해하고 생활습관과 연결하는 질문.\n"
        "이상 항목 간 관계, 운동/식단 실천법, 다른 항목 확인 등."
    ),
}


def build_suggestion_instruction(
    turn_number: int,
    health_alerts: Optional[List[Dict[str, str]]] = None,
    partner_type: str = "healthcare",
) -> str:
    """파트너 방향 + 이상 항목 + 턴 깊이별 가이드, 구체적 질문은 모델이 생성."""
    pt = partner_type if partner_type in _PARTNER_DIRECTION else "healthcare"

    # 턴 깊이별 서제스천 방향 차별화
    if turn_number <= 1:
        depth_guide = "초반 대화입니다. 넓은 건강 주제를 탐색하는 질문을 생성하세요. (예: 다른 수치 궁금, 전체 요약 등)"
    elif turn_number <= 3:
        depth_guide = "대화 중반입니다. 이전 대화 맥락을 반영하여 더 구체적인 후속 질문을 생성하세요. (예: 식습관, 운동, 생활습관 등)"
    else:
        depth_guide = "대화 후반입니다. 구체적인 행동 제안이나 병원 방문 유도 질문을 생성하세요. (예: 재검 시기, 관리 방법, 전문의 상담 등)"

    lines = [
        "[서제스천 생성 규칙]",
        "답변 마지막에 반드시 후속 질문 3개를 아래 형식으로 생성하세요.",
        "형식: [SUGGESTIONS] 질문1 | 질문2 | 질문3 [/SUGGESTIONS]",
        "각 질문은 20자 이내, 경어체.",
        "",
        depth_guide,
        "",
        # P1-A4: 3종 CTA 패턴 (후킹 다양화 — 5/3+5/4 사용자 평가 '교과서적' 대응)
        # 3개 질문은 가급적 아래 3 방향에서 1개씩 골고루 (단조로움 차단)",
        "[3종 CTA 패턴 — 가급적 1개씩 분배]",
        "  1) 수치 깊이형 — 예: 'OO 수치가 왜 이 범위인지 궁금하신가요?'",
        "  2) 생활습관형 — 예: '식단으로 개선하는 방법 알아볼까요?'",
        "  3) 병원 연계형 — 예: '검진기관에 문의할 사항 정리해 드릴까요?'",
        "",
        _PARTNER_DIRECTION[pt],
    ]

    if health_alerts:
        top = health_alerts[:3]
        items_str = ", ".join(f"{a['label']}({a['judgment']})" for a in top)
        lines.append(f"\n환자의 이상 항목: {items_str}")

    return "\n".join(lines)


_FALLBACK_TEMPLATES = {
    1: [
        "전체 검진 결과 요약해줘",
        "이상 있는 항목만 알려줘",
        "생활습관 조언해줘",
    ],
    2: [
        "{topic} 더 자세히 알고 싶어요",
        "다른 이상 항목은 없나요?",
        "생활습관으로 개선할 수 있나요?",
    ],
    3: [
        "{topic} 수치 기준이 궁금해요",
        "다음 검진은 언제 받으면 좋을까요?",
        "핵심만 정리해줄 수 있나요?",
    ],
}


def generate_fallback_suggestions(
    turn_count: int,
    health_alerts: Optional[List[Dict[str, str]]] = None,
    last_answer_topic: str = "",
) -> List[str]:
    """모델이 서제스천을 생략했을 때 룰 기반 폴백."""
    key = min(turn_count, 3)
    templates = _FALLBACK_TEMPLATES.get(key, _FALLBACK_TEMPLATES[3])

    topic = last_answer_topic or "검진 결과"
    if health_alerts and not last_answer_topic:
        topic = health_alerts[0]["label"]

    return [t.format(topic=topic) for t in templates]


# ─── 규칙 기반 함수 (폴백용으로 유지) ──────────────────────────────

def extract_interest_tags(messages: List[Dict[str, str]]) -> List[str]:
    """사용자 메시지에서 관심사 태그 추출"""
    user_text = " ".join(
        m.get("content", "") for m in messages if m.get("role") == "user"
    )
    tags = []
    for tag, keywords in INTEREST_KEYWORDS.items():
        if any(kw in user_text for kw in keywords):
            tags.append(tag)
    return tags


def extract_risk_tags(health_metrics: Dict[str, Any]) -> List[str]:
    """health_metrics의 *_abnormal 필드에서 비정상 항목 추출"""
    risks = []
    if not health_metrics:
        return risks
    for key, val in health_metrics.items():
        if key.endswith("_abnormal") and val and val != "정상":
            metric_name = key.replace("_abnormal", "")
            risks.append(f"{metric_name}_{val}")
    return risks


def calculate_risk_level(risk_tags: List[str]) -> str:
    """risk_tags에서 심각도 키워드 기반으로 위험도 산출"""
    if not risk_tags:
        return "low"
    high_count = 0
    medium_count = 0
    for tag in risk_tags:
        if any(kw in tag for kw in RISK_SEVERITY_HIGH):
            high_count += 1
        elif any(kw in tag for kw in RISK_SEVERITY_MEDIUM):
            medium_count += 1
        else:
            medium_count += 1
    total = high_count + medium_count
    if high_count >= 1 or total >= 5:
        return "high"
    elif medium_count >= 2 or total >= 2:
        return "medium"
    return "low"


def calculate_engagement(messages: List[Dict[str, str]]) -> tuple:
    """(conversation_depth, engagement_score) 반환"""
    user_msgs = [m["content"] for m in messages if m.get("role") == "user"]
    if not user_msgs:
        return ("shallow", 0)

    # 주제별 언급 횟수 카운트
    topic_counts = {}
    for msg in user_msgs:
        for tag, keywords in INTEREST_KEYWORDS.items():
            if any(kw in msg for kw in keywords):
                topic_counts[tag] = topic_counts.get(tag, 0) + 1

    # engagement_score 개선: 질문 구체성 + 메시지 길이 반영
    repeat_topics = sum(1 for c in topic_counts.values() if c >= 2)
    total_mentions = sum(topic_counts.values())
    question_specificity = len(topic_counts)  # 매칭된 키워드 카테고리 수

    # 평균 메시지 길이 보너스 (긴 질문 = 더 진지한 관심)
    avg_msg_len = sum(len(m) for m in user_msgs) / len(user_msgs)
    if avg_msg_len >= 50:
        avg_msg_length_bonus = 20
    elif avg_msg_len >= 20:
        avg_msg_length_bonus = 10
    else:
        avg_msg_length_bonus = 0

    score = min(100,
        (repeat_topics * 25) +
        (total_mentions * 5) +
        (len(user_msgs) * 10) +           # 3→10 (메시지당 가중치 상향)
        (question_specificity * 8) +       # 키워드 매칭 보너스
        avg_msg_length_bonus               # 긴 질문 보너스
    )

    # depth: 2회 이상 반복 주제가 있으면 deep, 구체적 질문 있으면 moderate
    if repeat_topics >= 2 or (repeat_topics >= 1 and len(user_msgs) >= 4):
        depth = "deep"
    elif total_mentions >= 2 or len(user_msgs) >= 3:
        depth = "moderate"
    else:
        depth = "shallow"

    return (depth, score)


def extract_nutrition_tags(messages: List[Dict[str, str]]) -> List[str]:
    """식단·영양제 관심 키워드 추출"""
    user_text = " ".join(m.get("content", "") for m in messages if m.get("role") == "user")
    tags = []
    for tag, keywords in NUTRITION_KEYWORDS.items():
        if any(kw in user_text for kw in keywords):
            tags.append(tag)
    return tags


def detect_action_intent(messages: List[Dict[str, str]]) -> str:
    """행동 의향 판별"""
    user_text = " ".join(m.get("content", "") for m in messages if m.get("role") == "user")
    if any(kw in user_text for kw in ACTION_INTENT_ACTIVE):
        return "active"
    elif any(kw in user_text for kw in ACTION_INTENT_CONSIDERING):
        return "considering"
    return "passive"


def extract_keyword_tags(messages: List[Dict[str, str]]) -> List[str]:
    """수검자(환자) 메시지에서 핵심 키워드 태그 추출 (AI 응답은 제외)"""
    user_text = " ".join(
        m.get("content", "") for m in messages if m.get("role") == "user"
    )
    matched = set()
    for keywords in INTEREST_KEYWORDS.values():
        for kw in keywords:
            if kw in user_text:
                matched.add(kw)
    return list(matched)[:20]  # 최대 20개


def extract_buying_signal(messages: List[Dict[str, str]]) -> str:
    """구매 신호 규칙 기반 판별"""
    user_text = " ".join(m.get("content", "") for m in messages if m.get("role") == "user")
    if any(kw in user_text for kw in BUYING_SIGNAL_HIGH):
        return "high"
    if any(kw in user_text for kw in BUYING_SIGNAL_MID):
        return "mid"
    return "low"


def extract_commercial_tags(interest_tags: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """관심사 태그에서 상품 카테고리 매핑 (규칙 기반)"""
    tags = []
    seen = set()
    for tag in interest_tags:
        topic = tag.get("topic", "") if isinstance(tag, dict) else str(tag)
        for key, mapping in COMMERCIAL_MAPPING.items():
            if key in topic and mapping["category"] not in seen:
                intensity = tag.get("intensity", "medium") if isinstance(tag, dict) else "medium"
                segment = "고관여" if intensity == "high" else "일반"
                tags.append({
                    "category": mapping["category"],
                    "product_hint": mapping["product_hint"],
                    "segment": segment,
                })
                seen.add(mapping["category"])
    return tags


def detect_sentiment(messages: List[Dict[str, str]]) -> str:
    """사용자 마지막 메시지 기반 감정 판별"""
    user_messages = [m for m in messages if m.get("role") == "user"]
    if not user_messages:
        return "neutral"
    last_msg = user_messages[-1].get("content", "")

    for sentiment, keywords in SENTIMENT_KEYWORDS.items():
        if any(kw in last_msg for kw in keywords):
            return sentiment
    return "neutral"


def classify_conversation_intent(messages: List[Dict[str, str]]) -> str:
    """대화 의도 1차 분류: health_question / ux_issue / greeting / off_topic.
    비건강 대화를 LLM 태깅 전에 걸러서 비용 절감 + 잘못된 태깅 방지."""
    user_msgs = [m.get("content", "") for m in messages if m.get("role") == "user"]
    if not user_msgs:
        return "off_topic"

    all_text = " ".join(user_msgs)

    # 1턴 + 짧은 메시지 → 인사 체크
    if len(user_msgs) == 1 and len(user_msgs[0]) < 15:
        if any(kw in all_text for kw in INTENT_KEYWORDS["greeting"]):
            return "greeting"

    # UX/기능 질문 체크
    ux_hits = sum(1 for kw in INTENT_KEYWORDS["ux_issue"] if kw in all_text)
    health_hits = sum(
        1 for tags in INTEREST_KEYWORDS.values()
        for kw in tags if kw in all_text
    )

    if ux_hits >= 1 and health_hits == 0:
        return "ux_issue"

    # 건강검진 RAG 채팅 맥락 — 기본값은 health_question
    # "알려줘", "읽어주세요", "이상있다고 문의" 등 키워드 없어도 건강 상담임
    return "health_question"


def calculate_data_quality_score(health_metrics: Dict[str, Any]) -> int:
    """검진 데이터 완성도 점수 (0-100)"""
    if not health_metrics:
        return 0
    valid_count = 0
    for field in QUALITY_REQUIRED_FIELDS:
        val = health_metrics.get(field)
        if val is not None and val != 0 and val != "" and val != "0":
            valid_count += 1
    return int((valid_count / len(QUALITY_REQUIRED_FIELDS)) * 100)


async def generate_conversation_summary(messages: List[Dict[str, str]]) -> str:
    """대화 내용을 1-2문장으로 요약 (간이 버전 -- LLM 없이 규칙 기반)"""
    user_messages = [m.get("content", "") for m in messages if m.get("role") == "user"]
    if not user_messages:
        return ""
    # 첫 질문 + 마지막 질문을 조합
    first_q = user_messages[0][:60]
    if len(user_messages) > 1:
        last_q = user_messages[-1][:60]
        return f"첫 질문: {first_q} / 마지막 질문: {last_q} (총 {len(user_messages)}회 질문)"
    return f"질문: {first_q}"


# ─── LLM 기반 분석 (Gemini Flash Lite) ─────────────────────────────

async def llm_analyze_session(
    messages: List[Dict[str, str]],
    health_metrics: Optional[Dict[str, Any]] = None,
    patient_info: Optional[Dict[str, Any]] = None,
    medical_history: Optional[list] = None,
    survey_data: Optional[Dict[str, Any]] = None,
    es_behavior: Optional[Dict[str, Any]] = None,
) -> tuple[Optional[Dict[str, Any]], str]:
    """
    Gemini Flash Lite를 사용하여 대화 세션을 분석합니다.
    v3: 검진수치 + 환자프로필 + 병력 + 설문 + ES행동 + 대화패턴 멀티채널 통합.

    Returns:
        (result, error_reason) 튜플.
        - result: {summary, sentiment, interest_tags, ...} 또는 실패 시 None
        - error_reason: "" (성공), "api_key_missing", "json_parse_error",
          "invalid_response", "api_error:{msg}"
    """
    try:
        # llm_router 경유 — Gemini 우선 시도 → 실패 시 OpenAI 자동 폴백
        # 즉 DEGRADED/DOWN 상태에서도 OpenAI로 태깅 정상 작동
        from .llm_router import llm_router
        from .gemini_service import GeminiRequest

        # 대화를 순서대로 번호 매겨서 포맷 (흐름 파악 + 화자 구분)
        conv_lines = []
        user_turn = 0
        for i, m in enumerate(messages):
            content = m.get("content", "").strip()
            if not content:
                continue
            if m.get("role") == "user":
                user_turn += 1
                conv_lines.append(f"[환자 질문 #{user_turn}] {content}")
            else:
                conv_lines.append(f"[상담사 답변 #{user_turn}] {content}")

        conversation_text = "\n".join(conv_lines)
        if len(conversation_text) > 2500:
            conversation_text = conversation_text[:2500] + "\n...(이하 생략)"

        total_user_turns = user_turn

        # ── 멀티채널 컨텍스트 구성 (v3) ──
        health_context = _format_health_data_for_prompt(
            health_metrics or {}, patient_info, medical_history)

        survey_context = ""
        if survey_data:
            survey_context = _format_survey_for_prompt(survey_data)

        es_context = ""
        if es_behavior:
            es_lines = ["[이 병원 수검자 행동 요약] (최근 30일)"]
            for label, count in es_behavior.items():
                if count:
                    es_lines.append(f"{label}: {count}")
            if len(es_lines) > 1:
                es_context = "\n".join(es_lines)

        conv_pattern = _format_conversation_pattern(messages)

        # 컨텍스트 블록 조립 (데이터 있는 섹션만 포함 — graceful degradation)
        context_blocks = [b for b in [health_context, survey_context, es_context] if b]
        context_section = "\n\n".join(context_blocks) if context_blocks else "[검진 데이터 없음]"

        prompt = f"""건강상담 대화를 분석합니다. 환자(수검자) 질문과 상담사(AI) 답변이 턴 번호(#)로 구분되어 있습니다.
반드시 아래 규칙을 지켜서 JSON만 출력하세요.

⚠️ 핵심 원칙: interest_tags와 key_concerns는 반드시 [환자 질문]에서만 추출하세요.
[상담사 답변]에서 일방적으로 언급한 건강 주제는 관심사가 아닙니다.
예: 환자가 "혈압이 걱정돼요"라고 했으면 → 혈압은 관심사 ✓
예: 상담사가 "콜레스테롤도 관리하세요"라고 했지만 환자가 언급 안 했으면 → 콜레스테롤은 관심사 ✗

{context_section}

{conv_pattern}

[대화] (총 {total_user_turns}턴)
{conversation_text}

분석 규칙:
- summary: "환자가 ~에 대해 질문하고, 상담사가 ~을 안내함" 형식으로 화자를 구분하여 1-2문장 요약
- sentiment: 환자의 감정만 기준 (상담사 톤 무시). 7가지 중 선택:
  "worried": 건강 걱정/불안 표현, "curious": 궁금해하며 질문, "confused": 결과를 이해 못함/당혹,
  "negative": 불만/짜증, "positive": 감사/안심, "grateful": 고마움 직접 표현, "neutral": 감정 표현 없음.
  주의: "왜 다 이상이야", "이해가 안 돼" 같은 표현은 neutral이 아니라 confused. "궁금해서요", "정상인가요?" 같은 표현은 curious.
- interest_tags: 환자가 직접 물어보거나 걱정한 건강 주제만 추출. 상담사가 일방적으로 언급하거나 안내한 주제는 절대 포함하지 마세요. 각 태그에 관심 강도를 표기:
  - "high": 환자가 후속 질문으로 파고들거나 반복해서 물어본 주제
  - "medium": 환자가 구체적으로 질문한 주제
  - "low": 환자가 가볍게 언급하거나 첫 질문에서만 나온 주제
- key_concerns: 환자가 명시적으로 표현한 걱정/우려만 (상담사 언급 제외)
- risk_level: 상담사 답변과 검진 이상소견을 종합 판단
- follow_up_needed: 상담사가 병원 방문/추가 검사를 권고했으면 true
- counselor_recommendations: 상담사가 제공한 핵심 조언 요약 (최대 3개)
- conversation_depth: 환자 질문 깊이 — deep(같은 주제 2회 이상 파고듦), moderate(구체적 질문), shallow(단순 질문)
- engagement_score: 환자 참여도 점수 0-100 (반복질문, 후속질문, 질문 수 종합)
- action_intent: 환자 행동 의향 — active(병원방문/생활개선 의지 표현), considering(고민중), passive(특별한 의지 없음)
- nutrition_interests: 환자가 관심 보인 식단/영양 주제 (식단관리, 영양제, 운동 등)
- commercial_tags: 환자의 관심사를 상품/서비스 카테고리로 변환. 의학적 관심+위험도 조합으로 타겟 세그먼트 도출.
  예: [간수치 high + 피로 관심] → [{{"category": "간건강", "product_hint": "밀크씨슬", "segment": "고관여"}}]
  관심이 없거나 해당 없으면 빈 배열.
- buying_signal: 대화 중 구매/소비 의향 신호 판단.
  "high": 가격 문의, 제품 추천 요청, 어디서 사는지 질문
  "mid": 영양제/보충제 언급, 비교 질문
  "low": 구매 관련 언급 전혀 없음

응답 JSON:
{{
  "summary": "환자가 ~를 질문하고, 상담사가 ~를 안내함",
  "sentiment": "positive|negative|neutral|worried|grateful|curious|confused 중 하나",
  "interest_tags": [{{"topic": "주제", "intensity": "high|medium|low"}}],
  "risk_level": "low|medium|high",
  "key_concerns": ["환자가 표현한 우려사항 -- 최대 3개"],
  "follow_up_needed": true 또는 false,
  "counselor_recommendations": ["상담사 핵심 조언 -- 최대 3개"],
  "conversation_depth": "deep|moderate|shallow",
  "engagement_score": 0-100,
  "action_intent": "active|considering|passive",
  "nutrition_interests": ["식단관리", "영양제"],
  "commercial_tags": [{{"category": "카테고리", "product_hint": "상품힌트", "segment": "고관여|일반"}}],
  "buying_signal": "high|mid|low",
  "classification_confidence": 0.85
}}

⚠️ classification_confidence 필드는 반드시 포함하세요 (누락 금지):
- 0.3-0.5: 1턴 + 단순 질문, 맥락 부족
- 0.6-0.7: 건강 관련이지만 구체적이지 않음
- 0.8-0.9: 구체적 건강 대화 (증상/수치 언급)
- 0.95-1.0: 명확한 증상 + 수치 + 병명 언급
이 필드가 없으면 분석 결과를 활용할 수 없습니다."""

        # ── 병원 전용 추가 분석 (모든 세션에 항상 포함) ──
        prompt += """

[병원 파트너 전용 — 반드시 추가 분석]
위 JSON에 아래 6개 필드를 추가하세요:
- medical_tags: 의료 관련 키워드만 순수 문자열 배열로 반환. 예: ["혈압", "콜레스테롤", "간"]. interest_tags와 달리 topic/intensity 객체가 아닌 단순 문자열 리스트여야 합니다.
- lifestyle_tags: 생활습관 관련 키워드만 순수 문자열 배열로 반환. 예: ["다이어트", "운동", "식단"]. 단순 문자열 리스트여야 합니다.
- medical_urgency: 검진 이상소견+대화 종합 판단.
  "urgent": 위험수준 수치+증상 언급, "borderline": 경계 수치, "normal": 정상 범위
- anxiety_level: 환자 불안 수준 (적극적으로 판단할 것 — 건강 관련 질문 자체가 걱정의 표현임).
  "high": 걱정/불안 직접 표현, 반복 질문, 증상 호소, "medium": 건강 관련 질문 2회 이상 또는 수치에 대한 우려, "low": 단순 정보 확인 1회
- prospect_type: 병원 전환 5분류. 대화 내용과 검진 수치를 모두 고려하여 판단. 주의: "lifestyle_improvable"은 catch-all이 아님!
  "low_engagement": 1턴 대화 + 구체적 건강 질문 없음 → 인사/단순확인만 하고 이탈
  "needs_visit": 위험수준 수치 + 증상 언급 → 실제 진료 필요
  "borderline_worried": 경계수치이면서 anxiety_level이 medium 이상 → 핵심 전환 대상. 단순 질문 1회만 한 경우는 해당 안됨.
  "lifestyle_improvable": 환자가 식이/운동/생활습관을 직접 언급한 경우만. 단순히 "내 결과 어때?" 수준은 해당 안됨.
  "chronic_management": 만성질환(혈압/당뇨/간) 관련 지속 관리 대화 + 이미 질환을 인지하고 관리 중인 경우
- hospital_prospect_score: 0-100 병원 전환 가망 점수 (urgency+anxiety+engagement 종합)

[종합 교차분석 가이드 — 데이터가 있는 항목만 적용]
- 검진 이상 수치인데 대화에서 해당 항목에 관심 없음 → "무관심 위험" → medical_urgency 상향
- 설문에서 흡연/음주인데 검진 간수치/혈압 이상 → lifestyle_tags에 원인 반영
- 병원 활성 수검자 수가 많으면 → 참여도 높은 병원 → hospital_prospect_score 소폭 가산
- 대화 질문 간격 짧고 + 검진 이상 항목 관련 질문 → anxiety_level 상향
- 검진 이상 + 대화에서 해당 질문 → borderline_worried 우선 고려
- 설문에서 운동 안 함 + BMI 과체중 → lifestyle_tags에 "운동부족+비만" 반영"""

        # llm_router 호출 (Gemini 우선, 실패 시 OpenAI 자동 폴백)
        # response_format=json_object → Gemini는 application/json 강제, OpenAI는 동일 옵션 지원
        llm_resp = await llm_router.call_api(
            GeminiRequest(
                prompt=prompt,
                model=settings.google_gemini_lite_model,
                temperature=0.5,
                max_tokens=2000,
                response_format={"type": "json_object"},
            ),
            endpoint="chat_tagging",
            save_log=False,
        )

        if not llm_resp.success or not llm_resp.content:
            logger.warning("[태깅-LLM] llm_router 응답 실패: %s", llm_resp.error)
            return None, f"api_error:{llm_resp.error or 'no content'}"

        raw_text = llm_resp.content.strip()

        # JSON 파싱 (```json ... ``` 감싸기 대응)
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[-1]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()

        result = json.loads(raw_text)

        # 필드 검증 및 정규화
        valid_sentiments = {"positive", "negative", "neutral", "worried", "grateful", "curious", "confused"}
        if result.get("sentiment") not in valid_sentiments:
            result["sentiment"] = "neutral"

        valid_risk_levels = {"low", "medium", "high"}
        if result.get("risk_level") not in valid_risk_levels:
            result["risk_level"] = "low"

        # interest_tags: [{topic, intensity}] 형식 → 정규화
        raw_tags = result.get("interest_tags", [])
        if not isinstance(raw_tags, list):
            raw_tags = []
        normalized_tags = []
        for tag in raw_tags[:5]:
            if isinstance(tag, dict) and "topic" in tag:
                intensity = tag.get("intensity", "medium")
                if intensity not in ("high", "medium", "low"):
                    intensity = "medium"
                normalized_tags.append({"topic": str(tag["topic"]), "intensity": intensity})
            elif isinstance(tag, str):
                # 폴백: 문자열이면 medium으로 처리
                normalized_tags.append({"topic": tag, "intensity": "medium"})
        result["interest_tags"] = normalized_tags

        if not isinstance(result.get("key_concerns"), list):
            result["key_concerns"] = []
        result["key_concerns"] = [str(c) for c in result["key_concerns"][:3]]

        if not isinstance(result.get("follow_up_needed"), bool):
            result["follow_up_needed"] = False

        if not isinstance(result.get("summary"), str):
            result["summary"] = ""

        # counselor_recommendations
        raw_recs = result.get("counselor_recommendations", [])
        if not isinstance(raw_recs, list):
            raw_recs = []
        result["counselor_recommendations"] = [str(r) for r in raw_recs[:3]]

        # conversation_depth
        valid_depths = {"deep", "moderate", "shallow"}
        if result.get("conversation_depth") not in valid_depths:
            result["conversation_depth"] = "shallow"

        # engagement_score
        eng_score = result.get("engagement_score", 0)
        result["engagement_score"] = max(0, min(100, int(eng_score) if isinstance(eng_score, (int, float)) else 0))

        # action_intent
        valid_intents = {"active", "considering", "passive"}
        if result.get("action_intent") not in valid_intents:
            result["action_intent"] = "passive"

        # nutrition_interests
        raw_nutrition = result.get("nutrition_interests", [])
        result["nutrition_interests"] = [str(n) for n in raw_nutrition[:5]] if isinstance(raw_nutrition, list) else []

        # commercial_tags 검증
        raw_commercial = result.get("commercial_tags", [])
        if not isinstance(raw_commercial, list):
            raw_commercial = []
        validated_commercial = []
        for ct in raw_commercial[:10]:
            if isinstance(ct, dict) and "category" in ct:
                segment = ct.get("segment", "일반")
                if segment not in ("고관여", "일반"):
                    segment = "일반"
                validated_commercial.append({
                    "category": str(ct["category"]),
                    "product_hint": str(ct.get("product_hint", "")),
                    "segment": segment,
                })
        result["commercial_tags"] = validated_commercial

        # buying_signal 검증
        valid_signals = {"high", "mid", "low"}
        if result.get("buying_signal") not in valid_signals:
            result["buying_signal"] = "low"

        # classification_confidence 검증 (0.0-1.0)
        raw_conf = result.get("classification_confidence", 0.5)
        try:
            conf_val = float(raw_conf)
        except (ValueError, TypeError):
            conf_val = 0.5
        result["classification_confidence"] = max(0.0, min(1.0, conf_val))

        # confidence가 낮으면 prospect_type override
        if result["classification_confidence"] < 0.4:
            result["prospect_type"] = "uncertain"

        # ── 병원 전용 필드 검증 (모든 세션에 항상 적용) ──
        def _normalize_tag_list(raw: Any, max_items: int = 15) -> list:
            """LLM이 반환한 태그를 순수 문자열 리스트로 정규화.
            dict({"topic":"혈압",...})가 오면 topic만 추출, 문자열이면 그대로."""
            if not isinstance(raw, list):
                return []
            normalized = []
            for t in raw[:max_items]:
                if isinstance(t, dict):
                    normalized.append(str(t.get("topic", t.get("name", ""))))
                elif isinstance(t, str):
                    normalized.append(t)
                else:
                    normalized.append(str(t))
            return [s for s in normalized if s]

        result["medical_tags"] = _normalize_tag_list(result.get("medical_tags", []), 15)
        result["lifestyle_tags"] = _normalize_tag_list(result.get("lifestyle_tags", []), 10)

        valid_urgency = {"urgent", "borderline", "normal"}
        if result.get("medical_urgency") not in valid_urgency:
            result["medical_urgency"] = "normal"

        valid_anxiety = {"high", "medium", "low"}
        if result.get("anxiety_level") not in valid_anxiety:
            result["anxiety_level"] = "low"

        valid_prospects = {"chronic_management", "needs_visit", "borderline_worried", "lifestyle_improvable", "low_engagement", "uncertain"}
        if result.get("prospect_type") not in valid_prospects:
            result["prospect_type"] = "chronic_management"

        hp_score = result.get("hospital_prospect_score", 0)
        result["hospital_prospect_score"] = max(0, min(100, int(hp_score) if isinstance(hp_score, (int, float)) else 0))

        logger.info(f"[태깅-LLM] 분석 완료: sentiment={result['sentiment']}, "
                     f"tags={len(result['interest_tags'])}, risk={result['risk_level']}")
        return result, ""

    except json.JSONDecodeError as e:
        logger.warning(f"[태깅-LLM] JSON 파싱 실패: {e}")
        return None, "json_parse_error"
    except Exception as e:
        logger.warning(f"[태깅-LLM] Gemini 호출 실패: {e}")
        return None, f"api_error:{e}"


# ─── DB에서 대화 메시지 로드 ────────────────────────────────────────

async def load_messages_from_db(session_id: str) -> Optional[List[Dict[str, str]]]:
    """DB(tb_partner_rag_chat_log)에서 세션의 대화 메시지를 로드합니다."""
    try:
        query = """
            SELECT conversation, initial_data
            FROM welno.tb_partner_rag_chat_log
            WHERE session_id = %s
        """
        result = await db_manager.execute_one(query, (session_id,))
        if not result:
            return None

        conversation = result.get("conversation", [])
        if isinstance(conversation, str):
            conversation = json.loads(conversation)

        # conversation은 [{role, content, timestamp}, ...] 형식
        messages = []
        for msg in conversation:
            if isinstance(msg, dict) and msg.get("role") and msg.get("content"):
                m = {"role": msg["role"], "content": msg["content"]}
                if msg.get("timestamp"):
                    m["timestamp"] = msg["timestamp"]
                messages.append(m)
        return messages if messages else None

    except Exception as e:
        logger.warning(f"[태깅] DB 메시지 로드 실패: {session_id} - {e}")
        return None


async def load_health_metrics_from_db(session_id: str) -> Optional[Dict[str, Any]]:
    """DB에서 세션의 검진 데이터(health_metrics)를 로드합니다."""
    try:
        query = """
            SELECT initial_data
            FROM welno.tb_partner_rag_chat_log
            WHERE session_id = %s
        """
        result = await db_manager.execute_one(query, (session_id,))
        if not result:
            return None

        initial_data = result.get("initial_data", {})
        if isinstance(initial_data, str):
            initial_data = json.loads(initial_data)

        return initial_data.get("health_metrics", {}) if isinstance(initial_data, dict) else {}
    except Exception as e:
        logger.warning(f"[태깅] 검진 데이터 로드 실패: {session_id} - {e}")
        return None


async def load_session_context_from_db(session_id: str) -> Dict[str, Any]:
    """DB에서 세션의 전체 컨텍스트(health_metrics + patient_info + medical_history + IDs)를 로드."""
    try:
        query = """
            SELECT initial_data, user_uuid, hospital_id
            FROM welno.tb_partner_rag_chat_log
            WHERE session_id = %s
        """
        result = await db_manager.execute_one(query, (session_id,))
        if not result:
            return {}
        initial_data = result.get("initial_data", {})
        if isinstance(initial_data, str):
            initial_data = json.loads(initial_data)
        if not isinstance(initial_data, dict):
            initial_data = {}
        return {
            "health_metrics": initial_data.get("health_metrics", {}),
            "patient_info": initial_data.get("patient_info", {}),
            "medical_history": initial_data.get("medical_history", []),
            "user_uuid": result.get("user_uuid", ""),
            "hospital_id": result.get("hospital_id", ""),
        }
    except Exception as e:
        logger.warning(f"[태깅] 세션 컨텍스트 로드 실패: {session_id} - {e}")
        return {}


async def load_survey_data_for_session(user_uuid: str, hospital_id: str) -> Optional[Dict]:
    """Redis에서 설문 응답을 로드. 실패 시 None."""
    try:
        import redis
        r = redis.from_url("redis://10.0.1.10:6379/0", decode_responses=True, socket_timeout=2)
        survey_key = f"welno:survey:{user_uuid}:{hospital_id}"
        raw = r.get(survey_key)
        if not raw:
            return None
        data = json.loads(raw)
        return data.get("survey_responses", {})
    except Exception as e:
        logger.debug(f"[태깅] 설문 로드 실패 (무시): {e}")
        return None


async def load_es_behavior_for_hospital(
    hospital_id: str, days: int = 30
) -> Optional[Dict[str, Any]]:
    """ES에서 병원 레벨 행동 데이터 조회 (business 인덱스). 실패 시 None.
    NOTE: ES data.user.name은 마스킹됨(이*옥) → WELNO 원본명과 매칭 불가.
          따라서 개인별이 아닌 병원 레벨 활동 요약으로 제공."""
    from urllib.request import Request, urlopen
    ES_URL = "http://10.0.0.10:9200"
    try:
        query = json.dumps({
            "size": 0,
            "query": {"bool": {"must": [
                {"term": {"header.hospital.id": hospital_id}},
                {"range": {"header.@timestamp": {"gte": f"now-{days}d"}}},
            ]}},
            "aggs": {
                "events": {"terms": {"field": "data.context", "size": 20}},
                "unique_users": {"cardinality": {"field": "data.user.webAppKey"}},
            },
        }).encode()
        req = Request(f"{ES_URL}/medilinx-logs-business/_search",
                      data=query, headers={"Content-Type": "application/json"})
        with urlopen(req, timeout=5) as resp:
            biz_data = json.loads(resp.read())

        aggs = biz_data.get("aggregations", {})
        total_users = aggs.get("unique_users", {}).get("value", 0)
        buckets = aggs.get("events", {}).get("buckets", [])

        result = {}
        if total_users:
            result["이 병원 활성 수검자 수"] = f"{total_users}명"
        for b in buckets:
            key = b.get("key", "")
            count = b.get("doc_count", 0)
            if "ResultOpen" in key:
                result["결과 열람 총 횟수"] = f"{count}회"
            elif "BannerClick" in key:
                result["배너 클릭 총 횟수"] = f"{count}회"

        return result if result else None
    except Exception as e:
        logger.debug(f"[태깅] ES 행동 데이터 조회 실패 (무시): {e}")
        return None


def _format_survey_for_prompt(survey: Dict[str, Any]) -> str:
    """설문 응답을 LLM-readable 텍스트로 변환."""
    lines = []
    for key, label in SURVEY_LABELS.items():
        val = survey.get(key)
        if val:
            lines.append(f"{label}: {val}")
    concerns = survey.get("additional_concerns", "")
    if concerns:
        lines.append(f'본인이 직접 쓴 걱정: "{concerns}"')
    return "[생활습관 설문]\n" + "\n".join(lines) if lines else ""


def _format_conversation_pattern(messages: List[Dict[str, str]]) -> str:
    """메시지 타임스탬프로 대화 패턴(턴 수, 평균 간격) 텍스트 생성."""
    user_timestamps = []
    total_turns = sum(1 for m in messages if m.get("role") == "user")
    for m in messages:
        if m.get("role") == "user" and m.get("timestamp"):
            try:
                ts = datetime.fromisoformat(str(m["timestamp"]).replace("Z", "+00:00"))
                user_timestamps.append(ts)
            except Exception:
                pass
    if len(user_timestamps) >= 2:
        intervals = [(user_timestamps[i+1] - user_timestamps[i]).total_seconds()
                     for i in range(len(user_timestamps) - 1)]
        avg_sec = sum(intervals) / len(intervals)
        if avg_sec < 30:
            pace = "빠른 연속 질문 — 적극적 관심"
        elif avg_sec < 120:
            pace = "보통 속도"
        else:
            pace = "느린 간격 — 신중한 질문"
        return f"[대화 패턴] 총 {total_turns}턴, 평균 질문 간격 {int(avg_sec)}초 ({pace})"
    return f"[대화 패턴] 총 {total_turns}턴"


# ─── 재방문 추천 메시지 생성 ──────────────────────────────────────

async def generate_revisit_messages(
    tags: Dict[str, Any],
    messages: Optional[List[Dict[str, str]]] = None,
) -> Optional[Dict[str, str]]:
    """
    태깅 결과 기반 재방문 추천 메시지 3종 생성 (follow_up_needed=true일 때만).
    Gemini Flash Lite로 care/action/info 시나리오별 메시지를 생성합니다.
    의료법 준수 가드레일 포함.
    """
    if not tags.get("follow_up_needed"):
        return None

    interest_topics = [t.get("topic", "") for t in (tags.get("interest_tags") or []) if t.get("intensity") in ("high", "medium")]
    risk_level = tags.get("risk_level", "low")
    recommendations = tags.get("counselor_recommendations") or []
    summary = tags.get("conversation_summary") or ""

    if not interest_topics and not recommendations:
        return None

    topic_str = ", ".join(interest_topics[:3]) if interest_topics else "건강 관리"
    rec_str = " / ".join(recommendations[:2]) if recommendations else ""

    try:
        prompt = f"""환자가 건강검진 결과 상담 채팅을 했습니다.
관심사: {topic_str}
위험도: {risk_level}
AI 권장: {rec_str}
대화요약: {summary[:200]}

이 환자에게 보낼 재방문 유도 메시지를 3가지 시나리오로 작성하세요.

[시나리오별 톤]
1. care_message: 케어/안부 톤 — 상담 후 안부를 묻는 부드러운 메시지
2. action_message: 행동 유도 톤 — 예약/상담/검사 등 구체적 행동을 권유
3. info_message: 정보 제공 톤 — 관심사 관련 건강 팁/정보 안내

[의료법 준수 가드레일 — 반드시 지켜야 합니다]
- 치료 효과 100% 보장 표현 절대 금지 ("완치", "확실히 나을" 등)
- 환자 후기 직접 인용 금지 (의료법 제56조 위반, 과태료 500만원)
- "~권장합니다", "~확인해보세요" 등 정보 제공형 톤 유지
- 의학적 진단/경고 금지, 친근한 존댓말
- 각 메시지 60자 이내

응답은 반드시 JSON만 출력:
{{"care_message": "...", "action_message": "...", "info_message": "..."}}"""

        from .gemini_service import gemini_service, GeminiRequest
        from .llm_router import llm_router
        res = await llm_router.call_api(
            GeminiRequest(prompt=prompt, model=settings.google_gemini_lite_model, temperature=0.5),
            endpoint="chat_tagging",
            save_log=False,
        )
        if res.success and res.content:
            raw = res.content.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1]
                if raw.endswith("```"):
                    raw = raw[:-3]
                raw = raw.strip()
            result = json.loads(raw)
            for k in ("care_message", "action_message", "info_message"):
                if k in result:
                    result[k] = str(result[k]).replace('"', '').replace('\n', ' ')[:200]
            if all(k in result for k in ("care_message", "action_message", "info_message")):
                return result
    except Exception as e:
        logger.warning(f"[태깅] 재방문 메시지 생성 실패: {e}")

    # 폴백: 규칙 기반 3종 메시지
    topic = interest_topics[0] if interest_topics else "건강 관리"
    return {
        "care_message": f"{topic} 관련 상담 이후 건강 관리는 잘 되고 계신가요?",
        "action_message": f"{topic} 관련 궁금하셨던 부분, 한번 상담 예약해 보시는 건 어떨까요?",
        "info_message": f"{topic} 관리에 도움이 되는 정보가 있어 안내드립니다.",
    }


# ─── DB 저장 헬퍼 ─────────────────────────────────────────────────

async def _save_tags_to_db(tag_data: Dict[str, Any]) -> None:
    """tag_data 딕셔너리를 DB에 upsert (conversation_intent + classification_confidence 포함)."""
    d = tag_data
    revisit_msgs = d.get("suggested_revisit_messagess")
    medical_tags = d.get("medical_tags")
    lifestyle_tags = d.get("lifestyle_tags")

    upsert_query = """
        INSERT INTO welno.tb_chat_session_tags
        (session_id, partner_id, interest_tags, risk_tags, keyword_tags,
         sentiment, conversation_summary, data_quality_score, has_discrepancy,
         risk_level, key_concerns, follow_up_needed, tagging_model, tagging_version,
         counselor_recommendations,
         conversation_depth, engagement_score, action_intent, nutrition_tags,
         llm_attempted, llm_failed, llm_error,
         commercial_tags, buying_signal, conversion_flag,
         suggested_revisit_messages,
         medical_tags, lifestyle_tags, medical_urgency,
         anxiety_level, prospect_type, hospital_prospect_score,
         conversation_intent, classification_confidence)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 4,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (session_id, partner_id) DO UPDATE SET
            interest_tags = EXCLUDED.interest_tags,
            risk_tags = EXCLUDED.risk_tags,
            keyword_tags = EXCLUDED.keyword_tags,
            sentiment = EXCLUDED.sentiment,
            conversation_summary = EXCLUDED.conversation_summary,
            data_quality_score = EXCLUDED.data_quality_score,
            has_discrepancy = EXCLUDED.has_discrepancy,
            risk_level = EXCLUDED.risk_level,
            key_concerns = EXCLUDED.key_concerns,
            follow_up_needed = EXCLUDED.follow_up_needed,
            tagging_model = EXCLUDED.tagging_model,
            tagging_version = EXCLUDED.tagging_version,
            counselor_recommendations = EXCLUDED.counselor_recommendations,
            conversation_depth = EXCLUDED.conversation_depth,
            engagement_score = EXCLUDED.engagement_score,
            action_intent = EXCLUDED.action_intent,
            nutrition_tags = EXCLUDED.nutrition_tags,
            llm_attempted = EXCLUDED.llm_attempted,
            llm_failed = EXCLUDED.llm_failed,
            llm_error = EXCLUDED.llm_error,
            commercial_tags = EXCLUDED.commercial_tags,
            buying_signal = EXCLUDED.buying_signal,
            conversion_flag = EXCLUDED.conversion_flag,
            suggested_revisit_messages = EXCLUDED.suggested_revisit_messages,
            medical_tags = EXCLUDED.medical_tags,
            lifestyle_tags = EXCLUDED.lifestyle_tags,
            medical_urgency = EXCLUDED.medical_urgency,
            anxiety_level = EXCLUDED.anxiety_level,
            prospect_type = EXCLUDED.prospect_type,
            hospital_prospect_score = EXCLUDED.hospital_prospect_score,
            conversation_intent = EXCLUDED.conversation_intent,
            classification_confidence = EXCLUDED.classification_confidence,
            updated_at = NOW()
    """
    await db_manager.execute_update(upsert_query, (
        d["session_id"],
        d["partner_id"],
        json.dumps(d.get("interest_tags", []), ensure_ascii=False),
        json.dumps(d.get("risk_tags", []), ensure_ascii=False),
        json.dumps(d.get("keyword_tags", []), ensure_ascii=False),
        d.get("sentiment", "neutral"),
        d.get("conversation_summary", ""),
        d.get("data_quality_score", 0),
        d.get("has_discrepancy", False),
        d.get("risk_level", "low"),
        json.dumps(d.get("key_concerns", []), ensure_ascii=False),
        d.get("follow_up_needed", False),
        d.get("tagging_model", "rule-based"),
        json.dumps(d.get("counselor_recommendations", []), ensure_ascii=False),
        d.get("conversation_depth", "shallow"),
        d.get("engagement_score", 0),
        d.get("action_intent", "passive"),
        json.dumps(d.get("nutrition_tags", []), ensure_ascii=False),
        d.get("llm_attempted", False),
        d.get("llm_failed", False),
        d.get("llm_error"),
        json.dumps(d.get("commercial_tags", []), ensure_ascii=False),
        d.get("buying_signal", "low"),
        d.get("conversion_flag", False),
        json.dumps(revisit_msgs, ensure_ascii=False) if revisit_msgs else None,
        json.dumps(medical_tags, ensure_ascii=False) if medical_tags else None,
        json.dumps(lifestyle_tags, ensure_ascii=False) if lifestyle_tags else None,
        d.get("medical_urgency"),
        d.get("anxiety_level"),
        d.get("prospect_type"),
        d.get("hospital_prospect_score"),
        d.get("conversation_intent", "health_question"),
        d.get("classification_confidence", 0.5),
    ))


# ─── 메인 태깅 함수 (LLM + 규칙 기반 하이브리드) ──────────────────

async def tag_chat_session(
    session_id: str,
    partner_id: str,
    messages: Optional[List[Dict[str, str]]] = None,
    health_metrics: Optional[Dict[str, Any]] = None,
    has_discrepancy: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    대화 세션에 대한 자동 태깅 수행 및 DB 저장.
    LLM 분석 시도 후 실패 시 규칙 기반으로 폴백.

    Args:
        session_id: 세션 ID
        partner_id: 파트너 ID
        messages: 대화 메시지 리스트 (None이면 DB에서 로드)
        health_metrics: 검진 데이터 (None이면 DB에서 로드)
        has_discrepancy: CLIENT_RAG_DISCREPANCY 발생 여부

    Returns:
        저장된 태그 데이터 또는 None
    """
    try:
        # 메시지가 없으면 DB에서 로드
        if not messages:
            messages = await load_messages_from_db(session_id)
        if not messages:
            logger.warning(f"[태깅] 메시지 없음, 태깅 스킵: {session_id}")
            return None

        # ── 멀티채널 데이터 수집 (v3) ──
        context = await load_session_context_from_db(session_id)
        if health_metrics is None:
            health_metrics = context.get("health_metrics", {})
        patient_info = context.get("patient_info", {})
        medical_history = context.get("medical_history", [])

        # Tier 2: 설문 (있으면 사용)
        survey_data = None
        if context.get("user_uuid") and context.get("hospital_id"):
            survey_data = await load_survey_data_for_session(
                context["user_uuid"], context["hospital_id"])

        # Tier 3: ES 행동 데이터 — 병원 레벨 (개인 매칭 불가: ES name 마스킹)
        es_behavior = None
        if context.get("hospital_id"):
            es_behavior = await load_es_behavior_for_hospital(
                context["hospital_id"])

        # ── Phase H: 대화 의도 1차 분류 (LLM 호출 전 전처리) ──
        conversation_intent = classify_conversation_intent(messages)

        # 규칙 기반 결과 (항상 계산 — risk_tags, data_quality는 규칙 기반 유지)
        risk_tags = extract_risk_tags(health_metrics)
        keyword_tags = extract_keyword_tags(messages)
        data_quality = calculate_data_quality_score(health_metrics)

        # 비건강 대화는 LLM 호출 없이 최소 태깅 (비용 절감 + 잘못된 태깅 방지)
        if conversation_intent in ("ux_issue", "greeting", "off_topic"):
            sentiment = detect_sentiment(messages)
            summary = await generate_conversation_summary(messages)
            tag_data = {
                "session_id": session_id,
                "partner_id": partner_id,
                "conversation_intent": conversation_intent,
                "classification_confidence": 1.0,
                "interest_tags": [],
                "risk_tags": risk_tags,
                "keyword_tags": keyword_tags,
                "sentiment": sentiment,
                "conversation_summary": summary,
                "data_quality_score": data_quality,
                "has_discrepancy": has_discrepancy,
                "risk_level": "low",
                "key_concerns": [],
                "follow_up_needed": False,
                "tagging_model": "intent-filter",
                "counselor_recommendations": [],
                "conversation_depth": "shallow",
                "engagement_score": 0,
                "action_intent": "passive",
                "nutrition_tags": [],
                "llm_attempted": False,
                "llm_failed": False,
                "llm_error": None,
                "commercial_tags": [],
                "buying_signal": "low",
                "conversion_flag": False,
                "medical_tags": [],
                "lifestyle_tags": [],
                "medical_urgency": "normal",
                "anxiety_level": "low",
                "prospect_type": "low_engagement",
                "hospital_prospect_score": 0,
                "suggested_revisit_messagess": None,
            }
            await _save_tags_to_db(tag_data)
            logger.info(f"[태깅] 비건강 대화 최소 태깅: {session_id} intent={conversation_intent}")
            return tag_data

        # ── health_question: 기존 LLM 태깅 플로우 ──
        # LLM 분석 시도 (멀티채널 통합)
        tagging_model = "rule-based"
        llm_attempted = False
        llm_failed = False
        llm_error = None

        llm_result, llm_err = await llm_analyze_session(
            messages, health_metrics,
            patient_info=patient_info,
            medical_history=medical_history,
            survey_data=survey_data,
            es_behavior=es_behavior,
        )

        if llm_err == "api_key_missing":
            llm_attempted = False
        else:
            llm_attempted = True
            if not llm_result:
                llm_failed = True
                llm_error = llm_err
                logger.warning(f"⚠️ [태깅] LLM 실패→규칙기반: session={session_id} error={llm_err}")

        if llm_result:
            # LLM 성공 — LLM 결과 사용 + 규칙 기반 최소 보장
            tagging_model = settings.google_gemini_lite_model
            interest_tags = llm_result["interest_tags"]  # [{topic, intensity}]
            sentiment = llm_result["sentiment"]
            summary = llm_result["summary"]
            key_concerns = llm_result["key_concerns"]
            counselor_recommendations = llm_result.get("counselor_recommendations", [])

            # risk_level: LLM vs 규칙 기반 중 더 높은 값 채택
            risk_level = llm_result["risk_level"]
            metrics_risk = calculate_risk_level(risk_tags)
            RISK_ORDER = {"low": 0, "medium": 1, "high": 2}
            if RISK_ORDER.get(metrics_risk, 0) > RISK_ORDER.get(risk_level, 0):
                risk_level = metrics_risk
            follow_up_needed = llm_result["follow_up_needed"] or (risk_level == "high")

            conversation_depth = llm_result.get("conversation_depth", "shallow")
            engagement_score = llm_result.get("engagement_score", 0)

            # 재방문 보너스: 같은 uuid의 이전 세션 수만큼 engagement 가점 (최대 +30)
            try:
                from ..core.database import db_manager
                _user_uuid = context.get("user_uuid")
                _hospital_id = context.get("hospital_id")
                if _user_uuid and _hospital_id:
                    prev_result = await db_manager.execute_query(
                        "SELECT COUNT(*) as cnt FROM welno.tb_partner_rag_chat_log "
                        "WHERE user_uuid = %s AND hospital_id = %s AND session_id != %s",
                        (_user_uuid, _hospital_id, session_id),
                    )
                    prev_count = prev_result[0]["cnt"] if prev_result else 0
                    revisit_bonus = min(int(prev_count) * 10, 30)
                    engagement_score = min(engagement_score + revisit_bonus, 100)
            except Exception:
                pass  # DB 조회 실패해도 기존 점수 유지

            action_intent = llm_result.get("action_intent", "passive")
            nutrition_tags = llm_result.get("nutrition_interests", [])
            # 규칙 기반 nutrition_tags도 병합
            rule_nutrition = extract_nutrition_tags(messages)
            nutrition_tags = list(set(nutrition_tags) | set(rule_nutrition))
            commercial_tags = llm_result.get("commercial_tags", [])
            buying_signal = llm_result.get("buying_signal", "low")
            # 규칙 기반으로 보충
            if not commercial_tags:
                commercial_tags = extract_commercial_tags(interest_tags)
            rule_signal = extract_buying_signal(messages)
            SIGNAL_ORDER = {"low": 0, "mid": 1, "high": 2}
            if SIGNAL_ORDER.get(rule_signal, 0) > SIGNAL_ORDER.get(buying_signal, 0):
                buying_signal = rule_signal
            # 병원 전용 필드 (LLM이 반환한 경우에만)
            medical_tags = llm_result.get("medical_tags")
            lifestyle_tags_val = llm_result.get("lifestyle_tags")
            medical_urgency = llm_result.get("medical_urgency")
            anxiety_level = llm_result.get("anxiety_level")
            prospect_type = llm_result.get("prospect_type")
            hospital_prospect_score = llm_result.get("hospital_prospect_score")
            classification_confidence = llm_result.get("classification_confidence", 0.5)
        else:
            # LLM 실패 — 태깅 스킵 (rule-based 단어 매칭은 의미 없는 데이터 생성)
            # 나중에 LLM 복구 시 retag_all_sessions로 일괄 처리
            logger.info(f"⏭️ [태깅] LLM 실패 → 태깅 스킵 (rule-based 폐지): session={session_id}")
            return

        tag_data = {
            "session_id": session_id,
            "partner_id": partner_id,
            "conversation_intent": conversation_intent,
            "classification_confidence": classification_confidence,
            "interest_tags": interest_tags,
            "risk_tags": risk_tags,
            "keyword_tags": keyword_tags,
            "sentiment": sentiment,
            "conversation_summary": summary,
            "data_quality_score": data_quality,
            "has_discrepancy": has_discrepancy,
            "risk_level": risk_level,
            "key_concerns": key_concerns,
            "follow_up_needed": follow_up_needed,
            "tagging_model": tagging_model,
            "counselor_recommendations": counselor_recommendations,
            "conversation_depth": conversation_depth,
            "engagement_score": engagement_score,
            "action_intent": action_intent,
            "nutrition_tags": nutrition_tags,
            "llm_attempted": llm_attempted,
            "llm_failed": llm_failed,
            "llm_error": llm_error,
            "commercial_tags": commercial_tags,
            "buying_signal": buying_signal,
            "conversion_flag": False,
            # 병원 전용 6개 필드
            "medical_tags": medical_tags,
            "lifestyle_tags": lifestyle_tags_val,
            "medical_urgency": medical_urgency,
            "anxiety_level": anxiety_level,
            "prospect_type": prospect_type,
            "hospital_prospect_score": hospital_prospect_score,
        }

        # 재방문 추천 메시지 3종 생성 (follow_up_needed=true일 때)
        revisit_msgs = await generate_revisit_messages(tag_data, messages)
        tag_data["suggested_revisit_messagess"] = revisit_msgs

        # DB 저장 (_save_tags_to_db 공통 함수 사용)
        await _save_tags_to_db(tag_data)

        logger.info(f"[태깅] 세션 태깅 완료: {session_id} - "
                     f"model={tagging_model}, interest={len(interest_tags)}, "
                     f"risk={len(risk_tags)}, sentiment={sentiment}, "
                     f"risk_level={risk_level}, quality={data_quality}")
        return tag_data

    except Exception as e:
        error_type = type(e).__name__
        logger.error(
            f"[태깅] 세션 태깅 실패: session={session_id}, partner={partner_id}, "
            f"error_type={error_type}, error={e}"
        )
        # Slack 알림
        try:
            if settings.slack_enabled and settings.slack_webhook_url:
                from .slack_service import get_slack_service
                slack = get_slack_service(settings.slack_webhook_url, settings.slack_channel_id)
                await slack.send_tagging_alert({
                    "session_id": session_id,
                    "partner_id": partner_id,
                    "error_type": error_type,
                    "error_message": str(e),
                })
        except Exception:
            pass  # Slack 실패는 무시
        return None


# ─── 일괄 재태깅 ───────────────────────────────────────────────────

async def retag_all_sessions(
    hospital_id: Optional[str] = None,
    force: bool = False,
) -> Dict[str, Any]:
    """
    기존 세션을 일괄 재태깅합니다.

    Args:
        hospital_id: 특정 병원만 재태깅 (None이면 전체)
        force: True면 이미 LLM 태깅된 것도 재처리

    Returns:
        {total, success, failed, skipped}
    """
    result = {"total": 0, "success": 0, "failed": 0, "skipped": 0}

    try:
        # 재태깅 대상 세션 조회
        if force:
            # 모든 세션
            if hospital_id:
                query = """
                    SELECT session_id, partner_id
                    FROM welno.tb_partner_rag_chat_log
                    WHERE hospital_id = %s
                    ORDER BY created_at DESC
                """
                sessions = await db_manager.execute_query(query, (hospital_id,))
            else:
                query = """
                    SELECT session_id, partner_id
                    FROM welno.tb_partner_rag_chat_log
                    ORDER BY created_at DESC
                """
                sessions = await db_manager.execute_query(query)
        else:
            # 태그 없거나 규칙 기반인 세션만 (LLM 3회 이상 실패한 건 제외)
            # llm_attempted=true AND llm_failed=true인 세션은 이미 LLM 시도 후
            # rule-based 폴백된 것이므로 재시도해도 같은 결과 → 무한 루프 방지
            if hospital_id:
                query = """
                    SELECT l.session_id, l.partner_id
                    FROM welno.tb_partner_rag_chat_log l
                    LEFT JOIN welno.tb_chat_session_tags t
                        ON l.session_id = t.session_id AND l.partner_id = t.partner_id
                    WHERE l.hospital_id = %s
                      AND (t.session_id IS NULL OR t.tagging_model IS NULL)
                    ORDER BY l.created_at DESC
                    LIMIT 20
                """
                sessions = await db_manager.execute_query(query, (hospital_id,))
            else:
                query = """
                    SELECT l.session_id, l.partner_id
                    FROM welno.tb_partner_rag_chat_log l
                    LEFT JOIN welno.tb_chat_session_tags t
                        ON l.session_id = t.session_id AND l.partner_id = t.partner_id
                    WHERE t.session_id IS NULL OR t.tagging_model IS NULL
                    ORDER BY l.created_at DESC
                    LIMIT 20
                """
                sessions = await db_manager.execute_query(query)

        result["total"] = len(sessions)
        logger.info(f"[재태깅] 대상 세션 {len(sessions)}건 (hospital={hospital_id}, force={force})")

        for i, session in enumerate(sessions):
            sid = session["session_id"]
            pid = session["partner_id"]

            try:
                tag_result = await tag_chat_session(
                    session_id=sid,
                    partner_id=pid,
                )
                if tag_result:
                    result["success"] += 1
                else:
                    result["skipped"] += 1
            except Exception as e:
                logger.warning(f"[재태깅] 실패 {sid}: {e}")
                result["failed"] += 1

            # 속도 제한: 2건마다 1초 대기 (Gemini quota 보호)
            if (i + 1) % 2 == 0:
                await asyncio.sleep(1)

        logger.info(f"[재태깅] 완료: {result}")

        # 실패가 있으면 Slack 요약 알림
        if result["failed"] > 0:
            try:
                if settings.slack_enabled and settings.slack_webhook_url:
                    from .slack_service import get_slack_service
                    slack = get_slack_service(settings.slack_webhook_url, settings.slack_channel_id)
                    await slack.send_tagging_alert({
                        "session_id": f"batch ({result['total']}건)",
                        "partner_id": hospital_id or "전체",
                        "error_type": "BATCH_RETAG_PARTIAL_FAILURE",
                        "error_message": f"성공 {result['success']}건, 실패 {result['failed']}건, 스킵 {result['skipped']}건",
                    })
            except Exception:
                pass

        return result

    except Exception as e:
        logger.error(f"[재태깅] 전체 실패: {e}")
        result["failed"] = result["total"]
        return result


async def get_session_tags(session_id: str, partner_id: str) -> Optional[Dict[str, Any]]:
    """세션 태그 조회"""
    try:
        query = """
            SELECT interest_tags, risk_tags, keyword_tags, sentiment,
                   conversation_summary, data_quality_score, has_discrepancy,
                   risk_level, key_concerns, follow_up_needed,
                   tagging_model, tagging_version, counselor_recommendations,
                   conversation_depth, engagement_score, action_intent, nutrition_tags,
                   commercial_tags, buying_signal, conversion_flag,
                   llm_attempted, llm_failed, llm_error,
                   conversation_intent, classification_confidence,
                   created_at, updated_at
            FROM welno.tb_chat_session_tags
            WHERE session_id = %s AND partner_id = %s
        """
        result = await db_manager.execute_one(query, (session_id, partner_id))
        return result
    except Exception as e:
        logger.warning(f"[태깅] 태그 조회 실패: {session_id} - {e}")
        return None


async def get_patient_aggregated_tags(
    user_uuid: str,
    hospital_id: str,
) -> Optional[Dict[str, Any]]:
    """
    환자 단위 태깅 통합 뷰 (시간 감쇠 적용).
    같은 uuid + hospital_id의 여러 세션을 합산하여 전체 그림을 제공합니다.
    engagement_score에 시간 감쇠 적용: 7일:1.0, 30일:0.7, 90일:0.4, 그 이상:0.1
    """
    try:
        query = """
            SELECT t.session_id, t.interest_tags, t.risk_tags, t.keyword_tags,
                   t.sentiment, t.engagement_score, t.prospect_type,
                   t.medical_tags, t.lifestyle_tags, t.medical_urgency,
                   t.hospital_prospect_score, t.conversation_depth,
                   t.conversation_intent, t.classification_confidence,
                   t.created_at
            FROM welno.tb_chat_session_tags t
            JOIN welno.tb_partner_rag_chat_log l
              ON t.session_id = l.session_id
            WHERE l.user_uuid = %s AND l.hospital_id = %s
            ORDER BY t.created_at DESC
        """
        rows = await db_manager.execute_all(query, (user_uuid, hospital_id))
        if not rows:
            return None

        session_count = len(rows)

        # interest_tags 합산 (중복 제거)
        all_interest_topics = set()
        for row in rows:
            tags = row.get("interest_tags") or []
            if isinstance(tags, str):
                try:
                    tags = json.loads(tags)
                except json.JSONDecodeError:
                    tags = []
            for tag in tags:
                if isinstance(tag, dict):
                    all_interest_topics.add(tag.get("topic", ""))
                elif isinstance(tag, str):
                    all_interest_topics.add(tag)
        all_interest_topics.discard("")

        # medical_tags / lifestyle_tags 합산
        all_medical = set()
        all_lifestyle = set()
        for row in rows:
            for tag in (row.get("medical_tags") or []):
                if isinstance(tag, str):
                    all_medical.add(tag)
            for tag in (row.get("lifestyle_tags") or []):
                if isinstance(tag, str):
                    all_lifestyle.add(tag)

        # engagement_score = 시간 감쇠 가중 최대값
        now = datetime.now()
        max_engagement = 0
        for row in rows:
            raw_score = row.get("engagement_score") or 0
            created = row.get("created_at")
            if created:
                try:
                    if isinstance(created, str):
                        created = datetime.fromisoformat(created.replace("Z", "+00:00")).replace(tzinfo=None)
                    elif hasattr(created, 'replace'):
                        created = created.replace(tzinfo=None)
                    days = (now - created).days
                except Exception:
                    days = 0
            else:
                days = 0
            decay = 1.0 if days <= 7 else 0.7 if days <= 30 else 0.4 if days <= 90 else 0.1
            weighted = int(raw_score * decay)
            if weighted > max_engagement:
                max_engagement = weighted

        # prospect_type = 가장 높은 등급 우선
        prospect_priority = {
            "needs_visit": 5, "borderline_worried": 4,
            "chronic_management": 3, "lifestyle_improvable": 2,
            "low_engagement": 1,
        }
        best_prospect = max(
            rows,
            key=lambda r: prospect_priority.get(
                r.get("prospect_type", ""), 0)
        )

        # hospital_prospect_score = max
        max_hp_score = max(
            (row.get("hospital_prospect_score") or 0) for row in rows)

        # 통합 필드 계산
        best_prospect_type = best_prospect.get("prospect_type", "low_engagement")
        eng_level = "high" if max_engagement >= 60 else "medium" if max_engagement >= 25 else "low"
        recommended_action = PROSPECT_ACTION_MAP.get(best_prospect_type, "")

        # health_concerns 통합 (interest_tags + medical_tags 중복 제거)
        health_concerns = sorted(all_interest_topics | all_medical)

        return {
            "user_uuid": user_uuid,
            "hospital_id": hospital_id,
            "session_count": session_count,
            "interest_tags": sorted(all_interest_topics),
            "medical_tags": sorted(all_medical),
            "lifestyle_tags": sorted(all_lifestyle),
            "health_concerns": health_concerns,
            "engagement_score": max_engagement,
            "engagement_level": eng_level,
            "prospect_type": best_prospect_type,
            "hospital_prospect_score": max_hp_score,
            "recommended_action": recommended_action,
            "latest_sentiment": rows[0].get("sentiment", "neutral"),
            "latest_session_id": rows[0].get("session_id"),
            "latest_session_date": str(rows[0].get("created_at", "")),
        }

    except Exception as e:
        logger.warning(f"[태깅] 환자 통합 태그 조회 실패: {user_uuid} - {e}")
        return None
