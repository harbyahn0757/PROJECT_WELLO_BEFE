"""
파트너오피스 API — 로그인, 대시보드, 환자 통합, 사용자 여정 분석
로그인은 p9_mkt_biz.user_accounts 테이블 (Jerry 공용 계정 체계)
"""

import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt

from ....core.config import settings
from ....core.database import db_manager
from ....utils.query_builders import build_filter
from ....utils.survey_queries import survey_union_daily, survey_union_count_today, survey_union_by_respondent, survey_union_detail_for_user

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

class ExportJsonRequest(BaseModel):
    hospital_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None

class AnalyticsRequest(BaseModel):
    hospital_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    risk_levels: Optional[list] = None
    sentiments: Optional[list] = None
    buying_signals: Optional[list] = None
    vip_risk_scores: Optional[list] = None
    follow_up_only: bool = False
    page: int = 1
    page_size: int = 20

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
    _survey_sql, _survey_params = survey_union_daily(date_from, date_to)
    survey_rows = await db_manager.execute_query(_survey_sql, _survey_params)
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

    w, p = build_filter(
        partner_id=partner_id,
        hospital_id=hospital_id,
        date_from=date_from,
        date_to=date_to,
    )
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

    # 오늘 서베이 건수
    _today_sql, _today_params = survey_union_count_today()
    today_survey_row = await db_manager.execute_one(_today_sql, _today_params)

    if summary:
        summary["today_surveys"] = today_survey_row["today_surveys"] if today_survey_row else 0

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

    # ── 1-2) 수검자명 by user_uuid (최신 레코드 기준) ──
    name_rows = await db_manager.execute_query("""
        SELECT DISTINCT ON (user_uuid)
            user_uuid AS web_app_key,
            COALESCE(
                initial_data->'patient_info'->>'name',
                client_info->>'patient_name',
                ''
            ) AS patient_name
        FROM welno.tb_partner_rag_chat_log
        WHERE user_uuid IS NOT NULL
          AND (initial_data IS NOT NULL OR client_info IS NOT NULL)
        ORDER BY user_uuid, created_at DESC
    """)
    name_map = {r["web_app_key"]: r["patient_name"] for r in name_rows if r["patient_name"]}

    # ── 2) 서베이 건수 by respondent_uuid (두 테이블 UNION) ──
    _by_resp_sql, _by_resp_params = survey_union_by_respondent(req.hospital_id)
    survey_rows = await db_manager.execute_query(_by_resp_sql, _by_resp_params)

    # ── 3) ES: webAppKey별 여정(이벤트) 건수 ──
    import httpx

    journey_map: Dict[str, int] = {}
    es_name_map: Dict[str, str] = {}   # 마스킹 안 된 풀네임만
    try:
        es_url = settings.elasticsearch_url.rstrip("/")
        es_query = {"term": {"header.project.name": "med2-frontend-hana"}}
        if req.hospital_id:
            es_query = {
                "bool": {
                    "must": [
                        {"term": {"header.project.name": "med2-frontend-hana"}},
                        {"term": {"data.user.hospital.id.keyword": req.hospital_id}},
                    ]
                }
            }
        es_body = {
            "size": 0,
            "query": es_query,
            "aggs": {
                "by_user": {
                    "terms": {
                        "field": "data.user.webAppKey.keyword",
                        "size": 10000,
                    },
                    "aggs": {
                        "latest": {
                            "top_hits": {
                                "size": 20,
                                "_source": ["data.user.name"],
                                "sort": [{"header.@timestamp": "desc"}],
                            }
                        }
                    },
                }
            },
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{es_url}/medilinx-logs-data/_search", json=es_body
            )
            resp.raise_for_status()
            buckets = resp.json().get("aggregations", {}).get("by_user", {}).get("buckets", [])
            for b in buckets:
                journey_map[b["key"]] = b["doc_count"]
                hits = b.get("latest", {}).get("hits", {}).get("hits", [])
                for hit in hits:
                    name = hit.get("_source", {}).get("data", {}).get("user", {}).get("name", "")
                    if name and "*" not in name:
                        es_name_map[b["key"]] = name
                        break
                    elif name and b["key"] not in es_name_map:
                        es_name_map[b["key"]] = name  # 마스킹 이름이라도 폴백
    except Exception as e:
        logger.warning(f"ES journey count fetch failed: {e}")

    # ── 3-2) ES: DOWNLOAD_ONLY 정책 대상 webAppKey 감지 ──
    download_only_keys: set = set()
    try:
        dl_body = {
            "size": 0,
            "query": {
                "bool": {
                    "must": [
                        {"term": {"header.project.name": "med2-frontend-hana"}},
                        {"match_phrase": {"data.message": "DOWNLOAD_ONLY"}},
                    ]
                }
            },
            "aggs": {
                "by_user": {
                    "terms": {"field": "data.user.webAppKey.keyword", "size": 10000}
                }
            },
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{es_url}/medilinx-logs-data/_search", json=dl_body)
            resp.raise_for_status()
            buckets = resp.json().get("aggregations", {}).get("by_user", {}).get("buckets", [])
            download_only_keys = {b["key"] for b in buckets}
    except Exception as e:
        logger.warning(f"ES download_only fetch failed: {e}")

    # ── 4) Python merge by web_app_key ──
    # survey respondent_name 맵
    survey_name_map = {r["web_app_key"]: r["respondent_name"] for r in survey_rows if r.get("respondent_name")}

    # 이름 우선순위: chat_log → survey respondent_name → ES(풀네임만, 마스킹 제외)
    def _resolve_name(key: str) -> str:
        return name_map.get(key, "") or survey_name_map.get(key, "") or es_name_map.get(key, "")

    merged: Dict[str, dict] = {}
    for row in chat_rows:
        key = row["web_app_key"]
        if not key:
            continue
        merged[key] = {
            "web_app_key": key,
            "patient_name": _resolve_name(key),
            "chat_count": row["chat_count"],
            "survey_count": 0,
            "journey_count": 0,
            "last_activity": str(row["last_chat"]) if row["last_chat"] else None,
            "hospital_name": row["hospital_name"] or "",
            "download_only": key in download_only_keys,
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
            if not merged[key]["patient_name"]:
                merged[key]["patient_name"] = _resolve_name(key)
            # 서베이 쪽 병원명이 있고 기존이 비어있으면 보완
            if not merged[key]["hospital_name"] and row.get("hospital_name"):
                merged[key]["hospital_name"] = row["hospital_name"]
        else:
            merged[key] = {
                "web_app_key": key,
                "patient_name": _resolve_name(key),
                "chat_count": 0,
                "survey_count": row["survey_count"],
                "journey_count": 0,
                "last_activity": str(row["last_survey"]) if row["last_survey"] else None,
                "hospital_name": row.get("hospital_name") or "",
                "download_only": key in download_only_keys,
            }

    # ES 여정 데이터 merge — DB에 있는 유저만 여정 건수 매핑
    for key, count in journey_map.items():
        if key and key in merged:
            merged[key]["journey_count"] = count

    # ── 5) 이름 없는 환자 → ES 개별 조회로 이름 보충 ──
    no_name_keys = [k for k, v in merged.items() if not v.get("patient_name")]
    if no_name_keys:
        try:
            es_url = settings.elasticsearch_url.rstrip("/")
            # 최대 50명씩 msearch
            for batch_start in range(0, len(no_name_keys), 50):
                batch = no_name_keys[batch_start:batch_start + 50]
                msearch_body = ""
                for wak in batch:
                    msearch_body += json.dumps({}) + "\n"
                    msearch_body += json.dumps({
                        "size": 10,
                        "query": {"bool": {"must": [
                            {"term": {"header.project.name": "med2-frontend-hana"}},
                            {"term": {"data.user.webAppKey.keyword": wak}},
                        ]}},
                        "_source": ["data.user.name"],
                        "sort": [{"header.@timestamp": "desc"}],
                    }) + "\n"
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(
                        f"{es_url}/medilinx-logs-data/_msearch",
                        content=msearch_body,
                        headers={"Content-Type": "application/x-ndjson"},
                    )
                    resp.raise_for_status()
                    responses = resp.json().get("responses", [])
                    for idx, r in enumerate(responses):
                        wak = batch[idx]
                        for hit in r.get("hits", {}).get("hits", []):
                            name = hit.get("_source", {}).get("data", {}).get("user", {}).get("name", "")
                            if name and "*" not in name:
                                merged[wak]["patient_name"] = name
                                break
                            elif name and not merged[wak].get("patient_name"):
                                merged[wak]["patient_name"] = name  # 마스킹 이름이라도 폴백
        except Exception as e:
            logger.warning(f"ES name supplement failed: {e}")

    patients = sorted(merged.values(), key=lambda x: x["last_activity"] or "", reverse=True)

    return {"patients": patients, "total": len(patients)}


@router.post("/patients/{web_app_key}/detail")
async def patient_detail(web_app_key: str, user: dict = Depends(get_current_user)):
    """환자 상세 — 상담, 서베이, 여정, 검진데이터 통합 조회"""
    import httpx

    # ── 1) 상담 세션 목록 (chat_log + tags JOIN) ──
    chats = await db_manager.execute_query("""
        SELECT
            c.session_id,
            h.hospital_name,
            MIN(c.created_at) AS created_at,
            COUNT(*) AS message_count,
            t.risk_level,
            t.sentiment,
            t.conversation_summary AS summary,
            t.tagging_model,
            t.action_intent,
            t.follow_up_needed,
            t.engagement_score,
            t.data_quality_score,
            t.interest_tags,
            t.key_concerns,
            t.counselor_recommendations,
            t.nutrition_tags,
            t.commercial_tags,
            t.buying_signal,
            t.conversion_flag
        FROM welno.tb_partner_rag_chat_log c
        LEFT JOIN welno.tb_hospital_rag_config h
          ON h.hospital_id = c.hospital_id AND h.is_active = true
        LEFT JOIN welno.tb_chat_session_tags t
          ON t.session_id = c.session_id
        WHERE c.user_uuid = %s
        GROUP BY c.session_id, h.hospital_name, t.risk_level, t.sentiment, t.conversation_summary, t.tagging_model,
                 t.action_intent, t.follow_up_needed, t.engagement_score, t.data_quality_score,
                 t.interest_tags, t.key_concerns, t.counselor_recommendations, t.nutrition_tags,
                 t.commercial_tags, t.buying_signal, t.conversion_flag
        ORDER BY MIN(c.created_at) DESC
    """, (web_app_key,))
    for row in chats:
        if row.get("created_at"):
            row["created_at"] = str(row["created_at"])

    # ── 2) 서베이 응답 (legacy + dynamic UNION) ──
    _detail_sql, _detail_params = survey_union_detail_for_user(web_app_key)
    surveys = await db_manager.execute_query(_detail_sql, _detail_params)

    # 병원명 매핑
    if surveys:
        hosp_ids = list(set(r["hospital_id"] for r in surveys if r.get("hospital_id")))
        hosp_map = {}
        if hosp_ids:
            hosp_rows = await db_manager.execute_query(
                "SELECT hospital_id, hospital_name FROM welno.tb_hospital_rag_config WHERE hospital_id = ANY(%s)",
                (hosp_ids,)
            )
            hosp_map = {r["hospital_id"]: r["hospital_name"] for r in hosp_rows}
        for row in surveys:
            row["hospital_name"] = hosp_map.get(row.get("hospital_id"), "")
            if row.get("created_at"):
                row["created_at"] = str(row["created_at"])
            # overall_score 계산
            if row.get("template_name") == "legacy":
                scores = [row.get(k) for k in ("reservation_process", "facility_cleanliness", "staff_kindness", "waiting_time", "overall_satisfaction") if row.get(k) is not None]
                row["overall_score"] = round(sum(scores) / len(scores), 1) if scores else None
            elif row.get("answers"):
                import json as _json
                try:
                    ans = _json.loads(row["answers"]) if isinstance(row["answers"], str) else row["answers"]
                    # 텍스트 필드 제외, 숫자(int/float/숫자문자열) 만 평균
                    _text_keys = {"free_text", "free_comment"}
                    nums = []
                    for k, v in ans.items():
                        if k in _text_keys:
                            continue
                        if isinstance(v, (int, float)):
                            nums.append(v)
                        elif isinstance(v, str):
                            try:
                                nums.append(float(v))
                            except ValueError:
                                pass
                    row["overall_score"] = round(sum(nums) / len(nums), 1) if nums else None
                except Exception:
                    row["overall_score"] = None

    # ── 3) 환자 정보 + 검진데이터 (공통 모듈 사용) ──
    from ....utils.health_metrics import parse_patient_info

    health_row = await db_manager.execute_one("""
        SELECT initial_data, client_info
        FROM welno.tb_partner_rag_chat_log
        WHERE user_uuid = %s
          AND (initial_data IS NOT NULL OR client_info IS NOT NULL)
        ORDER BY created_at DESC LIMIT 1
    """, (web_app_key,))

    patient_name, health_data = parse_patient_info(
        health_row.get("initial_data") if health_row else None,
        health_row.get("client_info") if health_row else None,
    )

    # 설문 respondent_name 폴백 (chat_log에 이름이 없는 설문-only 환자)
    if not patient_name:
        name_row = await db_manager.execute_one("""
            SELECT respondent_name FROM (
                SELECT respondent_name, created_at FROM welno.tb_hospital_survey_responses
                WHERE respondent_uuid = %s AND respondent_name IS NOT NULL AND respondent_name != ''
                UNION ALL
                SELECT respondent_name, created_at FROM welno.tb_survey_responses_dynamic
                WHERE respondent_uuid = %s AND respondent_name IS NOT NULL AND respondent_name != ''
            ) sub ORDER BY created_at DESC LIMIT 1
        """, (web_app_key, web_app_key))
        if name_row:
            patient_name = name_row["respondent_name"]

    # ── 4) 여정 이벤트 (ES) — 최근 50건 + 이름 폴백 ──
    journey_events = []
    es_name = ""
    try:
        es_url = settings.elasticsearch_url.rstrip("/")
        es_body = {
            "size": 50,
            "query": {
                "bool": {
                    "must": [
                        {"term": {"header.project.name": "med2-frontend-hana"}},
                        {"term": {"data.user.webAppKey.keyword": web_app_key}},
                    ]
                }
            },
            "sort": [{"header.@timestamp": {"order": "desc"}}],
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(f"{es_url}/medilinx-logs-data/_search", json=es_body)
            resp.raise_for_status()
            hits = resp.json().get("hits", {}).get("hits", [])
            for hit in hits:
                src = hit.get("_source", {})
                data = src.get("data", {})
                ci = data.get("clientInfo", {})
                ctx = data.get("context", "unknown").replace("UserAction-", "")
                ts = src.get("header", {}).get("@timestamp", "")
                journey_events.append({
                    "timestamp": str(ts)[:19].replace("T", " ") if ts else "",
                    "action": ctx,
                    "message": data.get("message", ""),
                    "page_title": data.get("pageTitle", data.get("page", {}).get("title", "")),
                    "device": ci.get("device", ""),
                    "os": ci.get("os", ""),
                    "browser": ci.get("browser", ""),
                })
                # ES에서 이름 추출 (풀네임 우선, 마스킹 이름도 폴백)
                if not es_name or "*" in es_name:
                    _n = data.get("user", {}).get("name", "")
                    if _n and "*" not in _n:
                        es_name = _n
                    elif _n and not es_name:
                        es_name = _n
    except Exception as e:
        logger.warning(f"ES journey detail fetch failed for {web_app_key}: {e}")

    # ES 이름 폴백
    if not patient_name and es_name:
        patient_name = es_name

    return {
        "web_app_key": web_app_key,
        "patient_name": patient_name,
        "chats": chats,
        "surveys": surveys,
        "journey_events": journey_events,
        "health_data": health_data,
    }


@router.post("/export/json")
async def export_all_json(
    req: ExportJsonRequest,
    user: dict = Depends(get_current_user),
):
    """전체 데이터 JSON 내보내기 — 상담 로그 + 설문 응답(legacy+dynamic) + 태깅 + 환자 목록"""
    hospital_id = req.hospital_id
    date_to = req.date_to or datetime.utcnow().strftime("%Y-%m-%d")
    date_from = req.date_from or (datetime.utcnow() - timedelta(days=90)).strftime("%Y-%m-%d")

    h_where = "AND t.hospital_id = %s" if hospital_id else ""
    h_param = (hospital_id,) if hospital_id else ()

    # ── 1) 상담 로그 ──
    chat_logs = await db_manager.execute_query(f"""
        SELECT t.id, t.user_uuid, t.hospital_id, t.partner_id,
               t.user_message, t.assistant_message, t.created_at
        FROM welno.tb_partner_rag_chat_log t
        WHERE t.created_at >= %s::date AND t.created_at < (%s::date + interval '1 day')
        {h_where}
        ORDER BY t.created_at DESC
    """, (date_from, date_to) + h_param)
    for r in chat_logs:
        if r.get("created_at"):
            r["created_at"] = str(r["created_at"])

    # ── 2) 태깅 데이터 ──
    h_where_tag = "AND t.hospital_id = %s" if hospital_id else ""
    tagging_data = await db_manager.execute_query(f"""
        SELECT t.id, t.user_uuid, t.hospital_id, t.partner_id,
               t.risk_level, t.sentiment, t.action_intent,
               t.interest_tags, t.nutrition_tags,
               t.engagement_score, t.created_at
        FROM welno.tb_chat_session_tags t
        WHERE t.created_at >= %s::date AND t.created_at < (%s::date + interval '1 day')
        {h_where_tag}
        ORDER BY t.created_at DESC
    """, (date_from, date_to) + h_param)
    for r in tagging_data:
        if r.get("created_at"):
            r["created_at"] = str(r["created_at"])

    # ── 3) 설문 응답 — legacy (고정 필드) ──
    h_where_s = "AND hospital_id = %s" if hospital_id else ""
    survey_legacy = await db_manager.execute_query(f"""
        SELECT id, partner_id, hospital_id,
               reservation_process, facility_cleanliness, staff_kindness,
               waiting_time, overall_satisfaction,
               free_comment, respondent_uuid, created_at
        FROM welno.tb_hospital_survey_responses
        WHERE created_at >= %s::date AND created_at < (%s::date + interval '1 day')
        {h_where_s}
        ORDER BY created_at DESC
    """, (date_from, date_to) + h_param)
    for r in survey_legacy:
        if r.get("created_at"):
            r["created_at"] = str(r["created_at"])

    # ── 4) 설문 응답 — dynamic (동적 템플릿) ──
    survey_dynamic = await db_manager.execute_query(f"""
        SELECT id, template_id, partner_id, hospital_id,
               answers, free_comment, respondent_uuid, created_at
        FROM welno.tb_survey_responses_dynamic
        WHERE created_at >= %s::date AND created_at < (%s::date + interval '1 day')
        {h_where_s}
        ORDER BY created_at DESC
    """, (date_from, date_to) + h_param)
    for r in survey_dynamic:
        if r.get("created_at"):
            r["created_at"] = str(r["created_at"])

    return {
        "exported_at": datetime.utcnow().isoformat(),
        "filters": {"hospital_id": hospital_id, "date_from": date_from, "date_to": date_to},
        "chat_logs": {"count": len(chat_logs), "data": chat_logs},
        "tagging": {"count": len(tagging_data), "data": tagging_data},
        "survey_legacy": {"count": len(survey_legacy), "data": survey_legacy},
        "survey_dynamic": {"count": len(survey_dynamic), "data": survey_dynamic},
    }


# ─── Analytics (Cross-Analysis) ──────────────────────────

def _build_analytics_where(req: AnalyticsRequest):
    """Build parameterized WHERE clause from AnalyticsRequest filters."""
    conditions = ["1=1"]
    params: list = []
    if req.hospital_id:
        conditions.append("v.hospital_id = %s")
        params.append(req.hospital_id)
    if req.date_from:
        conditions.append("v.chat_date >= %s::date")
        params.append(req.date_from)
    if req.date_to:
        conditions.append("v.chat_date < (%s::date + interval '1 day')")
        params.append(req.date_to)
    if req.risk_levels:
        conditions.append("v.risk_level = ANY(%s)")
        params.append(req.risk_levels)
    if req.sentiments:
        conditions.append("v.sentiment = ANY(%s)")
        params.append(req.sentiments)
    if req.buying_signals:
        conditions.append("v.buying_signal = ANY(%s)")
        params.append(req.buying_signals)
    if req.vip_risk_scores:
        conditions.append("v.vip_risk_score = ANY(%s)")
        params.append(req.vip_risk_scores)
    if req.follow_up_only:
        conditions.append("v.follow_up_needed = true")
    return " AND ".join(conditions), params


@router.post("/analytics")
async def analytics(
    req: AnalyticsRequest,
    user: dict = Depends(get_current_user),
):
    """교차 분석 대시보드 — v_analysis_cross 뷰 기반 집계"""
    import json as _json

    where, params = _build_analytics_where(req)

    # 1) summary
    summary_row = await db_manager.execute_one(
        f"""SELECT
                COUNT(*) AS total_sessions,
                COUNT(*) FILTER (WHERE v.risk_level = 'high') AS high_risk,
                COUNT(*) FILTER (WHERE v.follow_up_needed = true) AS follow_up_needed,
                COALESCE(ROUND(AVG(v.engagement_score)::numeric, 1), 0) AS avg_engagement
            FROM welno.v_analysis_cross v
            WHERE {where}""",
        params,
    )
    total = summary_row["total_sessions"] if summary_row else 0
    follow_up = summary_row["follow_up_needed"] if summary_row else 0
    summary = {
        "total_sessions": total,
        "high_risk": summary_row["high_risk"] if summary_row else 0,
        "follow_up_needed": follow_up,
        "avg_engagement": float(summary_row["avg_engagement"]) if summary_row else 0,
        "follow_up_rate": round(follow_up / total * 100, 1) if total else 0,
    }

    # 2) risk_distribution
    risk_dist = await db_manager.execute_query(
        f"""SELECT v.risk_level AS name, COUNT(*) AS value
            FROM welno.v_analysis_cross v
            WHERE {where} AND v.risk_level IS NOT NULL
            GROUP BY v.risk_level""",
        params,
    )

    # 3) sentiment_distribution
    sentiment_dist = await db_manager.execute_query(
        f"""SELECT v.sentiment AS name, COUNT(*) AS value
            FROM welno.v_analysis_cross v
            WHERE {where} AND v.sentiment IS NOT NULL
            GROUP BY v.sentiment""",
        params,
    )

    # 4) intent_distribution
    intent_dist = await db_manager.execute_query(
        f"""SELECT v.action_intent AS name, COUNT(*) AS value
            FROM welno.v_analysis_cross v
            WHERE {where} AND v.action_intent IS NOT NULL
            GROUP BY v.action_intent""",
        params,
    )

    # 5) engagement_distribution (bucketed)
    engagement_dist = await db_manager.execute_query(
        f"""SELECT
                CASE
                    WHEN v.engagement_score BETWEEN 0 AND 2 THEN 'low'
                    WHEN v.engagement_score BETWEEN 3 AND 5 THEN 'medium'
                    WHEN v.engagement_score BETWEEN 6 AND 8 THEN 'high'
                    WHEN v.engagement_score >= 9 THEN 'very_high'
                END AS name,
                COUNT(*) AS value
            FROM welno.v_analysis_cross v
            WHERE {where} AND v.engagement_score IS NOT NULL
            GROUP BY name""",
        params,
    )

    # 6) buying_signal_distribution
    buying_dist = await db_manager.execute_query(
        f"""SELECT v.buying_signal AS name, COUNT(*) AS value
            FROM welno.v_analysis_cross v
            WHERE {where} AND v.buying_signal IS NOT NULL
            GROUP BY v.buying_signal""",
        params,
    )

    # 7) commercial_categories
    commercial_cats = await db_manager.execute_query(
        f"""SELECT elem->>'category' AS category, COUNT(*) AS count
            FROM welno.v_analysis_cross v,
                 jsonb_array_elements(v.commercial_tags) AS elem
            WHERE {where} AND v.commercial_tags IS NOT NULL
            GROUP BY elem->>'category'
            ORDER BY count DESC""",
        params,
    )

    # 8) vip_risk_distribution
    vip_dist = await db_manager.execute_query(
        f"""SELECT v.vip_risk_score AS name, COUNT(*) AS value
            FROM welno.v_analysis_cross v
            WHERE {where} AND v.vip_risk_score IS NOT NULL
            GROUP BY v.vip_risk_score""",
        params,
    )

    # 9) pain_points
    pain_points = await db_manager.execute_query(
        f"""SELECT 'waiting_time' AS area, COUNT(*) FILTER (WHERE v.pp_waiting_time) AS count
                FROM welno.v_analysis_cross v WHERE {where}
            UNION ALL
            SELECT 'facility' AS area, COUNT(*) FILTER (WHERE v.pp_facility) AS count
                FROM welno.v_analysis_cross v WHERE {where}
            UNION ALL
            SELECT 'staff' AS area, COUNT(*) FILTER (WHERE v.pp_staff) AS count
                FROM welno.v_analysis_cross v WHERE {where}""",
        params + params + params,
    )

    # 10) interest_tags (top 15)
    interest_tags = await db_manager.execute_query(
        f"""SELECT elem->>'topic' AS topic, COUNT(*) AS count
            FROM welno.v_analysis_cross v,
                 jsonb_array_elements(v.interest_tags) AS elem
            WHERE {where} AND v.interest_tags IS NOT NULL
            GROUP BY elem->>'topic'
            ORDER BY count DESC
            LIMIT 15""",
        params,
    )

    # 11) key_concerns (top 20)
    key_concerns_rows = await db_manager.execute_query(
        f"""SELECT concern, COUNT(*) AS cnt
            FROM welno.v_analysis_cross v,
                 jsonb_array_elements_text(v.key_concerns) AS concern
            WHERE {where} AND v.key_concerns IS NOT NULL
            GROUP BY concern
            ORDER BY cnt DESC
            LIMIT 20""",
        params,
    )
    key_concerns = [r["concern"] for r in key_concerns_rows]

    # 12) daily_trend (pivot by risk_level)
    daily_trend = await db_manager.execute_query(
        f"""SELECT v.chat_date::date AS date,
                   COUNT(*) FILTER (WHERE v.risk_level = 'low') AS low,
                   COUNT(*) FILTER (WHERE v.risk_level = 'medium') AS medium,
                   COUNT(*) FILTER (WHERE v.risk_level = 'high') AS high
            FROM welno.v_analysis_cross v
            WHERE {where}
            GROUP BY v.chat_date::date
            ORDER BY date""",
        params,
    )
    for row in daily_trend:
        row["date"] = str(row["date"])

    # 13) sessions (paginated)
    offset = (req.page - 1) * req.page_size
    sessions = await db_manager.execute_query(
        f"""SELECT v.session_id, v.hospital_name,
                   v.chat_date AS created_at,
                   v.risk_level, v.sentiment, v.action_intent,
                   COALESCE(v.engagement_score, 0) AS engagement_score,
                   COALESCE(v.follow_up_needed, false) AS follow_up_needed,
                   v.buying_signal, v.vip_risk_score,
                   v.conversation_summary AS summary,
                   v.interest_tags, v.commercial_tags, v.key_concerns
            FROM welno.v_analysis_cross v
            WHERE {where}
            ORDER BY v.chat_date DESC
            LIMIT %s OFFSET %s""",
        params + [req.page_size, offset],
    )
    for row in sessions:
        if row.get("created_at"):
            row["created_at"] = str(row["created_at"])
        # Parse JSONB fields for FE
        raw_it = row.get("interest_tags")
        if raw_it:
            if isinstance(raw_it, str):
                try:
                    raw_it = _json.loads(raw_it)
                except Exception:
                    raw_it = []
            row["interest_tags"] = [
                {"topic": t.get("topic", ""), "intensity": t.get("intensity", "")}
                for t in raw_it if isinstance(t, dict)
            ]
        else:
            row["interest_tags"] = []

        raw_ct = row.get("commercial_tags")
        if raw_ct:
            if isinstance(raw_ct, str):
                try:
                    raw_ct = _json.loads(raw_ct)
                except Exception:
                    raw_ct = []
            row["commercial_tags"] = [
                {"category": t.get("category", ""), "product_hint": t.get("product_hint", ""), "segment": t.get("segment", "")}
                for t in raw_ct if isinstance(t, dict)
            ]
        else:
            row["commercial_tags"] = []

        raw_kc = row.get("key_concerns")
        if raw_kc:
            if isinstance(raw_kc, str):
                try:
                    raw_kc = _json.loads(raw_kc)
                except Exception:
                    raw_kc = []
            row["key_concerns"] = [c for c in raw_kc if isinstance(c, str)]
        else:
            row["key_concerns"] = []

    # 14) total count for pagination
    total_row = await db_manager.execute_one(
        f"""SELECT COUNT(*) AS cnt FROM welno.v_analysis_cross v WHERE {where}""",
        params,
    )
    total_sessions_in_page = total_row["cnt"] if total_row else 0

    return {
        "summary": summary,
        "risk_distribution": risk_dist,
        "sentiment_distribution": sentiment_dist,
        "intent_distribution": intent_dist,
        "engagement_distribution": engagement_dist,
        "buying_signal_distribution": buying_dist,
        "commercial_categories": commercial_cats,
        "vip_risk_distribution": vip_dist,
        "pain_points": pain_points,
        "interest_tags": interest_tags,
        "key_concerns": key_concerns,
        "daily_trend": daily_trend,
        "sessions": sessions,
        "total_sessions_in_page": total_sessions_in_page,
        "page": req.page,
        "page_size": req.page_size,
    }
