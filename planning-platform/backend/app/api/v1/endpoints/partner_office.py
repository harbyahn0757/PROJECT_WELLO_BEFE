"""
파트너오피스 API — 로그인, 대시보드, 환자 통합, 사용자 여정 분석
로그인은 p9_mkt_biz.user_accounts 테이블 (Jerry 공용 계정 체계)
"""

import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt

from ....core.config import settings
from ....core.database import db_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/partner-office", tags=["partner-office"])
security = HTTPBearer()

# ─── Models ───────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    username: str
    display_name: str
    permission_level: str

class DashboardStatsRequest(BaseModel):
    partner_id: Optional[str] = None
    hospital_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None

class OverviewRequest(BaseModel):
    date_from: Optional[str] = None
    date_to: Optional[str] = None

class PatientListRequest(BaseModel):
    hospital_id: Optional[str] = None

# ─── Auth helpers ─────────────────────────────────────────

def _hash_password(password: str) -> str:
    """Jerry AuthService와 동일한 sha256 해싱"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_office_token(user_data: dict) -> str:
    """파트너오피스 전용 JWT 생성 (8시간 만료)"""
    expire = datetime.utcnow() + timedelta(hours=8)
    data = {
        "sub": user_data["username"],
        "user_id": user_data["user_id"],
        "display_name": user_data["user_name"],
        "partner_id": user_data.get("partner_id"),
        "permission_level": user_data["permission_level"],
        "access_scope": user_data.get("access_scope"),
        "scope": "partner_office",
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access",
    }
    return jwt.encode(data, settings.secret_key, algorithm=settings.jwt_algorithm)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Dict[str, Any]:
    """JWT에서 사용자 정보 추출 + scope 검증"""
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        if payload.get("scope") != "partner_office":
            raise HTTPException(status_code=403, detail="Invalid token scope")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# ─── Endpoints ────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    """파트너오피스 로그인 — user_accounts 테이블 (sha256)"""
    password_hash = _hash_password(req.password)

    row = await db_manager.execute_one(
        """SELECT user_id, username, user_name, partner_id, permission_level, access_scope
           FROM p9_mkt_biz.user_accounts
           WHERE username = %s AND password_hash = %s AND is_active = true""",
        (req.username, password_hash),
    )
    if not row:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # super_admin, partner_admin만 로그인 허용
    allowed_levels = ("super_admin", "partner_admin")
    if row["permission_level"] not in allowed_levels:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다. 관리자에게 문의하세요.")

    token = create_office_token(row)
    return LoginResponse(
        access_token=token,
        expires_in=8 * 3600,
        username=row["username"],
        display_name=row["user_name"],
        permission_level=row["permission_level"],
    )


@router.get("/hospitals")
async def get_hospitals(user: dict = Depends(get_current_user)):
    """전체 파트너별 병원 목록"""
    rows = await db_manager.execute_query(
        """
        SELECT h.partner_id, p.partner_name, h.hospital_id, h.hospital_name, h.is_active
        FROM welno.tb_hospital_rag_config h
        LEFT JOIN welno.tb_partner_config p ON p.partner_id = h.partner_id
        WHERE h.is_active = true
        ORDER BY h.partner_id, h.hospital_name
        """,
    )
    return {"hospitals": rows}


@router.post("/dashboard/overview")
async def dashboard_overview(
    req: OverviewRequest,
    user: dict = Depends(get_current_user),
):
    """통합 퍼널 대시보드 — ES 유입 → 상담 → 서베이 전환율"""
    import requests as _requests

    date_to = req.date_to or datetime.utcnow().strftime("%Y-%m-%d")
    date_from = req.date_from or (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")

    # ── 1) ES: 일별 unique users + total events ──
    es_url = settings.elasticsearch_url.rstrip("/")
    es_body = {
        "size": 0,
        "query": {
            "bool": {
                "must": [
                    {"term": {"header.project.name": "med2-frontend-hana"}},
                    {"range": {"header.@timestamp": {
                        "gte": date_from,
                        "lte": date_to,
                        "time_zone": "Asia/Seoul",
                    }}},
                ]
            }
        },
        "aggs": {
            "unique_users_total": {
                "cardinality": {"field": "data.user.webAppKey.keyword"}
            },
            "daily": {
                "date_histogram": {
                    "field": "header.@timestamp",
                    "calendar_interval": "1d",
                    "time_zone": "Asia/Seoul",
                },
                "aggs": {
                    "unique_users": {
                        "cardinality": {"field": "data.user.webAppKey.keyword"}
                    }
                },
            },
        },
    }

    daily_es: Dict[str, dict] = {}
    total_users = 0
    total_events = 0

    try:
        es_resp = _requests.post(
            f"{es_url}/medilinx-logs-data/_search",
            json=es_body,
            timeout=10,
        )
        es_data = es_resp.json()
        total_events = es_data.get("hits", {}).get("total", {}).get("value", 0)
        total_users = es_data.get("aggregations", {}).get("unique_users_total", {}).get("value", 0)

        for bucket in es_data.get("aggregations", {}).get("daily", {}).get("buckets", []):
            day_key = bucket["key_as_string"][:10]
            daily_es[day_key] = {
                "users": bucket.get("unique_users", {}).get("value", 0),
                "events": bucket.get("doc_count", 0),
            }
    except Exception as e:
        logger.warning(f"ES overview query failed: {e}")

    # ── 2) DB: 일별 상담 건수 ──
    chat_rows = await db_manager.execute_query(
        """SELECT created_at::date AS date, COUNT(*) AS cnt
           FROM welno.tb_partner_rag_chat_log
           WHERE created_at >= %s::date
             AND created_at < (%s::date + interval '1 day')
           GROUP BY created_at::date ORDER BY date""",
        (date_from, date_to),
    )
    daily_chats: Dict[str, int] = {}
    total_chats = 0
    for row in chat_rows:
        d = str(row["date"])
        daily_chats[d] = row["cnt"]
        total_chats += row["cnt"]

    # ── 3) DB: 일별 서베이 건수 (두 테이블 UNION) ──
    survey_rows = await db_manager.execute_query(
        """SELECT d::date AS date, SUM(cnt) AS cnt FROM (
               SELECT created_at::date AS d, COUNT(*) AS cnt
               FROM welno.tb_hospital_survey_responses
               WHERE created_at >= %s::date AND created_at < (%s::date + interval '1 day')
               GROUP BY created_at::date
             UNION ALL
               SELECT created_at::date AS d, COUNT(*) AS cnt
               FROM welno.tb_survey_responses_dynamic
               WHERE created_at >= %s::date AND created_at < (%s::date + interval '1 day')
               GROUP BY created_at::date
           ) sub GROUP BY d ORDER BY d""",
        (date_from, date_to, date_from, date_to),
    )
    daily_surveys: Dict[str, int] = {}
    total_surveys = 0
    for row in survey_rows:
        d = str(row["date"])
        daily_surveys[d] = row["cnt"]
        total_surveys += row["cnt"]

    # ── 4) Merge daily data ──
    all_dates = sorted(set(list(daily_es.keys()) + list(daily_chats.keys()) + list(daily_surveys.keys())))
    daily = []
    for d in all_dates:
        es_day = daily_es.get(d, {})
        daily.append({
            "date": d,
            "users": es_day.get("users", 0),
            "events": es_day.get("events", 0),
            "chats": daily_chats.get(d, 0),
            "surveys": daily_surveys.get(d, 0),
        })

    chat_rate = round(total_chats / total_users * 100, 1) if total_users else 0
    survey_rate = round(total_surveys / total_users * 100, 1) if total_users else 0

    return {
        "total_users": total_users,
        "total_events": total_events,
        "total_chats": total_chats,
        "total_surveys": total_surveys,
        "chat_rate": chat_rate,
        "survey_rate": survey_rate,
        "daily": daily,
    }


@router.post("/dashboard/stats")
async def dashboard_stats(
    req: DashboardStatsRequest,
    user: dict = Depends(get_current_user),
):
    """대시보드 통계 — 7개 쿼리 (전체 또는 파트너/병원 필터)"""
    partner_id = req.partner_id
    hospital_id = req.hospital_id
    date_to = req.date_to or datetime.utcnow().strftime("%Y-%m-%d")
    date_from = req.date_from or (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")

    def where(table_alias: str = "t") -> tuple:
        clauses: list = []
        params: list = []
        if partner_id:
            clauses.append(f"{table_alias}.partner_id = %s")
            params.append(partner_id)
        if hospital_id:
            clauses.append(f"{table_alias}.hospital_id = %s")
            params.append(hospital_id)
        clauses.append(f"{table_alias}.created_at >= %s::date")
        params.append(date_from)
        clauses.append(f"{table_alias}.created_at < (%s::date + interval '1 day')")
        params.append(date_to)
        return " AND ".join(clauses), tuple(params)

    w, p = where()
    today_str = datetime.utcnow().strftime("%Y-%m-%d")

    summary = await db_manager.execute_one(f"""
        SELECT
            COUNT(*) AS total_chats,
            COUNT(*) FILTER (WHERE t.created_at >= '{today_str}'::date) AS today_chats,
            COUNT(*) FILTER (WHERE t.risk_level = 'high') AS high_risk_count,
            COALESCE(ROUND(AVG(t.engagement_score)::numeric, 1), 0) AS avg_engagement
        FROM welno.tb_chat_session_tags t WHERE {w}
    """, p)

    risk_dist = await db_manager.execute_query(f"""
        SELECT t.risk_level AS name, COUNT(*) AS value
        FROM welno.tb_chat_session_tags t
        WHERE {w} AND t.risk_level IS NOT NULL GROUP BY t.risk_level
    """, p)

    interest_tags = await db_manager.execute_query(f"""
        SELECT tag_obj->>'topic' AS name, COUNT(*) AS value
        FROM welno.tb_chat_session_tags t,
             jsonb_array_elements(t.interest_tags::jsonb) AS tag_obj
        WHERE {w} GROUP BY tag_obj->>'topic' ORDER BY value DESC LIMIT 10
    """, p)

    daily_trend = await db_manager.execute_query(f"""
        SELECT t.created_at::date AS date, COUNT(*) AS count
        FROM welno.tb_chat_session_tags t WHERE {w}
        GROUP BY t.created_at::date ORDER BY date
    """, p)
    for row in daily_trend:
        row["date"] = str(row["date"])

    intent_dist = await db_manager.execute_query(f"""
        SELECT t.action_intent AS name, COUNT(*) AS value
        FROM welno.tb_chat_session_tags t
        WHERE {w} AND t.action_intent IS NOT NULL GROUP BY t.action_intent
    """, p)

    sentiment_dist = await db_manager.execute_query(f"""
        SELECT t.sentiment AS name, COUNT(*) AS value
        FROM welno.tb_chat_session_tags t
        WHERE {w} AND t.sentiment IS NOT NULL GROUP BY t.sentiment
    """, p)

    nutrition_dist = await db_manager.execute_query(f"""
        SELECT tag AS name, COUNT(*) AS value
        FROM welno.tb_chat_session_tags t,
             jsonb_array_elements_text(t.nutrition_tags::jsonb) AS tag
        WHERE {w} GROUP BY tag ORDER BY value DESC LIMIT 10
    """, p)

    return {
        "summary": summary,
        "risk_distribution": risk_dist,
        "interest_tags": interest_tags,
        "daily_trend": daily_trend,
        "intent_distribution": intent_dist,
        "sentiment_distribution": sentiment_dist,
        "nutrition_distribution": nutrition_dist,
    }


@router.get("/journey/stats")
async def journey_stats(
    hospital_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """사용자 여정 분석 — mediArc ES 유저 액션 데이터 집계"""
    import httpx

    es_url = getattr(settings, "mediarc_es_url", "http://localhost:8001")
    params: Dict[str, str] = {
        "q": "*",
        "index_names": "medilinx-logs-data",
        "size": "500",
    }
    if date_from:
        params["start_date"] = date_from
    if date_to:
        params["end_date"] = date_to

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{es_url}/api/search", params=params)
            resp.raise_for_status()
            data = resp.json()

        hits = data.get("hits", [])
        if not hits:
            return _empty_journey("데이터가 없습니다")

        device_map: Dict[str, int] = {}
        action_map: Dict[str, int] = {}
        hospital_map: Dict[str, int] = {}
        daily_map: Dict[str, int] = {}
        os_map: Dict[str, int] = {}
        total_count = 0

        for h in hits:
            src = h.get("_source", {}).get("data", h.get("data", {}))
            if not src:
                continue

            # hospital_id 필터링 (해시된 ID)
            usr = src.get("user", {})
            hosp = usr.get("hospital", {})
            h_id = hosp.get("id", "")
            h_name = hosp.get("name", "")

            if hospital_id and h_id != hospital_id:
                continue

            total_count += 1

            # 디바이스 (모바일/데스크톱으로 분류)
            ci = src.get("clientInfo", {})
            raw_device = ci.get("device", "unknown")
            if raw_device in ("iPhone", "iPad"):
                device_map["iOS"] = device_map.get("iOS", 0) + 1
            elif "android" in ci.get("os", "").lower() or raw_device not in ("unknown",):
                device_map["Android"] = device_map.get("Android", 0) + 1
            else:
                device_map["기타"] = device_map.get("기타", 0) + 1

            # OS 분포
            os_name = ci.get("os", "unknown").split(" ")[0] if ci.get("os") else "unknown"
            os_map[os_name] = os_map.get(os_name, 0) + 1

            # 액션 유형
            ctx = src.get("context", "unknown")
            label = ctx.replace("UserAction-", "")
            action_map[label] = action_map.get(label, 0) + 1

            # 병원별 활동
            if h_name:
                hospital_map[h_name] = hospital_map.get(h_name, 0) + 1

            # 일별 추이
            ts = h.get("@timestamp", "")
            day = str(ts)[:10]
            if day:
                daily_map[day] = daily_map.get(day, 0) + 1

        return {
            "total_events": total_count,
            "es_total": data.get("total", 0),
            "device_distribution": [{"name": k, "value": v} for k, v in sorted(device_map.items(), key=lambda x: -x[1])],
            "action_distribution": [{"name": k, "value": v} for k, v in sorted(action_map.items(), key=lambda x: -x[1])],
            "top_hospitals": [{"name": k, "value": v} for k, v in sorted(hospital_map.items(), key=lambda x: -x[1])[:10]],
            "os_distribution": [{"name": k, "value": v} for k, v in sorted(os_map.items(), key=lambda x: -x[1])],
            "daily_visits": [{"date": k, "count": v} for k, v in sorted(daily_map.items())],
        }

    except Exception as e:
        logger.warning(f"ES journey fetch failed: {e}")
        return _empty_journey(str(e))


def _empty_journey(warning: str = "") -> dict:
    return {
        "total_events": 0,
        "es_total": 0,
        "device_distribution": [],
        "action_distribution": [],
        "top_hospitals": [],
        "os_distribution": [],
        "daily_visits": [],
        "warning": warning or "ES 서비스 연결 불가",
    }


@router.post("/patients")
async def patient_list(
    req: PatientListRequest,
    user: dict = Depends(get_current_user),
):
    """환자 통합 목록 — chat(user_uuid) + survey(respondent_uuid) merge by web_app_key"""

    # ── 1) 상담 건수 by user_uuid ──
    chat_where = ""
    chat_params: tuple = ()
    if req.hospital_id:
        chat_where = "WHERE c.hospital_id = %s"
        chat_params = (req.hospital_id,)

    chat_rows = await db_manager.execute_query(f"""
        SELECT c.user_uuid AS web_app_key,
               COUNT(*) AS chat_count,
               MAX(c.created_at) AS last_chat,
               MAX(h.hospital_name) AS hospital_name
        FROM welno.tb_partner_rag_chat_log c
        LEFT JOIN welno.tb_hospital_rag_config h
          ON h.hospital_id = c.hospital_id AND h.is_active = true
        {chat_where}
        GROUP BY c.user_uuid
    """, chat_params)

    # ── 2) 서베이 건수 by respondent_uuid (두 테이블 UNION) ──
    survey_where = ""
    survey_params: tuple = ()
    if req.hospital_id:
        survey_where = "WHERE hospital_id = %s"
        survey_params = (req.hospital_id,)

    survey_rows = await db_manager.execute_query(f"""
        SELECT respondent_uuid AS web_app_key,
               SUM(cnt) AS survey_count,
               MAX(last_survey) AS last_survey
        FROM (
            SELECT respondent_uuid, hospital_id,
                   COUNT(*) AS cnt, MAX(created_at) AS last_survey
            FROM welno.tb_hospital_survey_responses
            {survey_where}
            GROUP BY respondent_uuid, hospital_id
          UNION ALL
            SELECT respondent_uuid, hospital_id,
                   COUNT(*) AS cnt, MAX(created_at) AS last_survey
            FROM welno.tb_survey_responses_dynamic
            {survey_where}
            GROUP BY respondent_uuid, hospital_id
        ) sub
        GROUP BY respondent_uuid
    """, survey_params + survey_params)

    # ── 3) Python merge by web_app_key ──
    merged: Dict[str, dict] = {}
    for row in chat_rows:
        key = row["web_app_key"]
        if not key:
            continue
        merged[key] = {
            "web_app_key": key,
            "chat_count": row["chat_count"],
            "survey_count": 0,
            "last_activity": str(row["last_chat"]) if row["last_chat"] else None,
            "hospital_name": row["hospital_name"] or "",
        }

    for row in survey_rows:
        key = row["web_app_key"]
        if not key:
            continue
        if key in merged:
            merged[key]["survey_count"] = row["survey_count"]
            sr = str(row["last_survey"]) if row["last_survey"] else None
            if sr and (not merged[key]["last_activity"] or sr > merged[key]["last_activity"]):
                merged[key]["last_activity"] = sr
        else:
            merged[key] = {
                "web_app_key": key,
                "chat_count": 0,
                "survey_count": row["survey_count"],
                "last_activity": str(row["last_survey"]) if row["last_survey"] else None,
                "hospital_name": "",
            }

    patients = sorted(merged.values(), key=lambda x: x["last_activity"] or "", reverse=True)

    return {"patients": patients, "total": len(patients)}
