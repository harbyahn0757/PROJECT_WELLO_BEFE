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
    "혈압": ["혈압", "고혈압", "저혈압", "수축기", "이완기"],
    "당뇨": ["당뇨", "혈당", "공복혈당", "인슐린", "HbA1c"],
    "간기능": ["간", "AST", "ALT", "감마", "GGT", "지방간"],
    "콜레스테롤": ["콜레스테롤", "중성지방", "HDL", "LDL", "이상지질"],
    "신장": ["신장", "크레아티닌", "사구체", "GFR", "콩팥"],
    "암": ["암", "종양", "용종", "조직검사"],
    "위장": ["위", "위내시경", "위암", "헬리코박터", "역류"],
    "갑상선": ["갑상선", "TSH", "T3", "T4"],
    "빈혈": ["빈혈", "혈색소", "헤모글로빈", "철분"],
    "심장": ["심장", "심전도", "부정맥", "협심증"],
    "폐": ["폐", "흉부", "X-ray", "결핵"],
}

# 감정 키워드 사전 (규칙 기반 폴백용)
SENTIMENT_KEYWORDS: Dict[str, List[str]] = {
    "positive": ["감사", "고마워", "좋아", "좋겠", "도움", "이해", "알겠", "고맙"],
    "negative": ["싫", "아닌데", "틀렸", "이상해", "불만", "화나", "짜증", "걱정"],
    "confused": ["모르겠", "어렵", "복잡", "이해가 안", "무슨 말", "뭔소리"],
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

    # engagement_score: 반복 언급 주제가 많을수록 높음
    repeat_topics = sum(1 for c in topic_counts.values() if c >= 2)  # 2회 이상 언급 주제 수
    total_mentions = sum(topic_counts.values())
    score = min(100, (repeat_topics * 25) + (total_mentions * 5) + (len(user_msgs) * 3))

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
) -> Optional[Dict[str, Any]]:
    """
    Gemini Flash Lite를 사용하여 대화 세션을 분석합니다.

    Returns:
        {summary, sentiment, interest_tags, risk_level, key_concerns, follow_up_needed} 또는 실패 시 None
    """
    try:
        import google.generativeai as genai

        api_key = settings.google_gemini_api_key
        if not api_key or api_key == "dev-gemini-key":
            logger.debug("[태깅-LLM] Gemini API 키 미설정, 스킵")
            return None

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(settings.google_gemini_lite_model)

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

        # 이상소견 목록
        abnormal_items = []
        if health_metrics:
            for key, val in health_metrics.items():
                if key.endswith("_abnormal") and val and val != "정상":
                    metric_name = key.replace("_abnormal", "")
                    abnormal_items.append(f"{metric_name}: {val}")
        abnormal_text = "\n".join(abnormal_items) if abnormal_items else "없음"

        prompt = f"""건강상담 대화를 분석합니다. 환자(수검자) 질문과 상담사(AI) 답변이 턴 번호(#)로 구분되어 있습니다.
반드시 아래 규칙을 지켜서 JSON만 출력하세요.

⚠️ 핵심 원칙: interest_tags와 key_concerns는 반드시 [환자 질문]에서만 추출하세요.
[상담사 답변]에서 일방적으로 언급한 건강 주제는 관심사가 아닙니다.
예: 환자가 "혈압이 걱정돼요"라고 했으면 → 혈압은 관심사 ✓
예: 상담사가 "콜레스테롤도 관리하세요"라고 했지만 환자가 언급 안 했으면 → 콜레스테롤은 관심사 ✗

[대화] (총 {total_user_turns}턴)
{conversation_text}

[검진 이상소견]
{abnormal_text}

분석 규칙:
- summary: "환자가 ~에 대해 질문하고, 상담사가 ~을 안내함" 형식으로 화자를 구분하여 1-2문장 요약
- sentiment: 환자의 감정만 기준 (상담사 톤 무시)
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

응답 JSON:
{{
  "summary": "환자가 ~를 질문하고, 상담사가 ~를 안내함",
  "sentiment": "positive|negative|neutral|worried|grateful 중 하나",
  "interest_tags": [{{"topic": "주제", "intensity": "high|medium|low"}}],
  "risk_level": "low|medium|high",
  "key_concerns": ["환자가 표현한 우려사항 -- 최대 3개"],
  "follow_up_needed": true 또는 false,
  "counselor_recommendations": ["상담사 핵심 조언 -- 최대 3개"],
  "conversation_depth": "deep|moderate|shallow",
  "engagement_score": 0-100,
  "action_intent": "active|considering|passive",
  "nutrition_interests": ["식단관리", "영양제"]
}}"""

        response = await asyncio.to_thread(model.generate_content, prompt)
        # Gemini API 응답 형식 방어: .text 접근 실패 시 parts에서 추출
        try:
            raw_text = response.text.strip()
        except (AttributeError, ValueError):
            if hasattr(response, 'parts') and response.parts:
                raw_text = response.parts[0].text.strip()
            elif hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts'):
                    raw_text = candidate.content.parts[0].text.strip()
                else:
                    logger.warning("[태깅-LLM] Gemini 응답 파싱 불가: 알 수 없는 응답 구조")
                    return None
            else:
                logger.warning("[태깅-LLM] Gemini 응답 파싱 불가: text/parts 없음")
                return None

        # JSON 파싱 (```json ... ``` 감싸기 대응)
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[-1]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()

        result = json.loads(raw_text)

        # 필드 검증 및 정규화
        valid_sentiments = {"positive", "negative", "neutral", "worried", "grateful"}
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

        logger.info(f"[태깅-LLM] 분석 완료: sentiment={result['sentiment']}, "
                     f"tags={len(result['interest_tags'])}, risk={result['risk_level']}")
        return result

    except json.JSONDecodeError as e:
        logger.warning(f"[태깅-LLM] JSON 파싱 실패: {e}")
        return None
    except Exception as e:
        logger.warning(f"[태깅-LLM] Gemini 호출 실패: {e}")
        return None


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
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })
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

        # 검진 데이터가 없으면 DB에서 로드
        if health_metrics is None:
            health_metrics = await load_health_metrics_from_db(session_id) or {}

        # 규칙 기반 결과 (항상 계산 — risk_tags, data_quality는 규칙 기반 유지)
        risk_tags = extract_risk_tags(health_metrics)
        keyword_tags = extract_keyword_tags(messages)
        data_quality = calculate_data_quality_score(health_metrics)

        # LLM 분석 시도
        tagging_model = "rule-based"
        llm_result = await llm_analyze_session(messages, health_metrics)

        if llm_result:
            # LLM 성공 — LLM 결과 사용 + 규칙 기반 최소 보장
            tagging_model = f"gemini-{settings.google_gemini_lite_model}"
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
            action_intent = llm_result.get("action_intent", "passive")
            nutrition_tags = llm_result.get("nutrition_interests", [])
            # 규칙 기반 nutrition_tags도 병합
            rule_nutrition = extract_nutrition_tags(messages)
            nutrition_tags = list(set(nutrition_tags) | set(rule_nutrition))
        else:
            # LLM 실패 — 규칙 기반 폴백
            raw_interest = extract_interest_tags(messages)
            interest_tags = [{"topic": t, "intensity": "medium"} for t in raw_interest]
            sentiment = detect_sentiment(messages)
            summary = await generate_conversation_summary(messages)
            risk_level = calculate_risk_level(risk_tags)
            key_concerns = []
            follow_up_needed = (risk_level == "high")
            counselor_recommendations = []
            conversation_depth, engagement_score = calculate_engagement(messages)
            action_intent = detect_action_intent(messages)
            nutrition_tags = extract_nutrition_tags(messages)

        tag_data = {
            "session_id": session_id,
            "partner_id": partner_id,
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
        }

        # DB 저장 (Upsert)
        upsert_query = """
            INSERT INTO welno.tb_chat_session_tags
            (session_id, partner_id, interest_tags, risk_tags, keyword_tags,
             sentiment, conversation_summary, data_quality_score, has_discrepancy,
             risk_level, key_concerns, follow_up_needed, tagging_model, tagging_version,
             counselor_recommendations,
             conversation_depth, engagement_score, action_intent, nutrition_tags)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 2, %s, %s, %s, %s, %s)
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
                updated_at = NOW()
        """
        await db_manager.execute_update(upsert_query, (
            session_id,
            partner_id,
            json.dumps(interest_tags, ensure_ascii=False),
            json.dumps(risk_tags, ensure_ascii=False),
            json.dumps(keyword_tags, ensure_ascii=False),
            sentiment,
            summary,
            data_quality,
            has_discrepancy,
            risk_level,
            json.dumps(key_concerns, ensure_ascii=False),
            follow_up_needed,
            tagging_model,
            json.dumps(counselor_recommendations, ensure_ascii=False),
            conversation_depth,
            engagement_score,
            action_intent,
            json.dumps(nutrition_tags, ensure_ascii=False),
        ))

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
            # 태그 없거나 규칙 기반인 세션만
            if hospital_id:
                query = """
                    SELECT l.session_id, l.partner_id
                    FROM welno.tb_partner_rag_chat_log l
                    LEFT JOIN welno.tb_chat_session_tags t
                        ON l.session_id = t.session_id AND l.partner_id = t.partner_id
                    WHERE l.hospital_id = %s
                      AND (t.session_id IS NULL OR t.tagging_model = 'rule-based' OR t.tagging_model IS NULL)
                    ORDER BY l.created_at DESC
                """
                sessions = await db_manager.execute_query(query, (hospital_id,))
            else:
                query = """
                    SELECT l.session_id, l.partner_id
                    FROM welno.tb_partner_rag_chat_log l
                    LEFT JOIN welno.tb_chat_session_tags t
                        ON l.session_id = t.session_id AND l.partner_id = t.partner_id
                    WHERE t.session_id IS NULL OR t.tagging_model = 'rule-based' OR t.tagging_model IS NULL
                    ORDER BY l.created_at DESC
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

            # 속도 제한: 5건마다 1초 대기
            if (i + 1) % 5 == 0:
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
                   created_at, updated_at
            FROM welno.tb_chat_session_tags
            WHERE session_id = %s AND partner_id = %s
        """
        result = await db_manager.execute_one(query, (session_id, partner_id))
        return result
    except Exception as e:
        logger.warning(f"[태깅] 태그 조회 실패: {session_id} - {e}")
        return None
