"""v3 멀티채널 태깅 테스트 — standalone (패키지 import 우회)"""
import asyncio
import json
import psycopg2
from datetime import datetime

# DB 직접 연결
DB_DSN = "postgresql://peernine:autumn3334!@localhost:5434/p9_mkt_biz"

# Gemini API
GEMINI_API_KEY = "AIzaSyDiTnB4H1rBe7MERVhHKDOYHNdCq8CUwRE"

def get_session_data(session_id):
    """DB에서 세션 컨텍스트 + 메시지 로드"""
    conn = psycopg2.connect(DB_DSN)
    cur = conn.cursor()
    cur.execute("""
        SELECT initial_data, conversation, user_uuid, hospital_id, message_count
        FROM welno.tb_partner_rag_chat_log
        WHERE session_id = %s
    """, (session_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return None
    initial_data = row[0] if isinstance(row[0], dict) else json.loads(row[0]) if row[0] else {}
    conversation = row[1] if isinstance(row[1], list) else json.loads(row[1]) if row[1] else []
    return {
        "health_metrics": initial_data.get("health_metrics", {}),
        "patient_info": initial_data.get("patient_info", {}),
        "medical_history": initial_data.get("medical_history", []),
        "user_uuid": row[2],
        "hospital_id": row[3],
        "message_count": row[4],
        "conversation": conversation,
    }


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


def format_health_data(hm, pi, mh):
    """검진수치+환자프로필+병력 → LLM 텍스트"""
    sections = []
    if pi:
        age_str = ""
        if pi.get("birth_date"):
            try:
                from dateutil.relativedelta import relativedelta
                bd = datetime.strptime(str(pi["birth_date"])[:10], "%Y-%m-%d")
                age = relativedelta(datetime.now(), bd).years
                age_str = f"{age}세"
            except:
                pass
        gender_map = {"M": "남성", "F": "여성", "male": "남성", "female": "여성"}
        gender_str = gender_map.get(pi.get("gender", ""), "")
        if age_str or gender_str:
            sections.append(f"[환자 프로필]\n나이: {age_str or '미상'}, 성별: {gender_str or '미상'}")

    if hm:
        checkup_date = hm.get("checkup_date", "")
        header = f"[검진 데이터]{f' (검진일: {checkup_date})' if checkup_date else ''}"
        lines = []
        for key, label in METRIC_LABELS.items():
            val = hm.get(key)
            if val is None or val == "" or val == 0:
                continue
            range_val = hm.get(f"{key}_range", "")
            abnormal = hm.get(f"{key}_abnormal", "정상")
            range_part = f" (기준: {range_val})" if range_val else ""
            lines.append(f"{label}: {val}{range_part} → {abnormal}")
        if lines:
            sections.append(header + "\n" + "\n".join(lines))

    if mh:
        history_text = ", ".join(str(h) for h in mh if h)
        sections.append(f"[병력]\n{history_text}" if history_text else "[병력]\n(해당 사항 없음)")

    return "\n\n".join(sections)


def format_messages(conversation):
    """대화 포맷"""
    conv_lines = []
    user_turn = 0
    for msg in conversation:
        content = msg.get("content", "").strip()
        if not content:
            continue
        if msg.get("role") == "user":
            user_turn += 1
            conv_lines.append(f"[환자 질문 #{user_turn}] {content}")
        else:
            conv_lines.append(f"[상담사 답변 #{user_turn}] {content}")
    return "\n".join(conv_lines), user_turn


def test_session(session_id):
    """단일 세션 v3 테스트"""
    data = get_session_data(session_id)
    if not data:
        print(f"  ❌ 세션 없음")
        return

    hm = data["health_metrics"]
    pi = data["patient_info"]
    mh = data["medical_history"]
    conv = data["conversation"]

    print(f"  message_count: {data['message_count']}")
    print(f"  health_metrics 필드: {len(hm)}개")
    print(f"  patient_info: {pi}")
    print(f"  medical_history: {mh}")

    # 검진 프롬프트 포맷
    health_text = format_health_data(hm, pi, mh)
    print(f"\n  [프롬프트 — 검진 컨텍스트]")
    print(f"  {health_text}")

    # 대화 포맷
    conv_text, turns = format_messages(conv)
    print(f"\n  [프롬프트 — 대화] ({turns}턴)")
    for line in conv_text.split("\n")[:6]:
        print(f"  {line[:80]}...")

    # 설문 (Redis — 로컬에서 접근 불가이므로 스킵 표시)
    print(f"\n  [설문] Redis 10.0.1.10 — 로컬에서 접근 불가 (서버 배포 후 테스트)")

    # v2 → v3 비교를 위해 기존 태그 확인
    conn = psycopg2.connect(DB_DSN)
    cur = conn.cursor()
    cur.execute("""
        SELECT tagging_version, prospect_type, medical_urgency, anxiety_level,
               hospital_prospect_score, medical_tags, lifestyle_tags,
               conversation_summary
        FROM welno.tb_chat_session_tags WHERE session_id = %s
    """, (session_id,))
    existing = cur.fetchone()
    cur.close()
    conn.close()

    if existing:
        print(f"\n  [기존 태그 (v{existing[0]})]")
        print(f"  prospect_type: {existing[1]}")
        print(f"  medical_urgency: {existing[2]}")
        print(f"  anxiety_level: {existing[3]}")
        print(f"  hospital_prospect_score: {existing[4]}")
        print(f"  medical_tags: {existing[5]}")
        print(f"  lifestyle_tags: {existing[6]}")
        print(f"  summary: {str(existing[7])[:100]}")

    return data


def main():
    test_sessions = [
        "medilinx_ebc34a39f6cc3c0c_1772506538",  # 6턴, 풍부한 수치
        "medilinx_ed55eb04cb570c40_1771584932",    # 3턴, data_len 1476
    ]

    for sid in test_sessions:
        print(f"\n{'='*70}")
        print(f"세션: {sid}")
        print(f"{'='*70}")
        test_session(sid)

    print(f"\n\n✅ 프롬프트 포맷 검증 완료.")
    print(f"실제 LLM 호출은 서버 배포 후 retag_all_sessions()로 실행합니다.")


if __name__ == "__main__":
    main()
