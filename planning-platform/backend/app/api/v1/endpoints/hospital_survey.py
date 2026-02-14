"""
병원 만족도 설문조사 API

- POST /hospital-survey/submit          : 위젯에서 설문 제출 (X-API-Key 인증)
- GET  /hospital-survey/{hospital_id}/responses : 개별 응답 목록 (페이징+날짜필터)
- GET  /hospital-survey/{hospital_id}/stats     : 집계 통계 (평균, 일별 추이)
"""

import json
import logging
from datetime import datetime, date
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field

from ....core.database import DatabaseManager
from ....middleware.partner_auth import verify_partner_api_key, PartnerAuthInfo
from ....services.dynamic_config_service import DynamicConfigService
from fastapi import Depends

logger = logging.getLogger(__name__)
router = APIRouter()
db_manager = DatabaseManager()

SURVEY_FIELDS = [
    "overall_satisfaction",
    "reservation_process",
    "facility_cleanliness",
    "staff_kindness",
    "waiting_time",
    "result_explanation",
    "revisit_intention",
    "recommendation",
]

SURVEY_FIELD_LABELS = {
    "overall_satisfaction": "전반적 만족도",
    "reservation_process": "예약 과정",
    "facility_cleanliness": "시설 청결",
    "staff_kindness": "직원 친절",
    "waiting_time": "대기 시간",
    "result_explanation": "검진 결과 설명",
    "revisit_intention": "재방문 의향",
    "recommendation": "추천 의향",
}

# Legacy 5개 필드 (기존 submit 엔드포인트용)
LEGACY_SURVEY_FIELDS = [
    "reservation_process", "facility_cleanliness",
    "staff_kindness", "waiting_time", "overall_satisfaction",
]


# ── Pydantic 모델 ──────────────────────────────────────

class SurveySubmitRequest(BaseModel):
    hospital_id: str = Field(..., min_length=1)
    hospital_name: Optional[str] = None
    reservation_process: int = Field(..., ge=1, le=5)
    facility_cleanliness: int = Field(..., ge=1, le=5)
    staff_kindness: int = Field(..., ge=1, le=5)
    waiting_time: int = Field(..., ge=1, le=5)
    overall_satisfaction: int = Field(..., ge=1, le=5)
    free_comment: str = Field(default="", max_length=2000)
    respondent_uuid: Optional[str] = None


class QuestionCreate(BaseModel):
    question_key: str = Field(..., min_length=1, max_length=100)
    question_label: str = Field(..., min_length=1, max_length=500)
    question_type: str = Field(default="rating", pattern=r"^(rating|text|single_choice|multiple_choice)$")
    is_required: bool = True
    options: Optional[List[str]] = None
    display_order: int = 0
    config: dict = Field(default_factory=dict)


class TemplateCreate(BaseModel):
    partner_id: str = Field(..., min_length=1)
    hospital_id: str = Field(..., min_length=1)
    template_name: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    questions: List[QuestionCreate] = []


class TemplateUpdate(BaseModel):
    template_name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    questions: Optional[List[QuestionCreate]] = None


class DynamicSurveySubmitRequest(BaseModel):
    hospital_id: str = Field(..., min_length=1)
    hospital_name: Optional[str] = None
    template_id: Optional[int] = None
    answers: dict
    free_comment: str = Field(default="", max_length=2000)
    respondent_uuid: Optional[str] = None


# ── 병원 자동 등록 (DynamicConfigService 재사용) ──

async def _ensure_hospital_registered(partner_id: str, hospital_id: str, hospital_name: str = None):
    """병원 자동 등록 또는 이름 업데이트 (DynamicConfigService 재사용)"""
    try:
        existing = await db_manager.execute_one(
            "SELECT id FROM welno.tb_hospital_rag_config WHERE partner_id = %s AND hospital_id = %s",
            (partner_id, hospital_id)
        )
        if not existing:
            await DynamicConfigService.auto_register_hospital(partner_id, hospital_id, hospital_name)
            logger.info(f"[설문] 병원 자동 등록 완료 - partner={partner_id}, hospital={hospital_id}")
        elif hospital_name:
            await DynamicConfigService.update_hospital_name(partner_id, hospital_id, hospital_name)
    except Exception as e:
        logger.warning(f"[설문] 병원 자동 등록 실패: {e}")


# ── POST /hospital-survey/submit ───────────────────────

@router.post("/hospital-survey/submit")
async def submit_survey(
    body: SurveySubmitRequest,
    request: Request,
    partner_info: PartnerAuthInfo = Depends(verify_partner_api_key),
):
    """위젯에서 설문 제출 (X-API-Key 인증)"""
    try:
        await _ensure_hospital_registered(partner_info.partner_id, body.hospital_id, body.hospital_name)

        user_agent = (request.headers.get("user-agent") or "")[:500]
        ip_address = request.headers.get("x-forwarded-for", request.client.host if request.client else "")
        if "," in ip_address:
            ip_address = ip_address.split(",")[0].strip()

        await db_manager.execute_update(
            """
            INSERT INTO welno.tb_hospital_survey_responses
                (partner_id, hospital_id,
                 reservation_process, facility_cleanliness, staff_kindness,
                 waiting_time, overall_satisfaction,
                 free_comment, respondent_uuid, user_agent, ip_address)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                partner_info.partner_id,
                body.hospital_id,
                body.reservation_process,
                body.facility_cleanliness,
                body.staff_kindness,
                body.waiting_time,
                body.overall_satisfaction,
                body.free_comment,
                body.respondent_uuid,
                user_agent,
                ip_address,
            ),
        )

        logger.info(
            f"[설문] 제출 완료 - partner={partner_info.partner_id}, hospital={body.hospital_id}"
        )
        return {"status": "ok", "message": "설문이 제출되었습니다. 감사합니다."}

    except Exception as e:
        logger.error(f"[설문] 제출 실패: {e}")
        raise HTTPException(status_code=500, detail="설문 제출에 실패했습니다.")


# ── GET /hospital-survey/{hospital_id}/responses ───────

@router.get("/hospital-survey/{hospital_id}/responses")
async def get_survey_responses(
    hospital_id: str,
    partner_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    template_id: Optional[int] = Query(None, description="동적 템플릿 ID (지정 시 동적 응답 조회)"),
):
    """개별 응답 목록 (페이징 + 날짜 필터)"""
    try:
        # 동적 템플릿 응답 조회
        if template_id is not None:
            conditions = ["hospital_id = %s", "template_id = %s"]
            params: list = [hospital_id, template_id]

            if partner_id:
                conditions.append("partner_id = %s")
                params.append(partner_id)
            if date_from:
                conditions.append("created_at >= %s")
                params.append(date_from)
            if date_to:
                conditions.append("created_at < (%s::date + interval '1 day')")
                params.append(date_to)

            where = " AND ".join(conditions)
            offset = (page - 1) * page_size

            count_row = await db_manager.execute_one(
                f"SELECT COUNT(*) as cnt FROM welno.tb_survey_responses_dynamic WHERE {where}",
                tuple(params),
            )
            total = count_row["cnt"] if count_row else 0

            rows = await db_manager.execute_query(
                f"""
                SELECT id, template_id, partner_id, hospital_id,
                       answers, free_comment, respondent_uuid, created_at
                FROM welno.tb_survey_responses_dynamic
                WHERE {where}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                tuple(params + [page_size, offset]),
            )

            for r in rows:
                if r.get("created_at"):
                    r["created_at"] = r["created_at"].isoformat()

            return {
                "total": total,
                "page": page,
                "page_size": page_size,
                "template_id": template_id,
                "responses": rows,
            }

        # 기존 고정 필드 응답 조회
        conditions = ["hospital_id = %s"]
        params: list = [hospital_id]

        if partner_id:
            conditions.append("partner_id = %s")
            params.append(partner_id)
        if date_from:
            conditions.append("created_at >= %s")
            params.append(date_from)
        if date_to:
            conditions.append("created_at < (%s::date + interval '1 day')")
            params.append(date_to)

        where = " AND ".join(conditions)
        offset = (page - 1) * page_size

        # 총 개수
        count_row = await db_manager.execute_one(
            f"SELECT COUNT(*) as cnt FROM welno.tb_hospital_survey_responses WHERE {where}",
            tuple(params),
        )
        total = count_row["cnt"] if count_row else 0

        # 데이터
        rows = await db_manager.execute_query(
            f"""
            SELECT id, partner_id, hospital_id,
                   reservation_process, facility_cleanliness, staff_kindness,
                   waiting_time, overall_satisfaction,
                   free_comment, respondent_uuid, created_at
            FROM welno.tb_hospital_survey_responses
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            """,
            tuple(params + [page_size, offset]),
        )

        # datetime → str 변환
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "responses": rows,
        }

    except Exception as e:
        logger.error(f"[설문] 응답 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="설문 응답 조회에 실패했습니다.")


# ── GET /hospital-survey/{hospital_id}/stats ───────────

@router.get("/hospital-survey/{hospital_id}/stats")
async def get_survey_stats(
    hospital_id: str,
    partner_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    template_id: Optional[int] = Query(None, description="동적 템플릿 ID (지정 시 동적 응답 통계)"),
):
    """집계 통계 (평균, 일별 추이)"""
    try:
        # 동적 템플릿 통계
        if template_id is not None:
            return await _get_dynamic_survey_stats(hospital_id, template_id, partner_id, date_from, date_to)

        # 기존 고정 필드 통계
        conditions = ["hospital_id = %s"]
        params: list = [hospital_id]

        if partner_id:
            conditions.append("partner_id = %s")
            params.append(partner_id)
        if date_from:
            conditions.append("created_at >= %s")
            params.append(date_from)
        if date_to:
            conditions.append("created_at < (%s::date + interval '1 day')")
            params.append(date_to)

        where = " AND ".join(conditions)

        # 전체 평균 (레거시 테이블은 고정 5개 컬럼만 존재)
        avg_selects = ", ".join(f"COALESCE(AVG({f}), 0) as avg_{f}" for f in LEGACY_SURVEY_FIELDS)
        avg_row = await db_manager.execute_one(
            f"""
            SELECT COUNT(*) as total_count, {avg_selects}
            FROM welno.tb_hospital_survey_responses
            WHERE {where}
            """,
            tuple(params),
        )

        averages = {}
        total_count = 0
        if avg_row:
            total_count = avg_row["total_count"]
            for f in LEGACY_SURVEY_FIELDS:
                averages[f] = round(float(avg_row.get(f"avg_{f}", 0)), 2)

        # 일별 추이 (레거시 5개 필드)
        daily_avg_selects = ", ".join(
            f"ROUND(AVG({f})::numeric, 2) as avg_{f}" for f in LEGACY_SURVEY_FIELDS
        )
        daily_rows = await db_manager.execute_query(
            f"""
            SELECT
                created_at::date as survey_date,
                COUNT(*) as count,
                {daily_avg_selects}
            FROM welno.tb_hospital_survey_responses
            WHERE {where}
            GROUP BY created_at::date
            ORDER BY survey_date ASC
            """,
            tuple(params),
        )

        daily_trend = []
        for r in daily_rows:
            item: Dict[str, Any] = {
                "date": r["survey_date"].isoformat() if hasattr(r["survey_date"], "isoformat") else str(r["survey_date"]),
                "count": r["count"],
            }
            for f in LEGACY_SURVEY_FIELDS:
                item[f] = float(r.get(f"avg_{f}", 0))
            daily_trend.append(item)

        # 레거시 5개 필드만 라벨 반환
        legacy_labels = {f: SURVEY_FIELD_LABELS[f] for f in LEGACY_SURVEY_FIELDS}
        return {
            "total_count": total_count,
            "averages": averages,
            "field_labels": legacy_labels,
            "daily_trend": daily_trend,
        }

    except Exception as e:
        logger.error(f"[설문] 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="설문 통계 조회에 실패했습니다.")


async def _get_dynamic_survey_stats(
    hospital_id: str,
    template_id: int,
    partner_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
) -> dict:
    """동적 설문 템플릿 기반 통계"""
    # 템플릿 질문 목록 조회
    questions = await db_manager.execute_query(
        """SELECT question_key, question_label, question_type
           FROM welno.tb_survey_template_questions
           WHERE template_id = %s ORDER BY display_order""",
        (template_id,)
    )

    field_labels = {q["question_key"]: q["question_label"] for q in questions}
    rating_keys = [q["question_key"] for q in questions if q["question_type"] == "rating"]

    conditions = ["hospital_id = %s", "template_id = %s"]
    params: list = [hospital_id, template_id]

    if partner_id:
        conditions.append("partner_id = %s")
        params.append(partner_id)
    if date_from:
        conditions.append("created_at >= %s")
        params.append(date_from)
    if date_to:
        conditions.append("created_at < (%s::date + interval '1 day')")
        params.append(date_to)

    where = " AND ".join(conditions)

    # 전체 응답 수
    count_row = await db_manager.execute_one(
        f"SELECT COUNT(*) as total_count FROM welno.tb_survey_responses_dynamic WHERE {where}",
        tuple(params),
    )
    total_count = count_row["total_count"] if count_row else 0

    # rating 타입 질문의 평균 계산
    averages = {}
    if rating_keys and total_count > 0:
        avg_selects = ", ".join(
            f"COALESCE(AVG((answers->>'{k}')::numeric), 0) as avg_{k}" for k in rating_keys
        )
        avg_row = await db_manager.execute_one(
            f"SELECT {avg_selects} FROM welno.tb_survey_responses_dynamic WHERE {where}",
            tuple(params),
        )
        if avg_row:
            for k in rating_keys:
                averages[k] = round(float(avg_row.get(f"avg_{k}", 0)), 2)

    # 일별 추이
    daily_trend = []
    if rating_keys and total_count > 0:
        daily_avg_selects = ", ".join(
            f"ROUND(AVG((answers->>'{k}')::numeric)::numeric, 2) as avg_{k}" for k in rating_keys
        )
        daily_rows = await db_manager.execute_query(
            f"""
            SELECT
                created_at::date as survey_date,
                COUNT(*) as count,
                {daily_avg_selects}
            FROM welno.tb_survey_responses_dynamic
            WHERE {where}
            GROUP BY created_at::date
            ORDER BY survey_date ASC
            """,
            tuple(params),
        )

        for r in daily_rows:
            item: Dict[str, Any] = {
                "date": r["survey_date"].isoformat() if hasattr(r["survey_date"], "isoformat") else str(r["survey_date"]),
                "count": r["count"],
            }
            for k in rating_keys:
                item[k] = float(r.get(f"avg_{k}", 0))
            daily_trend.append(item)

    return {
        "total_count": total_count,
        "averages": averages,
        "field_labels": field_labels,
        "daily_trend": daily_trend,
        "template_id": template_id,
    }


# ── 동적 설문 템플릿 API ──────────────────────────────────

@router.get("/hospital-survey/templates")
async def list_templates(partner_id: str, hospital_id: str):
    """템플릿 목록 조회"""
    query = """
        SELECT t.*,
            (SELECT COUNT(*) FROM welno.tb_survey_template_questions WHERE template_id = t.id) as question_count
        FROM welno.tb_survey_templates t
        WHERE t.partner_id = %s AND t.hospital_id = %s
        ORDER BY t.created_at DESC
    """
    rows = await db_manager.execute_query(query, (partner_id, hospital_id))
    for r in rows:
        if r.get("created_at"):
            r["created_at"] = r["created_at"].isoformat()
        if r.get("updated_at"):
            r["updated_at"] = r["updated_at"].isoformat()
    return {"templates": rows}


@router.get("/hospital-survey/templates/{template_id}")
async def get_template(template_id: int):
    """템플릿 상세 조회 (질문 포함)"""
    template = await db_manager.execute_one(
        "SELECT * FROM welno.tb_survey_templates WHERE id = %s", (template_id,)
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    questions = await db_manager.execute_query(
        "SELECT * FROM welno.tb_survey_template_questions WHERE template_id = %s ORDER BY display_order",
        (template_id,)
    )
    result = {**template, "questions": questions}
    if result.get("created_at"):
        result["created_at"] = result["created_at"].isoformat()
    if result.get("updated_at"):
        result["updated_at"] = result["updated_at"].isoformat()
    for q in result["questions"]:
        if q.get("created_at"):
            q["created_at"] = q["created_at"].isoformat()
    return result


@router.post("/hospital-survey/templates")
async def create_template(body: TemplateCreate):
    """템플릿 생성"""
    # Insert template
    template = await db_manager.execute_one(
        """INSERT INTO welno.tb_survey_templates (partner_id, hospital_id, template_name, description)
           VALUES (%s, %s, %s, %s) RETURNING *""",
        (body.partner_id, body.hospital_id, body.template_name, body.description)
    )
    # Insert questions
    for q in body.questions:
        await db_manager.execute_update(
            """INSERT INTO welno.tb_survey_template_questions
               (template_id, question_key, question_label, question_type, is_required, options, display_order, config)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (template["id"], q.question_key, q.question_label, q.question_type,
             q.is_required, json.dumps(q.options) if q.options else None, q.display_order, json.dumps(q.config))
        )
    return await get_template(template["id"])


@router.put("/hospital-survey/templates/{template_id}")
async def update_template(template_id: int, body: TemplateUpdate):
    """템플릿 수정"""
    existing = await db_manager.execute_one(
        "SELECT * FROM welno.tb_survey_templates WHERE id = %s", (template_id,)
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")

    updates = []
    params = []
    if body.template_name is not None:
        updates.append("template_name = %s")
        params.append(body.template_name)
    if body.description is not None:
        updates.append("description = %s")
        params.append(body.description)

    if updates:
        updates.append("updated_at = NOW()")
        params.append(template_id)
        await db_manager.execute_update(
            f"UPDATE welno.tb_survey_templates SET {', '.join(updates)} WHERE id = %s",
            tuple(params)
        )

    if body.questions is not None:
        # Delete old questions and insert new ones
        await db_manager.execute_update(
            "DELETE FROM welno.tb_survey_template_questions WHERE template_id = %s", (template_id,)
        )
        for q in body.questions:
            await db_manager.execute_update(
                """INSERT INTO welno.tb_survey_template_questions
                   (template_id, question_key, question_label, question_type, is_required, options, display_order, config)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (template_id, q.question_key, q.question_label, q.question_type,
                 q.is_required, json.dumps(q.options) if q.options else None, q.display_order, json.dumps(q.config))
            )

    return await get_template(template_id)


@router.put("/hospital-survey/templates/{template_id}/activate")
async def toggle_template_activation(template_id: int):
    """템플릿 활성화/비활성화 토글"""
    template = await db_manager.execute_one(
        "SELECT * FROM welno.tb_survey_templates WHERE id = %s", (template_id,)
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    new_active = not template["is_active"]

    if new_active:
        # Deactivate any other active template for same partner/hospital
        await db_manager.execute_update(
            """UPDATE welno.tb_survey_templates SET is_active = false, updated_at = NOW()
               WHERE partner_id = %s AND hospital_id = %s AND is_active = true""",
            (template["partner_id"], template["hospital_id"])
        )

    await db_manager.execute_update(
        "UPDATE welno.tb_survey_templates SET is_active = %s, updated_at = NOW() WHERE id = %s",
        (new_active, template_id)
    )

    return {"id": template_id, "is_active": new_active}


@router.delete("/hospital-survey/templates/{template_id}")
async def delete_template(template_id: int):
    """템플릿 삭제 (응답이 있으면 409)"""
    template = await db_manager.execute_one(
        "SELECT * FROM welno.tb_survey_templates WHERE id = %s", (template_id,)
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    response_count = await db_manager.execute_one(
        "SELECT COUNT(*) as cnt FROM welno.tb_survey_responses_dynamic WHERE template_id = %s", (template_id,)
    )
    if response_count and response_count["cnt"] > 0:
        raise HTTPException(status_code=409, detail="Cannot delete template with existing responses")

    await db_manager.execute_update(
        "DELETE FROM welno.tb_survey_templates WHERE id = %s", (template_id,)
    )
    return {"deleted": True}


# ── 위젯용 설문 설정 및 동적 제출 API ─────────────────────

@router.get("/hospital-survey/config")
async def get_survey_config(
    hospital_id: str,
    hospital_name: Optional[str] = Query(None),
    partner_info: PartnerAuthInfo = Depends(verify_partner_api_key)
):
    """위젯용 설문 설정 조회 (X-API-Key 인증) — 위젯 로드 시점에 병원 자동등록"""
    await _ensure_hospital_registered(partner_info.partner_id, hospital_id, hospital_name)

    # Look for active custom template
    template = await db_manager.execute_one(
        """SELECT * FROM welno.tb_survey_templates
           WHERE partner_id = %s AND hospital_id = %s AND is_active = true""",
        (partner_info.partner_id, hospital_id)
    )

    if template:
        questions = await db_manager.execute_query(
            """SELECT question_key as key, question_label as label, question_type as type,
                      is_required as required, options, config
               FROM welno.tb_survey_template_questions
               WHERE template_id = %s ORDER BY display_order""",
            (template["id"],)
        )
        return {
            "has_custom_template": True,
            "template_id": template["id"],
            "template_name": template["template_name"],
            "questions": questions
        }
    else:
        # Return default fields (8 rating + 3 text)
        rating_labels = ["매우불만족", "불만족", "보통", "만족", "매우만족"]
        nps_labels = ["전혀 아니다", "아니다", "보통", "그렇다", "매우 그렇다"]
        default_questions = [
            {"key": "overall_satisfaction", "label": "전반적 만족도", "type": "rating", "required": True, "options": None, "config": {"min": 1, "max": 5, "labels": rating_labels, "section": "overall"}},
            {"key": "reservation_process", "label": "예약 과정", "type": "rating", "required": True, "options": None, "config": {"min": 1, "max": 5, "labels": rating_labels}},
            {"key": "facility_cleanliness", "label": "시설 청결", "type": "rating", "required": True, "options": None, "config": {"min": 1, "max": 5, "labels": rating_labels}},
            {"key": "staff_kindness", "label": "직원 친절", "type": "rating", "required": True, "options": None, "config": {"min": 1, "max": 5, "labels": rating_labels}},
            {"key": "waiting_time", "label": "대기 시간", "type": "rating", "required": True, "options": None, "config": {"min": 1, "max": 5, "labels": rating_labels}},
            {"key": "result_explanation", "label": "검진 결과 설명", "type": "rating", "required": True, "options": None, "config": {"min": 1, "max": 5, "labels": rating_labels}},
            {"key": "revisit_intention", "label": "재방문 의향", "type": "rating", "required": True, "options": None, "config": {"min": 1, "max": 5, "labels": nps_labels}},
            {"key": "recommendation", "label": "추천 의향", "type": "rating", "required": True, "options": None, "config": {"min": 1, "max": 5, "labels": nps_labels}},
            {"key": "best_experience", "label": "가장 좋았던 점", "type": "text", "required": False, "options": None, "config": {}},
            {"key": "improvement_suggestion", "label": "개선이 필요한 점", "type": "text", "required": False, "options": None, "config": {}},
            {"key": "free_text", "label": "기타 하실 말씀", "type": "text", "required": False, "options": None, "config": {}},
        ]
        return {
            "has_custom_template": False,
            "template_id": None,
            "template_name": "기본 만족도 설문",
            "questions": default_questions
        }


@router.post("/hospital-survey/submit-dynamic")
async def submit_dynamic_survey(
    request: Request,
    body: DynamicSurveySubmitRequest,
    partner_info: PartnerAuthInfo = Depends(verify_partner_api_key)
):
    """동적 설문 제출 (X-API-Key 인증) — template_id가 null이면 기본 설문으로 저장"""
    # 병원 자동 등록
    await _ensure_hospital_registered(partner_info.partner_id, body.hospital_id, body.hospital_name)

    # Verify template exists (only if template_id is provided)
    if body.template_id is not None:
        template = await db_manager.execute_one(
            "SELECT * FROM welno.tb_survey_templates WHERE id = %s", (body.template_id,)
        )
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

    user_agent = request.headers.get("user-agent", "")[:500]
    forwarded = request.headers.get("x-forwarded-for", "")
    ip_address = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "")

    result = await db_manager.execute_one(
        """INSERT INTO welno.tb_survey_responses_dynamic
           (template_id, partner_id, hospital_id, answers, free_comment, respondent_uuid, user_agent, ip_address)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id, created_at""",
        (body.template_id, partner_info.partner_id, body.hospital_id,
         json.dumps(body.answers), body.free_comment, body.respondent_uuid, user_agent, ip_address)
    )

    return {"success": True, "response_id": result["id"], "created_at": str(result["created_at"])}
