"""
B2B CRM 태깅 v2 — Prompt + v1 호환 매핑

SoT: docs/spec/B2B_TAGGING_SYSTEM_v2.md
LLM: Gemini 2.5-flash-lite (chat_tagging endpoint)
출력: health_concerns / industry_scores (5 산업군) / signals / sentiment / risk_level / summary
v1 호환: 알고리즘 매핑으로 자동 생성 (LLM 출력 부담 X)
"""
from __future__ import annotations
from typing import Dict, List, Any, Optional


# ─── Prompt v2 ─────────────────────────────────────────────────────

INDUSTRY_DEFS = """
[5 산업군 정의 — 각 산업군 별 0~100 score + 6-stage funnel]
1. hospital — 의료기관 (검진/외래/응급/재검). sub: recall/additional_test/consultation/emergency/chronic_followup
2. supplement — 건기식/영양제. sub: 혈압관리/혈당관리/간보호/관절/면역/다이어트/뇌건강
3. fitness — 헬스장/PT/운동. sub: 체중관리/근력증진/유산소/재활/노년건강
4. insurance — 보험. sub: 실손/암/건강/치아/간병
5. mental_care — 심리상담. sub: 불안/우울/스트레스/수면/관계

[Funnel 6-stage]
- none: 신호 없음 (score 0~10)
- awareness: 인지만 (score 10~30) — 가벼운 호기심, 1~2 질문
- interest: 흥미 (score 30~50) — 반복 질문, 정보 탐색
- consider: 고민 (score 50~70) — 효과/가격/시기 비교
- decision: 결정 (score 70~85) — 구체 플랜, 의지 표현
- action: 행동 (score 85~100) — 예약/구매 의사 명시
""".strip()


def build_prompt_v2(
    conversation_text: str,
    total_user_turns: int,
    context_section: str = "",
    conv_pattern: str = "",
) -> str:
    """B2B CRM v2.1 태깅 prompt 생성. 강화 룰 (P1~P4)."""
    return f"""건강상담 대화를 B2B CRM 관점에서 분석합니다.
환자(수검자) 질문과 상담사(AI) 답변이 턴 번호(#)로 구분됩니다.

⚠️ 절대 원칙 (위반 시 결과 무효):
1. health_concerns / industry_scores / evidence_quotes 는 [환자 질문]에서만 추출. 상담사 답변/안내 절대 인용 금지.
2. industry_scores 는 5 산업군 모두 점수 (0~100) — 환자가 직접 언급/질문 안 했으면 score 0, stage "none"
3. signals 는 default 사용 금지 — 대화 패턴에 따라 명확히 차별화

{INDUSTRY_DEFS}

{context_section}

{conv_pattern}

[대화] (총 {total_user_turns}턴)
{conversation_text}

[출력 schema — JSON only]
{{
  "summary": "환자가 ~를 질문하고, 상담사가 ~를 안내함 (1-2문장)",

  "sentiment": "worried|curious|confused|negative|positive|grateful|neutral",
  "risk_level": "low|medium|high",
  "follow_up_needed": true|false,

  "health_concerns": [
    {{"topic": "혈압|혈당|콜레스테롤|간|신장|비만|정신건강|갑상선|일반",
      "intensity": "low|medium|high",
      "evidence": "환자 발화 그대로 인용 — 답변/안내 텍스트 금지"}}
  ],

  "industry_scores": {{
    "hospital":    {{"score": 0-100, "stage": "none|awareness|interest|consider|decision|action", "sub_categories": ["recall","consultation",...]}},
    "supplement":  {{"score": 0-100, "stage": "...", "sub_categories": ["혈압관리","간보호",...]}},
    "fitness":     {{"score": 0-100, "stage": "...", "sub_categories": ["체중관리",...]}},
    "insurance":   {{"score": 0-100, "stage": "...", "sub_categories": ["실손","암",...]}},
    "mental_care": {{"score": 0-100, "stage": "...", "sub_categories": ["불안","우울",...]}}
  }},

  "signals": {{
    "urgency": "urgent|normal|relaxed",
    "readiness": "committed|considering|postponed",
    "timeline_days": 0-365,
    "anxiety_level": "low|medium|high",
    "buying_intent": "strong|exploring|none"
  }},

  "evidence_quotes": ["환자 발화1", "환자 발화2", "환자 발화3"],
  "key_concerns": ["환자가 표현한 우려 -- 최대 3개"]
}}

[P1] evidence_quotes / health_concerns.evidence — 환자 발화 strict
- 절대 사용 금지: "고객님의 ~수치는...", "정상 범위 안에 있더라도...", "권해요/추천해요" — 모두 상담사 답변
- 사용 OK: 환자가 직접 묻거나 표현한 발화만. (예: "간 수치를 낮추려면?", "걱정돼요")
- 환자 발화 부족하면 evidence_quotes 빈 배열 [] 또는 1~2개만 (상담사 답변으로 채우지 말 것)

[P2] signals 차별화 — default 출력 금지
- urgency:
  - "urgent" — 검진 high 위험 + 환자가 "빨리/즉시/지금/바로" 단어 사용
  - "relaxed" — 검진 정상 + 환자 단순 호기심
  - "normal" — 그 외 (default 아님, 명시 판정)
- readiness:
  - "committed" — 환자가 "할게요/하겠습니다/예약/신청/시작" 명시
  - "postponed" — 환자가 "나중에/괜찮아요/다음에" 명시
  - "considering" — 환자가 정보 탐색 중 (default)
- buying_intent:
  - "strong" — 환자가 "어디서/얼마/추천해줘/사고싶다" 등 구매 단어
  - "none" — 구매/소비 단어 0건
  - "exploring" — 영양제/약 등 언급은 하지만 구매 의향 명시 X
- timeline_days: 환자가 "이번주/다음달/3개월" 등 시기 명시 시 매핑. 없으면 365

[P3] industry_scores — 환자 발화 strict (상담사 답변 무관)
- hospital: 환자가 "재검/병원 가야하나/진료/예약/응급" 등 언급
- supplement: 환자가 "영양제/비타민/오메가3/약/보충제" 등 직접 질문
- fitness: 환자가 "운동/다이어트/PT/체중감량/헬스장" 등 **직접** 질문 (상담사 권유는 fitness 0)
- insurance: 환자가 "보험/실손/암보험" 등 언급
- mental_care: 환자가 "잠/스트레스/우울/불안" 등 언급
- 답변에 운동 안내가 나와도 환자가 묻지 않으면 fitness score = 0

[P4] Stage 판정 룰 (consider 편중 방지)
- "none" (score 0~10) — 산업군 신호 없음
- "awareness" (10~30) — 1턴 + 단순 인사/확인 ("네", "알겠어요")
- "interest" (30~50) — 환자가 정보 탐색 ("증상이 뭐예요?", "왜 그런가요?")
- "consider" (50~70) — 효과/방법/시기 비교 ("어떻게 관리?", "효과가 있나요?")
- "decision" (70~85) — 구체 행동 의지 ("재검 받을게요", "운동 시작해야겠어요")
- "action" (85~100) — 즉시 실행 의사 ("예약하고 싶어요", "어디서 사나요?")

JSON 외 텍스트 출력 금지. 위 P1~P4 위반 시 결과 무효.""".strip()


# ─── v2 → v1 호환 매핑 (백오피스 5 페이지 유지) ────────────────────

_STAGE_TO_PROSPECT = {
    "none":      "low_engagement",
    "awareness": "low_engagement",
    "interest":  "lifestyle_improvable",
    "consider":  "borderline_worried",
    "decision":  "needs_visit",
    "action":    "needs_visit",
}

_BUYING_MAP = {"strong": "high", "exploring": "mid", "none": "low"}
_READINESS_TO_INTENT = {"committed": "active", "considering": "considering", "postponed": "passive"}


def build_v1_compat_fields(v2_tags: Dict[str, Any], message_count: int) -> Dict[str, Any]:
    """v2 출력 → v1 컬럼 매핑 (백오피스 호환).

    1개월 병행기간 후 v1 컬럼 DROP 예정. 그동안 매 태깅마다 두 형식 모두 채움.
    """
    industry_scores = v2_tags.get("industry_scores", {}) or {}
    hospital = industry_scores.get("hospital", {}) or {}
    signals = v2_tags.get("signals", {}) or {}
    health_concerns = v2_tags.get("health_concerns", []) or []

    # prospect_type — hospital stage 기반
    h_stage = hospital.get("stage", "none")
    prospect_type = _STAGE_TO_PROSPECT.get(h_stage, "chronic_management")

    # 만성질환 override — health_concerns 에 chronic 항목 + intensity high 면 chronic_management 우선
    chronic_topics = {"혈압", "혈당", "콜레스테롤"}
    chronic_high = any(
        c.get("topic") in chronic_topics and c.get("intensity") == "high"
        for c in health_concerns
        if isinstance(c, dict)
    )
    if chronic_high and h_stage in ("interest", "consider"):
        prospect_type = "chronic_management"

    # buying_signal / action_intent
    buying_intent = signals.get("buying_intent", "none")
    buying_signal = _BUYING_MAP.get(buying_intent, "low")

    readiness = signals.get("readiness", "postponed")
    action_intent = _READINESS_TO_INTENT.get(readiness, "passive")

    # anxiety_level — signals 우선
    anxiety_level = signals.get("anxiety_level", "low")

    # interest_tags = health_concerns 1:1 매핑
    interest_tags = [
        {"topic": c.get("topic"), "intensity": c.get("intensity", "medium")}
        for c in health_concerns
        if isinstance(c, dict) and c.get("topic")
    ]

    # engagement_score — message_count + readiness 기반 (LLM 출력 X, 알고리즘)
    base_engagement = min(40, message_count * 5)
    if readiness == "committed":
        base_engagement += 30
    elif readiness == "considering":
        base_engagement += 15
    if buying_intent == "strong":
        base_engagement += 20
    engagement_score = min(100, base_engagement)

    # conversation_depth — message_count 기반
    if message_count >= 6:
        depth = "deep"
    elif message_count >= 3:
        depth = "moderate"
    else:
        depth = "shallow"

    # hospital_prospect_score — industry_scores.hospital.score 직접 사용
    hospital_prospect_score = int(hospital.get("score", 0))

    # medical_urgency — signals.urgency 매핑
    urgency_map = {"urgent": "urgent", "normal": "normal", "relaxed": "normal"}
    medical_urgency = urgency_map.get(signals.get("urgency", "normal"), "normal")

    # medical_tags / lifestyle_tags / nutrition_tags — health_concerns + sub_categories 기반
    medical_tags = [c.get("topic") for c in health_concerns if isinstance(c, dict) and c.get("topic")]
    lifestyle_tags = []
    fitness_subs = (industry_scores.get("fitness", {}) or {}).get("sub_categories", []) or []
    if fitness_subs:
        lifestyle_tags.extend(fitness_subs)
    nutrition_tags = (industry_scores.get("supplement", {}) or {}).get("sub_categories", []) or []

    # commercial_tags — supplement industry_scores 기반 (deprecated 알림톡 매핑용)
    commercial_tags = []
    supp = industry_scores.get("supplement", {}) or {}
    if supp.get("score", 0) >= 50:
        for sub in supp.get("sub_categories", []) or []:
            commercial_tags.append({
                "category": sub,
                "product_hint": "",  # v1 prompt 가 채우던 product_hint — 1개월 후 deprecated
                "segment": "고관여" if supp.get("score", 0) >= 70 else "일반",
            })

    return {
        "interest_tags": interest_tags,
        "prospect_type": prospect_type,
        "hospital_prospect_score": hospital_prospect_score,
        "buying_signal": buying_signal,
        "action_intent": action_intent,
        "anxiety_level": anxiety_level,
        "engagement_score": engagement_score,
        "conversation_depth": depth,
        "classification_confidence": 0.85,  # v2 는 confidence 추출 안 함 (placeholder)
        "medical_urgency": medical_urgency,
        "medical_tags": medical_tags,
        "lifestyle_tags": lifestyle_tags,
        "nutrition_interests": nutrition_tags,
        "commercial_tags": commercial_tags,
        "counselor_recommendations": [],  # v2 prompt 미추출 (deprecated)
    }


# ─── v2 출력 검증 ──────────────────────────────────────────────────

VALID_INDUSTRIES = {"hospital", "supplement", "fitness", "insurance", "mental_care"}
VALID_STAGES = {"none", "awareness", "interest", "consider", "decision", "action"}
VALID_INTENSITIES = {"low", "medium", "high"}


def validate_v2_tags(tags: Dict[str, Any]) -> Optional[str]:
    """v2 태그 검증. 에러 메시지 반환 (None=통과)."""
    if not isinstance(tags, dict):
        return "tags is not dict"

    industry_scores = tags.get("industry_scores")
    if not isinstance(industry_scores, dict):
        return "industry_scores missing"

    for ind in VALID_INDUSTRIES:
        d = industry_scores.get(ind)
        if not isinstance(d, dict):
            return f"industry_scores.{ind} missing"
        score = d.get("score", 0)
        if not isinstance(score, (int, float)) or not (0 <= score <= 100):
            return f"industry_scores.{ind}.score invalid: {score}"
        if d.get("stage") not in VALID_STAGES:
            return f"industry_scores.{ind}.stage invalid: {d.get('stage')}"

    signals = tags.get("signals", {})
    if not isinstance(signals, dict):
        return "signals missing"

    return None  # OK


def normalize_v2_tags(tags: Dict[str, Any]) -> Dict[str, Any]:
    """v2 태그 정규화 — 누락 필드 default 채움."""
    industry_scores = tags.setdefault("industry_scores", {})
    for ind in VALID_INDUSTRIES:
        d = industry_scores.setdefault(ind, {})
        d.setdefault("score", 0)
        d.setdefault("stage", "none")
        d.setdefault("sub_categories", [])
        # clamp
        d["score"] = max(0, min(100, int(d.get("score", 0))))
        if d["stage"] not in VALID_STAGES:
            d["stage"] = "none"

    signals = tags.setdefault("signals", {})
    signals.setdefault("urgency", "normal")
    signals.setdefault("readiness", "postponed")
    signals.setdefault("timeline_days", 30)
    signals.setdefault("anxiety_level", "low")
    signals.setdefault("buying_intent", "none")

    tags.setdefault("health_concerns", [])
    tags.setdefault("evidence_quotes", [])
    tags.setdefault("key_concerns", [])
    tags.setdefault("sentiment", "neutral")
    tags.setdefault("risk_level", "low")
    tags.setdefault("summary", "")
    tags.setdefault("follow_up_needed", False)

    return tags
