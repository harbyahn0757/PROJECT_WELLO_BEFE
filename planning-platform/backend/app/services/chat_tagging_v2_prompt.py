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
    """B2B CRM v3 태깅 prompt 생성. Fix 1~6 통합 강화."""
    return f"""건강상담 대화를 B2B CRM 관점에서 분석합니다.
환자(수검자) 질문과 상담사(AI) 답변이 턴 번호(#)로 구분됩니다.

⚠️ 절대 원칙:
1. health_concerns / industry_scores / evidence_quotes 는 [환자 질문]에서만 추출. 상담사 답변/안내 절대 인용 금지.
2. industry_scores 는 5 산업군 모두 점수 (0~100). 환자가 직접 언급/질문 안 했으면 score 0, stage "none"
3. signals 는 default 출력 금지 — 환자 단어 패턴으로 명확히 차별화
4. composite_risk 는 검진 수치 + 환자 표현 + 시급성 종합 4 단계 (critical/high/medium/low)

[signals 차별화 핵심 패턴 — 스키마 앞 우선 학습]
환자: "혈압 약 시작해야 할까요? 빨리 알려주세요"
→ {{urgency: "urgent", readiness: "committed", buying_intent: "exploring"}}

환자: "혈압 좀 걱정되네요"
→ {{urgency: "normal", readiness: "considering", buying_intent: "none"}}

환자: "그렇군요, 알겠어요"
→ {{urgency: "relaxed", readiness: "postponed", buying_intent: "none"}}

환자: "오메가3 어디서 사나요? 추천 좀"
→ {{urgency: "normal", readiness: "committed", buying_intent: "strong"}}

환자: "오메가3 효과 있나요?"
→ {{urgency: "normal", readiness: "considering", buying_intent: "exploring"}}

환자: "다음 검진 언제? 나중에 받을게요"
→ {{urgency: "relaxed", readiness: "postponed", buying_intent: "none"}}

환자: "지금 당장 진료 받아야 하나요?"
→ {{urgency: "urgent", readiness: "considering", buying_intent: "none"}}

⚠️ 위 7개 패턴 중 1개 이상 매칭 안 되면 default 사용 — 그 외엔 default 금지.

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

  "composite_risk": {{
    "overall": "critical|high|medium|low",
    "factors": {{
      "metric_severity": "high|medium|low",
      "patient_concern": "high|medium|low",
      "urgency": "urgent|normal|relaxed"
    }},
    "reason": "검진 수치 + 환자 표현 + 시급성 결정 근거 (1문장)"
  }},

  "health_concerns": [
    {{"topic": "혈압|혈당|콜레스테롤|간|신장|비만|정신건강|갑상선|일반",
      "intensity": "low|medium|high",
      "intent": "concern|info_seek|action|curiosity",
      "evidence": "환자 발화 그대로 인용"}}
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
  "key_concerns": ["환자가 표현한 우려 -- 최대 3개"],

  "action_intent": "passive|considering|active",
  "counselor_recommendations": ["상담사 행동 권고 -- 최대 3개 (예: 알림톡 발송, 재방문 유도)"],
  "conversation_depth": "shallow|medium|deep",
  "engagement_score": 0,
  "buying_signal": "low|mid|high",
  "nutrition_interests": ["영양제 카테고리 -- 환자 직접 언급한 것만"],
  "commercial_tags": ["상품 카테고리 -- LLM 판단"]
}}

[P1] evidence / health_concerns.evidence — 환자 발화 strict
- 절대 금지: "고객님의 수치는...", "정상 범위 안에 있어도...", "권해요/추천해요" — 모두 상담사 답변
- 사용 OK: 환자가 직접 묻거나 표현한 발화 (예: "간 수치를 낮추려면?", "걱정돼요")
- 환자 발화 부족하면 evidence_quotes 빈 배열 [] (상담사 답변 인용 금지)
- ⚠️ evidence_quotes 빈 배열이면 risk_level="high" 절대 금지 (강제 medium 강등)

[P2 통합됨 — 스키마 앞 7 패턴 학습으로 대체. 토큰 절감 Fix 8]

[P3] industry_scores — 환자 발화 strict
- hospital: 환자가 "재검/병원/진료/예약/응급" 직접 언급
- supplement: 환자가 "영양제/비타민/오메가3/약/보충제" 직접 질문
- fitness: 환자가 "운동/다이어트/PT/체중감량/헬스장" **직접** 질문 (상담사 권유는 fitness 0)
- insurance: 환자가 "보험/실손/암보험" 언급
- mental_care: 환자가 "잠/스트레스/우울/불안" 언급
- 답변에 나와도 환자가 묻지 않으면 score 0

[P4] Stage 판정
- "none" (0~10): 산업군 신호 없음
- "awareness" (10~30): 1턴 + 단순 인사 ("네", "알겠어요")
- "interest" (30~50): 정보 탐색 ("증상이 뭐예요?", "왜 그런가요?")
- "consider" (50~70): 효과/방법 비교 ("어떻게 관리?", "효과 있나요?")
- "decision" (70~85): 구체 의지 ("재검 받을게요", "시작해야겠어요")
- "action" (85~100): 즉시 실행 ("예약할게요", "어디서 사나요?")

[P5] risk_level 결정 룰 (Fix 4 강화 — over-reach 방지)

CRITICAL: 검진 수치만 보고 "환자가 우려할 것" 추정 금지. **환자 발화 원문에 명시적 우려 단어가 있어야** high.

- "high": (검진 수치 high 위험 1개+) AND (환자 발화에 명시적 우려/증상/긴급 단어)
  ✅ 우려 단어 예: "걱정돼요", "괜찮나요?", "위험한가요?", "큰일나요?", "심각한가요?", "죽을것같아요", "아파요"
  ❌ 단순 정보 질문은 우려 NOT: "어때?", "어떤가요?", "낮은가요?", "높은가요?", "뭐예요?", "왜?", "어떤부분?"
- "medium": 검진 수치 medium 위험 OR (high 1개+ AND 환자 발화 단순 정보 질문)
- "low": 검진 정상 OR 환자 단순 정보/요약 요청 ("결과 다운로드", "요약해줘", "비교해줘")

⚠️ 강제 룰 (위반 시 결과 무효):
1. 환자 발화에 명시적 우려 단어 0건 (sentiment=neutral/curious 도 동일) → risk_level="high" 절대 금지 (medium 까지만 가능)
2. user_messages 1~3건 + 단순 정보 질문 + **검진 abnormal 2건 이하** → risk_level 한 단계 강등
   ⚠️ 검진 abnormal 3건+ 환자는 짧은 발화여도 medium 유지 (의료진 follow-up 누락 방지)
3. composite_risk.reason 단어 → risk_level 일치 필수:
   - reason 에 "중간 수준" / "중간 정도" → risk_level="medium"
   - reason 에 "낮음" / "낮은 수준" / "정상 수준" → risk_level="low"
   - reason 에 "심각" / "위험" / "긴급" / "즉시" → risk_level="high" (단 강제룰 1 위반 시 medium)
4. composite_risk.level="critical" 출력 시 → risk_level="high" 일치 필수 (백엔드에서도 강제됨)
5. evidence_quotes 빈 배열 [] → risk_level="high" 절대 금지 (Fix 7 — 강제룰 1 과 일관, 백엔드 강등)

[P6] composite_risk 4 단계 결정 룰 (NEW — CRM 우선순위 핵심)
- "critical": metric_severity=high AND patient_concern=high AND urgency=urgent
  → 의료진 즉시 알림 (Slack push)
- "high": (metric=high AND concern≥medium) OR (metric=high AND urgency=urgent)
  → 알림톡 우선 발송
- "medium": metric=medium 또는 concern=high
  → 콘텐츠 발송
- "low": 검진 정상 또는 환자 무관심
  → 가벼운 정보만
- reason 필드 필수 — 결정 근거 1문장 (예: "AST 75 high + 환자 '걱정돼요' 명시 + 즉시 단어")

[health_concerns intent — Fix 2 (NEW)]
- "concern": 환자가 우려/걱정 표현 ("걱정돼요", "괜찮나요?")
- "info_seek": 정보 탐색 ("뭐예요?", "왜 그런가요?")
- "action": 행동 의지 ("어떻게 관리?", "낮추려면?")
- "curiosity": 단순 호기심 ("궁금해서요")

JSON 외 텍스트 출력 금지. 위 P1~P6 위반 시 결과 무효.""".strip()


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

    # v3 — interest_tags 의 intent → action_intent 매핑 (Fix 2)
    if health_concerns:
        intents = [c.get("intent") for c in health_concerns if isinstance(c, dict)]
        if intents.count("action") >= 1:
            action_intent = "active"
        elif intents.count("concern") >= 2:
            action_intent = "considering"

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
VALID_COMPOSITE_OVERALL = {"critical", "high", "medium", "low"}
VALID_INTENT = {"concern", "info_seek", "action", "curiosity"}


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

    # v3 — composite_risk normalize
    cr = tags.setdefault("composite_risk", {})
    cr.setdefault("overall", "low")
    if cr["overall"] not in VALID_COMPOSITE_OVERALL:
        cr["overall"] = "low"
    factors = cr.setdefault("factors", {})
    factors.setdefault("metric_severity", "low")
    factors.setdefault("patient_concern", "low")
    factors.setdefault("urgency", "normal")
    cr.setdefault("reason", "")

    # v3 — health_concerns 의 intent 필드 default
    for hc in tags.get("health_concerns", []) or []:
        if isinstance(hc, dict):
            intent = hc.get("intent")
            if intent not in VALID_INTENT:
                hc["intent"] = "info_seek"  # default

    return tags


# v3 — composite_risk → v1 risk_level 매핑 (백오피스 호환)
_COMPOSITE_TO_RISK_LEVEL = {
    "critical": "high",
    "high": "high",
    "medium": "medium",
    "low": "low",
}
