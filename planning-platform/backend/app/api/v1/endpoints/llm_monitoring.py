"""
M10-A: LLM 모니터링 조회 API (cc-dashboard 연동용)

읽기 전용 + key 인증. 8 KPI: traffic / tokens / cost / latency / TTFT (logger 기반) / errors / TopSession / orchestration.
SoT: welno.llm_usage_log + LLMRouter QuotaGuard in-memory.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Header, Query
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

try:
    from zoneinfo import ZoneInfo
    _KST = ZoneInfo("Asia/Seoul")
except Exception:
    _KST = timezone(timedelta(hours=9))


def _verify_key(x_admin_key: Optional[str]) -> None:
    """간단 readonly key 인증. settings.welno_admin_api_key 와 비교."""
    from app.core.config import settings
    expected = getattr(settings, "welno_admin_api_key", None)
    if not expected:
        # 미설정 시 차단 (production 안전 기본값)
        raise HTTPException(status_code=503, detail="admin api key not configured")
    if not x_admin_key or x_admin_key != expected:
        raise HTTPException(status_code=401, detail="invalid admin key")


@router.get("/overview")
async def overview(
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
    days: int = Query(1, ge=1, le=30),
) -> Dict[str, Any]:
    """오늘+최근 N일 요약 — calls, cost, p95 latency, fail rate, top model."""
    _verify_key(x_admin_key)
    from app.core.database import db_manager
    from app.core.llm_pricing import estimate_usd

    now_kst = datetime.now(_KST)
    today_start = now_kst.replace(hour=0, minute=0, second=0, microsecond=0)
    range_start = today_start - timedelta(days=days - 1)

    sql = """
        SELECT model, endpoint, success, error_class,
               COALESCE(input_tokens, 0) AS in_t,
               COALESCE(output_tokens, 0) AS out_t,
               COALESCE(cached_tokens, 0) AS cached_t,
               COALESCE(latency_ms, 0) AS lat_ms,
               ttft_ms,
               session_id, partner_id, hospital_id, ts
        FROM welno.llm_usage_log
        WHERE ts >= %s
        ORDER BY ts DESC
    """
    rows = await db_manager.execute_query(sql, (range_start,))

    by_day: Dict[str, Dict[str, Any]] = {}
    by_endpoint: Dict[str, Dict[str, Any]] = {}
    by_model: Dict[str, Dict[str, Any]] = {}
    by_error_class: Dict[str, int] = {}
    latencies: List[int] = []
    ttfts: List[int] = []
    sessions: Dict[str, Dict[str, Any]] = {}

    for r in rows:
        ts: datetime = r["ts"]
        day = ts.astimezone(_KST).strftime("%Y-%m-%d")
        d_bucket = by_day.setdefault(day, {"calls": 0, "fail": 0, "cost": 0.0, "in_t": 0, "out_t": 0})
        d_bucket["calls"] += 1
        if not r["success"]:
            d_bucket["fail"] += 1
            ec = r["error_class"] or "(none)"
            by_error_class[ec] = by_error_class.get(ec, 0) + 1
        in_t, out_t, cached_t = int(r["in_t"]), int(r["out_t"]), int(r["cached_t"])
        cost = estimate_usd(r["model"], in_t, out_t, cached_t)
        d_bucket["cost"] += cost
        d_bucket["in_t"] += in_t
        d_bucket["out_t"] += out_t
        ep = r["endpoint"] or "unknown"
        ep_b = by_endpoint.setdefault(ep, {"calls": 0, "fail": 0, "cost": 0.0})
        ep_b["calls"] += 1
        ep_b["cost"] += cost
        if not r["success"]:
            ep_b["fail"] += 1
        m = r["model"] or "unknown"
        m_b = by_model.setdefault(m, {"calls": 0, "cost": 0.0})
        m_b["calls"] += 1
        m_b["cost"] += cost
        lat = int(r["lat_ms"] or 0)
        if lat > 0:
            latencies.append(lat)
        # db_manager.execute_query 가 dict 반환 (database.py:62) → r.get 안전
        ttft = r.get("ttft_ms")
        if ttft is not None and ttft > 0:
            ttfts.append(int(ttft))
        sid = r["session_id"]
        if sid:
            s_b = sessions.setdefault(sid, {"calls": 0, "cost": 0.0, "fail": 0, "endpoint": ep, "partner": r["partner_id"]})
            s_b["calls"] += 1
            s_b["cost"] += cost
            if not r["success"]:
                s_b["fail"] += 1

    p95 = 0
    if latencies:
        latencies.sort()
        p95 = latencies[min(int(len(latencies) * 0.95), len(latencies) - 1)]

    ttft_p95 = 0
    ttft_p50 = 0
    if ttfts:
        ttfts.sort()
        ttft_p95 = ttfts[min(int(len(ttfts) * 0.95), len(ttfts) - 1)]
        ttft_p50 = ttfts[len(ttfts) // 2]

    top_sessions = sorted(
        [{"session_id": k, **v} for k, v in sessions.items()],
        key=lambda x: x["cost"],
        reverse=True,
    )[:10]

    total_calls = sum(d["calls"] for d in by_day.values())
    total_cost = sum(d["cost"] for d in by_day.values())
    total_fail = sum(d["fail"] for d in by_day.values())

    return {
        "range_start_kst": range_start.isoformat(),
        "now_kst": now_kst.isoformat(),
        "days": days,
        "totals": {
            "calls": total_calls,
            "fail": total_fail,
            "fail_rate": (total_fail / total_calls) if total_calls else 0.0,
            "cost_usd": round(total_cost, 4),
            "p95_latency_ms": p95,
            "ttft_p50_ms": ttft_p50,
            "ttft_p95_ms": ttft_p95,
            "ttft_samples": len(ttfts),
            "unique_sessions": len(sessions),
        },
        "by_day": [{"date": k, **v, "cost": round(v["cost"], 4)} for k, v in sorted(by_day.items())],
        "by_endpoint": [{"endpoint": k, **v, "cost": round(v["cost"], 4)} for k, v in sorted(by_endpoint.items(), key=lambda x: -x[1]["calls"])],
        "by_model": [{"model": k, **v, "cost": round(v["cost"], 4)} for k, v in sorted(by_model.items(), key=lambda x: -x[1]["calls"])],
        "by_error_class": [{"error_class": k, "count": v} for k, v in sorted(by_error_class.items(), key=lambda x: -x[1])],
        "top_sessions": [{**s, "cost": round(s["cost"], 4)} for s in top_sessions],
    }


@router.get("/realtime")
async def realtime(
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
) -> Dict[str, Any]:
    """LLMRouter QuotaGuard in-memory snapshot — 분 단위 spike, EWMA, 월 누적."""
    _verify_key(x_admin_key)
    from app.services.llm_router import llm_router
    q = llm_router._quota
    from app.core.config import settings
    return {
        "state": llm_router.state.value,
        "today_usd": round(q.daily_usd(), 4),
        "month_usd": round(q.monthly_usd(), 4),
        "endpoint_token_avg": {ep: round(v, 1) for ep, v in q._endpoint_token_avg.items()},
        "top_sessions_today": [
            {"session_id": s, "cost": round(c, 4)} for s, c in q.top_sessions_today(10)
        ],
        "thresholds": {
            "cost_daily_warn": settings.llm_cost_cap_warn_usd,
            "cost_daily_block": settings.llm_cost_cap_block_usd,
            "cost_monthly_warn": settings.llm_cost_monthly_warn_usd,
            "cost_monthly_block": settings.llm_cost_monthly_block_usd,
            "spike_5min": settings.llm_spike_5min_threshold,
            "error_rate_5min": settings.llm_error_rate_5min_threshold,
            "token_spike_x": settings.llm_token_spike_multiplier,
        },
    }


@router.get("/recent_failures")
async def recent_failures(
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
    limit: int = Query(20, ge=1, le=200),
) -> Dict[str, Any]:
    """최근 실패 N건 — error_class 별 상세 (MAX_TOKENS / 503 / QUOTA / SAFETY)."""
    _verify_key(x_admin_key)
    from app.core.database import db_manager
    sql = """
        SELECT to_char(ts AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') AS ts_kst,
               endpoint, model, error_class, session_id, partner_id, hospital_id,
               input_tokens, output_tokens, latency_ms
        FROM welno.llm_usage_log
        WHERE NOT success
        ORDER BY ts DESC
        LIMIT %s
    """
    rows = await db_manager.execute_query(sql, (limit,))
    return {"failures": rows, "count": len(rows)}
