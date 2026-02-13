"""
병원 만족도 설문조사 API

- POST /hospital-survey/submit          : 위젯에서 설문 제출 (X-API-Key 인증)
- GET  /hospital-survey/{hospital_id}/responses : 개별 응답 목록 (페이징+날짜필터)
- GET  /hospital-survey/{hospital_id}/stats     : 집계 통계 (평균, 일별 추이)
"""

import logging
from datetime import datetime, date
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field

from ....core.database import DatabaseManager
from ....middleware.partner_auth import verify_partner_api_key, PartnerAuthInfo
from fastapi import Depends

logger = logging.getLogger(__name__)
router = APIRouter()
db_manager = DatabaseManager()

SURVEY_FIELDS = [
    "reservation_process",
    "facility_cleanliness",
    "staff_kindness",
    "waiting_time",
    "overall_satisfaction",
]

SURVEY_FIELD_LABELS = {
    "reservation_process": "예약 과정",
    "facility_cleanliness": "시설 청결",
    "staff_kindness": "직원 친절",
    "waiting_time": "대기 시간",
    "overall_satisfaction": "전반적 만족도",
}


# ── Pydantic 모델 ──────────────────────────────────────

class SurveySubmitRequest(BaseModel):
    hospital_id: str = Field(..., min_length=1)
    reservation_process: int = Field(..., ge=1, le=5)
    facility_cleanliness: int = Field(..., ge=1, le=5)
    staff_kindness: int = Field(..., ge=1, le=5)
    waiting_time: int = Field(..., ge=1, le=5)
    overall_satisfaction: int = Field(..., ge=1, le=5)
    free_comment: str = Field(default="", max_length=2000)
    respondent_uuid: Optional[str] = None


# ── POST /hospital-survey/submit ───────────────────────

@router.post("/hospital-survey/submit")
async def submit_survey(
    body: SurveySubmitRequest,
    request: Request,
    partner_info: PartnerAuthInfo = Depends(verify_partner_api_key),
):
    """위젯에서 설문 제출 (X-API-Key 인증)"""
    try:
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
):
    """개별 응답 목록 (페이징 + 날짜 필터)"""
    try:
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
):
    """집계 통계 (평균, 일별 추이)"""
    try:
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

        # 전체 평균
        avg_row = await db_manager.execute_one(
            f"""
            SELECT
                COUNT(*) as total_count,
                COALESCE(AVG(reservation_process), 0) as avg_reservation_process,
                COALESCE(AVG(facility_cleanliness), 0) as avg_facility_cleanliness,
                COALESCE(AVG(staff_kindness), 0) as avg_staff_kindness,
                COALESCE(AVG(waiting_time), 0) as avg_waiting_time,
                COALESCE(AVG(overall_satisfaction), 0) as avg_overall_satisfaction
            FROM welno.tb_hospital_survey_responses
            WHERE {where}
            """,
            tuple(params),
        )

        averages = {}
        total_count = 0
        if avg_row:
            total_count = avg_row["total_count"]
            for f in SURVEY_FIELDS:
                averages[f] = round(float(avg_row.get(f"avg_{f}", 0)), 2)

        # 일별 추이
        daily_rows = await db_manager.execute_query(
            f"""
            SELECT
                created_at::date as survey_date,
                COUNT(*) as count,
                ROUND(AVG(reservation_process)::numeric, 2) as avg_reservation_process,
                ROUND(AVG(facility_cleanliness)::numeric, 2) as avg_facility_cleanliness,
                ROUND(AVG(staff_kindness)::numeric, 2) as avg_staff_kindness,
                ROUND(AVG(waiting_time)::numeric, 2) as avg_waiting_time,
                ROUND(AVG(overall_satisfaction)::numeric, 2) as avg_overall_satisfaction
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
            for f in SURVEY_FIELDS:
                item[f] = float(r.get(f"avg_{f}", 0))
            daily_trend.append(item)

        return {
            "total_count": total_count,
            "averages": averages,
            "field_labels": SURVEY_FIELD_LABELS,
            "daily_trend": daily_trend,
        }

    except Exception as e:
        logger.error(f"[설문] 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="설문 통계 조회에 실패했습니다.")
