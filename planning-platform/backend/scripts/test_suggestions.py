"""
서제스천 파트너별 비교 테스트
프로덕션 모델(gemini-3-flash-preview) 사용

실행: cd planning-platform/backend && python3 -m scripts.test_suggestions
"""
import json
import os
import sys
import time
from pathlib import Path
import google.generativeai as genai

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

GEMINI_API_KEY = "AIzaSyCS9Drr0kHtlLEr4apvWR-JxxC2nkXBKjE"
genai.configure(api_key=GEMINI_API_KEY)

# ─── chat_tagging_service.py 함수 직접 인라인 (FAISS import 회피) ──

METRIC_LABELS = {
    "systolic_bp": "수축기 혈압", "diastolic_bp": "이완기 혈압",
    "fasting_glucose": "공복혈당", "total_cholesterol": "총콜레스테롤",
    "ldl_cholesterol": "LDL", "hdl_cholesterol": "HDL",
    "hemoglobin": "헤모글로빈", "sgot_ast": "AST(간수치)",
    "sgpt_alt": "ALT(간수치)", "gamma_gtp": "감마GTP",
    "creatinine": "크레아티닌", "gfr": "사구체여과율(GFR)",
    "bmi": "BMI", "triglycerides": "중성지방",
}

def extract_health_alerts(health_metrics):
    alerts = []
    if not health_metrics:
        return alerts
    for key, label in METRIC_LABELS.items():
        abnormal = health_metrics.get(f"{key}_abnormal", "")
        if abnormal and abnormal != "정상":
            val = health_metrics.get(key)
            alerts.append({"field": key, "label": label, "value": str(val or ""), "judgment": abnormal})
    return alerts

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

def build_suggestion_instruction(turn_number, health_alerts=None, partner_type="healthcare"):
    pt = partner_type if partner_type in _PARTNER_DIRECTION else "healthcare"
    lines = [
        "[서제스천 생성 규칙]",
        "답변 마지막에 반드시 후속 질문 3개를 아래 형식으로 생성하세요.",
        "형식: [SUGGESTIONS] 질문1 | 질문2 | 질문3 [/SUGGESTIONS]",
        "각 질문은 20자 이내, 경어체.",
        "",
        _PARTNER_DIRECTION[pt],
    ]
    if health_alerts:
        top = health_alerts[:3]
        items_str = ", ".join(f"{a['label']}({a['judgment']})" for a in top)
        lines.append(f"\n환자의 이상 항목: {items_str}")
    return "\n".join(lines)


# ─── 테스트 케이스 ──────────────────────────────────────────────

TEST_CASES = [
    {"id": "1", "desc": "ALT만 높은 남성 (실사례)", "query": "눈에 띄는 부분이 있다고 했는데 뭘까요?", "turn": 1,
     "hm": {"sgpt_alt": 53, "sgpt_alt_abnormal": "질환의심", "sgot_ast": 29, "sgot_ast_abnormal": "정상", "gamma_gtp": 23, "gamma_gtp_abnormal": "정상", "bmi": 22, "bmi_abnormal": "정상", "gfr": 90, "gfr_abnormal": "정상"}},
    {"id": "2", "desc": "GFR 14 신장 심각", "query": "신사구체여과율이 14로 나왔는데 추가 검진을 해야할까요?", "turn": 1,
     "hm": {"gfr": 14, "gfr_abnormal": "질환의심", "creatinine": 2.1, "creatinine_abnormal": "이상", "hemoglobin": 10.2, "hemoglobin_abnormal": "빈혈의심", "systolic_bp": 145, "systolic_bp_abnormal": "주의"}},
    {"id": "3", "desc": "전부 정상", "query": "내 검진 결과 어때?", "turn": 1,
     "hm": {"bmi": 23.5, "bmi_abnormal": "정상", "systolic_bp": 118, "systolic_bp_abnormal": "정상", "fasting_glucose": 88, "fasting_glucose_abnormal": "정상", "hemoglobin": 14.0, "hemoglobin_abnormal": "정상"}},
    {"id": "4", "desc": "콜레스테롤+혈압+혈당 복합", "query": "내 건강은 어때?", "turn": 1,
     "hm": {"total_cholesterol": 268, "total_cholesterol_abnormal": "이상", "ldl_cholesterol": 175, "ldl_cholesterol_abnormal": "이상", "triglycerides": 220, "triglycerides_abnormal": "이상", "systolic_bp": 148, "systolic_bp_abnormal": "주의", "bmi": 28.5, "bmi_abnormal": "과체중", "fasting_glucose": 112, "fasting_glucose_abnormal": "경계"}},
    {"id": "5", "desc": "2턴 — ALT 심화", "query": "다른 수치는 건강한데 ALT만 높은 경우는 무엇을 의미하나요?", "turn": 2,
     "hm": {"sgpt_alt": 53, "sgpt_alt_abnormal": "질환의심", "sgot_ast": 29, "sgot_ast_abnormal": "정상"}},
    {"id": "6", "desc": "3턴 — 개선법", "query": "운동이랑 식단으로 개선할 수 있나요?", "turn": 3,
     "hm": {"sgpt_alt": 53, "sgpt_alt_abnormal": "질환의심", "bmi": 22, "bmi_abnormal": "정상"}},
    {"id": "7", "desc": "빈혈+감량 여성", "query": "3개월동안 체중 6.8 뺐는데 어느정도 해야 되나요?", "turn": 1,
     "hm": {"hemoglobin": 10.5, "hemoglobin_abnormal": "빈혈의심", "bmi": 24.8, "bmi_abnormal": "정상"}},
    {"id": "8", "desc": "GGT만 높음+과체중", "query": "간 수치 GGT가 높다는데 어떤 의미인가요?", "turn": 1,
     "hm": {"gamma_gtp": 85, "gamma_gtp_abnormal": "이상", "bmi": 26.1, "bmi_abnormal": "과체중", "sgot_ast": 28, "sgot_ast_abnormal": "정상"}},
    {"id": "9", "desc": "녹내장+콜레스테롤", "query": "녹내장의증이 나왔는데 안과를 바로 가봐야할까?", "turn": 1,
     "hm": {"total_cholesterol": 245, "total_cholesterol_abnormal": "이상"}},
    {"id": "10", "desc": "2턴 정상환자 일반질문", "query": "건강해지는방법은?", "turn": 2,
     "hm": {"bmi": 23, "bmi_abnormal": "정상", "hemoglobin": 13.5, "hemoglobin_abnormal": "정상"}},
]


# ─── 프롬프트 ───────────────────────────────────────────────────

def old_sug_instruction(turn):
    if turn == 1:
        return "**중요**: 답변이 끝난 후 반드시 빈 줄을 하나 두고 '[SUGGESTIONS] 전체 결과 요약해줘, 이상 있는 항목만 알려줘, 생활습관 조언해줘 [/SUGGESTIONS]' 형식으로 포함하세요."
    return "**중요**: 답변이 끝난 후 반드시 빈 줄을 하나 두고, 사용자가 이어서 물어볼 법한 짧은 질문 2~3개를 '[SUGGESTIONS] 질문1, 질문2, 질문3 [/SUGGESTIONS]' 형식으로 포함하세요."


def new_sug_instruction(turn, hm, partner_type="healthcare"):
    alerts = extract_health_alerts(hm)
    return build_suggestion_instruction(turn_number=turn, health_alerts=alerts, partner_type=partner_type)


def build_health_ctx(hm):
    lines = []
    for key, label in METRIC_LABELS.items():
        val = hm.get(key)
        if val is None: continue
        abn = hm.get(f"{key}_abnormal", "정상")
        lines.append(f"{label}: {val} → {abn}")
    return "\n".join(lines)


def parse_suggestions(answer):
    if "[SUGGESTIONS]" not in answer:
        return []
    try:
        part = answer.split("[SUGGESTIONS]")[1].split("[/SUGGESTIONS]")[0]
        if "|" in part:
            return [s.strip() for s in part.split("|") if s.strip()][:3]
        return [s.strip() for s in part.split(",") if s.strip()][:3]
    except:
        return []


def call_gemini(system_prompt, user_prompt):
    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=system_prompt,
    )
    resp = model.generate_content(user_prompt)
    return resp.text


def run_test(case, mode, partner_type="healthcare"):
    health_ctx = build_health_ctx(case["hm"])
    system_prompt = (
        "당신은 건강검진 결과를 읽어주는 에이전트 '웰노'입니다.\n"
        "환자의 검진 데이터를 바탕으로 쉽고 친절하게 설명합니다.\n"
        "의학적 확정 진단은 하지 않고, 담당 의료진 상담을 안내합니다.\n"
        "답변은 짧은 문단으로, 마크다운 과용 금지.\n"
        f"\n[환자 검진 데이터]\n{health_ctx}\n\n"
    )
    if mode == "OLD":
        system_prompt += old_sug_instruction(case["turn"])
    else:
        system_prompt += new_sug_instruction(case["turn"], case["hm"], partner_type)

    t0 = time.time()
    try:
        answer = call_gemini(system_prompt, f"사용자 질문: {case['query']}")
    except Exception as e:
        return {"case_id": case["id"], "mode": mode, "partner_type": partner_type, "error": str(e)[:100]}

    elapsed = round((time.time() - t0) * 1000)
    suggestions = parse_suggestions(answer)
    return {
        "case_id": case["id"], "mode": mode, "partner_type": partner_type,
        "suggestions": suggestions,
        "has_suggestions": len(suggestions) > 0,
        "elapsed_ms": elapsed,
    }


def main():
    # 파트너별 비교: 대표 케이스 3개 × 3 파트너
    PARTNER_CASES = ["1", "4", "5"]  # ALT만/복합/2턴심화
    PARTNERS = ["hospital", "commerce", "healthcare"]

    print("=" * 80)
    print("서제스천 파트너별 비교 — hospital vs commerce vs healthcare")
    print("  모델: gemini-2.0-flash (프로덕션 동급) | 케이스: 3개 × 3파트너 = 9회")
    print("  표면: 자연스러운 건강 질문 / 이면: 파트너별 태깅 수집 전략")
    print("=" * 80)

    results = []
    for case in TEST_CASES:
        if case["id"] not in PARTNER_CASES:
            continue
        print(f"\n{'─'*70}")
        print(f"[Case {case['id']}] {case['desc']}")
        print(f"  질문(턴{case['turn']}): {case['query']}")
        abnormals = [f"{k.replace('_abnormal','')}: {v}" for k, v in case["hm"].items() if k.endswith("_abnormal") and v != "정상"]
        print(f"  이상: {', '.join(abnormals) if abnormals else '없음'}")

        for pt in PARTNERS:
            r = run_test(case, "NEW", partner_type=pt)
            results.append(r)
            if "error" in r:
                print(f"  [{pt:12s}] ERROR: {r['error']}")
            else:
                sugs = r["suggestions"]
                mark = "✅" if sugs else "❌"
                print(f"  [{pt:12s}] {mark} {r['elapsed_ms']}ms")
                for i, s in enumerate(sugs, 1):
                    print(f"       {i}. {s}")

        time.sleep(0.5)

    # 요약
    print(f"\n\n{'='*80}")
    print("파트너별 서제스천 톤 비교")
    print(f"{'='*80}")
    print("hospital  → 걱정/증상/병원방문 유도 (anxiety_level, prospect_type 수집)")
    print("commerce  → 식단/영양소/실천법 유도 (buying_signal, nutrition_tags 수집)")
    print("healthcare→ 생활습관/행동의지 유도 (lifestyle_tags, action_intent 수집)")
    for pt in PARTNERS:
        pt_r = [r for r in results if r.get("partner_type") == pt and "error" not in r]
        gen = sum(1 for r in pt_r if r.get("has_suggestions"))
        print(f"  {pt:12s} 생성률: {gen}/{len(pt_r)}")


if __name__ == "__main__":
    main()
