"""mediArc 리포트 AI 한 줄 요약 — GPT-4o-mini on-demand.

DB: welno.welno_mediarc_ai_summaries (hospital_id + patient_uuid UNIQUE)
프롬프트: 수검자 보조 톤, 80자 이내 1문단, 긍정 프레이밍, 근거 숫자 포함.
API 키: settings.openai_api_key (OPENAI_API_KEY) — 코드/config.json 하드코딩 금지.
"""
import hashlib
import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

MODEL = "gpt-4o-mini"
PROMPT_VERSION = "v2"
MAX_TOKENS = 200        # ~80자 한글 안전 마진
TEMPERATURE = 0.3


# ─── 유틸 ─────────────────────────────────────────────────────────────────────

def compute_input_digest(payload: Any) -> str:
    """sha256(json.dumps(sort_keys=True))[:64]. 리포트 변경 감지용."""
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:64]


# ─── 프롬프트 빌더 ─────────────────────────────────────────────────────────────

def _build_prompt_blocks(report: dict) -> tuple[str, str]:
    """spec 8.4.2 템플릿에 따른 system/user 분리.

    top_diseases_block : risk_level=high 상위 3개, {name} 하위 {rank}%
    present_factors_block: presence=True 최대 5개 (AppliedFactor 구조)
    improved_block: overall_improvement + top-2 rank 개선치
    """
    # ── 신체 나이 블록 ──
    bodyage_obj = report.get("bodyage") or {}
    if isinstance(bodyage_obj, dict):
        body_age_value = bodyage_obj.get("bodyage") or bodyage_obj.get("value") or "N/A"
        delta = bodyage_obj.get("delta")
    else:
        body_age_value = bodyage_obj
        delta = None

    if delta is not None:
        try:
            bio_diff_str = f"{int(delta):+d}"
        except (TypeError, ValueError):
            bio_diff_str = str(delta)
    else:
        bio_diff_str = "±0"

    # ── 상위 위험 질환 (high rank ≤ 30 기준, 최대 3개) ──
    diseases: dict = report.get("diseases") or {}
    high_diseases = []
    for code, d in diseases.items():
        if not isinstance(d, dict):
            continue
        rl = (d.get("risk_level") or "").lower()
        if rl in ("high", "moderate"):
            high_diseases.append((code, d))
    # rank 낮을수록 위험 (하위 %)
    high_diseases.sort(key=lambda x: (x[1].get("rank") or 100))
    top3 = high_diseases[:3]

    if top3:
        top_diseases_lines = [
            f"- {d.get('name') or code}: 하위 {d.get('rank') or '?'}%"
            for code, d in top3
        ]
        top_diseases_block = "\n".join(top_diseases_lines)
    else:
        top_diseases_block = "- 특이 위험 질환 없음"

    # ── 현존 위험 인자 (presence=true 최대 5개) ──
    all_factors = []
    for d in diseases.values():
        if not isinstance(d, dict):
            continue
        for f in (d.get("applied_factors") or []):
            if isinstance(f, dict) and f.get("presence"):
                name_val = f.get("factor") or f.get("name") or f.get("label")
                if name_val and name_val not in all_factors:
                    all_factors.append(name_val)

    if all_factors[:5]:
        present_factors_block = "\n".join(f"- {n}" for n in all_factors[:5])
    else:
        present_factors_block = "- 없음"

    # ── 개선 시나리오 ──
    improved_obj = report.get("improved") or {}
    overall = improved_obj.get("overall_improvement")
    if overall is not None:
        improved_lines = [f"- 전체 건강나이 개선: {overall:+.1f}세"]
        # top-2 질환 rank 개선
        for code, d in top3[:2]:
            ir = d.get("improved_rank")
            if ir is not None:
                improved_lines.append(
                    f"- {d.get('name') or code}: 개선 후 하위 {ir}%"
                )
        improved_block = "\n".join(improved_lines)
    else:
        improved_block = "- 시나리오 데이터 없음"

    system = (
        "당신은 한국어 건강검진 결과를 수검자 본인에게 설명하는 조력자입니다.\n"
        "다음 규칙을 엄격히 따르세요.\n\n"
        "- 한 문단, 최대 2문장, 80자 이내.\n"
        "- 의학적 진단 금지. '전문의 상담 권장' 같은 가이드라인 표현은 허용.\n"
        "- 긍정 프레이밍 우선 (강점 먼저, 위험 뒤).\n"
        "- 공포 유발 금지 ('큰일납니다', '위험합니다' 금지).\n"
        "- 숫자는 가공하지 말고 입력 그대로 사용.\n"
        "- 입력에 없는 정보는 만들어내지 말 것."
    )
    user = (
        f"아래 건강 요약을 한 문단으로 써주세요.\n\n"
        f"신체 나이: {body_age_value}세 (만 나이 대비 {bio_diff_str}세)\n"
        f"상위 위험 질환:\n{top_diseases_block}\n\n"
        f"현존 위험 인자:\n{present_factors_block}\n\n"
        f"개선 시나리오 (6개월 생활습관 가정):\n{improved_block}"
    )
    return system, user


def build_input_payload(report: dict) -> dict:
    """LLM 입력용 핵심 필드만 추출 (digest 계산 + 프롬프트 생성에 공통 사용)."""
    diseases_slim = {}
    for code, d in (report.get("diseases") or {}).items():
        if not isinstance(d, dict):
            continue
        diseases_slim[code] = {
            "name": d.get("name"),
            "rank": d.get("rank"),
            "risk_level": d.get("risk_level"),
            "improved_rank": d.get("improved_rank"),
            "applied_factors": [
                {"factor": f.get("factor") or f.get("name") or f.get("label"),
                 "presence": f.get("presence")}
                for f in (d.get("applied_factors") or [])
                if isinstance(f, dict)
            ],
        }

    bodyage_obj = report.get("bodyage") or {}
    return {
        "bodyage": bodyage_obj if isinstance(bodyage_obj, dict) else {"bodyage": bodyage_obj},
        "diseases": diseases_slim,
        "improved": {
            "overall_improvement": (report.get("improved") or {}).get("overall_improvement"),
        },
    }


# ─── Haiku 호출 ────────────────────────────────────────────────────────────────

async def generate_summary(report: dict) -> tuple[str, dict]:
    """GPT-4o-mini 호출. return: (summary_text, meta{input_tokens, output_tokens}).
    raise: RuntimeError on failure.
    """
    from app.core.config import settings
    from openai import AsyncOpenAI

    api_key = settings.openai_api_key
    if not api_key or api_key == "dev-openai-key":
        raise RuntimeError("OPENAI_API_KEY 미설정")

    client = AsyncOpenAI(api_key=api_key)
    system_prompt, user_prompt = _build_prompt_blocks(report)

    resp = await client.chat.completions.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        temperature=TEMPERATURE,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    text = (resp.choices[0].message.content or "").strip()
    if not text:
        raise RuntimeError("GPT-4o-mini 응답 비어있음")
    if len(text) > 300:
        text = text[:300]

    meta = {
        "input_tokens": getattr(resp.usage, "prompt_tokens", None),
        "output_tokens": getattr(resp.usage, "completion_tokens", None),
    }
    return text, meta


# ─── DB 조회 / 저장 ────────────────────────────────────────────────────────────

async def get_cached_summary(db_manager, uuid: str, hospital_id: str) -> Optional[dict]:
    """DB에서 기존 요약 조회. 없으면 None."""
    sql = (
        "SELECT id, patient_uuid, hospital_id, summary, model, prompt_version, "
        "input_digest, input_tokens, output_tokens, generated_at, updated_at "
        "FROM welno.welno_mediarc_ai_summaries "
        "WHERE patient_uuid = %s AND hospital_id = %s "
        "LIMIT 1"
    )
    row = await db_manager.execute_one(sql, (uuid, hospital_id))
    if not row:
        return None
    return {
        "uuid": row["patient_uuid"],
        "hospital_id": row["hospital_id"],
        "summary": row["summary"],
        "model": row["model"],
        "prompt_version": row.get("prompt_version"),
        "input_digest": row.get("input_digest"),
        "input_tokens": row.get("input_tokens"),
        "output_tokens": row.get("output_tokens"),
        "generated_at": row["generated_at"],
    }


async def upsert_summary(
    db_manager,
    patient_uuid: str,
    hospital_id: str,
    summary: str,
    model: str,
    input_digest: str,
    input_tokens: Optional[int],
    output_tokens: Optional[int],
) -> dict:
    """UPSERT. (patient_uuid, hospital_id) UNIQUE 충돌 시 업데이트."""
    sql = (
        "INSERT INTO welno.welno_mediarc_ai_summaries "
        "  (patient_uuid, hospital_id, summary, model, prompt_version, "
        "   input_digest, input_tokens, output_tokens, generated_at, updated_at) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()) "
        "ON CONFLICT (patient_uuid, hospital_id) DO UPDATE SET "
        "  summary = EXCLUDED.summary, "
        "  model = EXCLUDED.model, "
        "  prompt_version = EXCLUDED.prompt_version, "
        "  input_digest = EXCLUDED.input_digest, "
        "  input_tokens = EXCLUDED.input_tokens, "
        "  output_tokens = EXCLUDED.output_tokens, "
        "  generated_at = NOW(), "
        "  updated_at = NOW() "
        "RETURNING patient_uuid, hospital_id, summary, model, prompt_version, "
        "  input_digest, input_tokens, output_tokens, generated_at, updated_at"
    )
    row = await db_manager.execute_one(
        sql,
        (patient_uuid, hospital_id, summary, model, PROMPT_VERSION,
         input_digest, input_tokens, output_tokens),
    )
    if not row:
        # fallback: SELECT
        row = await db_manager.execute_one(
            "SELECT patient_uuid, hospital_id, summary, model, prompt_version, "
            "input_digest, input_tokens, output_tokens, generated_at, updated_at "
            "FROM welno.welno_mediarc_ai_summaries "
            "WHERE patient_uuid = %s AND hospital_id = %s LIMIT 1",
            (patient_uuid, hospital_id),
        )
    return {
        "uuid": row["patient_uuid"],
        "hospital_id": row["hospital_id"],
        "summary": row["summary"],
        "model": row["model"],
        "generated_at": row["generated_at"],
    } if row else {}
