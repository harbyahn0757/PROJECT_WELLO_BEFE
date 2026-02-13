"""
채팅 세션 자동 태깅 서비스

대화 완료 후 비동기로 호출되어 interest_tags, risk_tags, sentiment 등을 자동 분석하고 DB에 저장합니다.
"""

import logging
import json
from typing import Dict, Any, Optional, List
from datetime import datetime

from ..core.database import db_manager

logger = logging.getLogger(__name__)


# 관심사 키워드 사전
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

# 감정 키워드 사전
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


def extract_keyword_tags(messages: List[Dict[str, str]]) -> List[str]:
    """대화에서 핵심 키워드 태그 추출 (모든 interest 키워드의 매칭 결과)"""
    all_text = " ".join(m.get("content", "") for m in messages)
    matched = set()
    for keywords in INTEREST_KEYWORDS.values():
        for kw in keywords:
            if kw in all_text:
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
    """대화 내용을 1-2문장으로 요약 (간이 버전 — LLM 없이 규칙 기반)"""
    user_messages = [m.get("content", "") for m in messages if m.get("role") == "user"]
    if not user_messages:
        return ""
    # 첫 질문 + 마지막 질문을 조합
    first_q = user_messages[0][:60]
    if len(user_messages) > 1:
        last_q = user_messages[-1][:60]
        return f"첫 질문: {first_q} / 마지막 질문: {last_q} (총 {len(user_messages)}회 질문)"
    return f"질문: {first_q}"


async def tag_chat_session(
    session_id: str,
    partner_id: str,
    messages: List[Dict[str, str]],
    health_metrics: Optional[Dict[str, Any]] = None,
    has_discrepancy: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    대화 세션에 대한 자동 태깅 수행 및 DB 저장

    Args:
        session_id: 세션 ID
        partner_id: 파트너 ID
        messages: 대화 메시지 리스트 [{"role": "user"|"assistant", "content": "..."}]
        health_metrics: 검진 데이터 (있는 경우)
        has_discrepancy: CLIENT_RAG_DISCREPANCY 발생 여부

    Returns:
        저장된 태그 데이터 또는 None
    """
    try:
        interest_tags = extract_interest_tags(messages)
        risk_tags = extract_risk_tags(health_metrics or {})
        keyword_tags = extract_keyword_tags(messages)
        sentiment = detect_sentiment(messages)
        data_quality = calculate_data_quality_score(health_metrics or {})
        summary = await generate_conversation_summary(messages)

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
        }

        # DB 저장 (Upsert)
        upsert_query = """
            INSERT INTO welno.tb_chat_session_tags
            (session_id, partner_id, interest_tags, risk_tags, keyword_tags,
             sentiment, conversation_summary, data_quality_score, has_discrepancy)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (session_id, partner_id) DO UPDATE SET
                interest_tags = EXCLUDED.interest_tags,
                risk_tags = EXCLUDED.risk_tags,
                keyword_tags = EXCLUDED.keyword_tags,
                sentiment = EXCLUDED.sentiment,
                conversation_summary = EXCLUDED.conversation_summary,
                data_quality_score = EXCLUDED.data_quality_score,
                has_discrepancy = EXCLUDED.has_discrepancy,
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
        ))

        logger.info(f"🏷️ [태깅] 세션 태깅 완료: {session_id} - "
                     f"interest={len(interest_tags)}, risk={len(risk_tags)}, "
                     f"sentiment={sentiment}, quality={data_quality}")
        return tag_data

    except Exception as e:
        logger.warning(f"⚠️ [태깅] 세션 태깅 실패: {session_id} - {e}")
        return None


async def get_session_tags(session_id: str, partner_id: str) -> Optional[Dict[str, Any]]:
    """세션 태그 조회"""
    try:
        query = """
            SELECT interest_tags, risk_tags, keyword_tags, sentiment,
                   conversation_summary, data_quality_score, has_discrepancy,
                   created_at, updated_at
            FROM welno.tb_chat_session_tags
            WHERE session_id = %s AND partner_id = %s
        """
        result = await db_manager.execute_one(query, (session_id, partner_id))
        return result
    except Exception as e:
        logger.warning(f"⚠️ [태깅] 태그 조회 실패: {session_id} - {e}")
        return None
