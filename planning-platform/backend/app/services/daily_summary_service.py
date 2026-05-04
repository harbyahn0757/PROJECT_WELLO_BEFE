"""
M4: DAILY_COST_SUMMARY — 매일 09:00 KST 어제 LLM 사용량/비용/실패율/Top model Slack 발송

데이터 소스: welno.llm_usage_log (P0-E0 부터 session_id propagate, error_class 세분화)
SoT 단가: app.core.llm_pricing.estimate_usd
"""
from __future__ import annotations
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Tuple

logger = logging.getLogger(__name__)

try:
    from zoneinfo import ZoneInfo
    _KST = ZoneInfo("Asia/Seoul")
except Exception:
    _KST = timezone(timedelta(hours=9))


async def _query_yesterday_summary() -> Dict[str, Any]:
    """welno.llm_usage_log 어제 (KST) 집계."""
    from ..core.database import db_manager
    from ..core.llm_pricing import estimate_usd

    # 어제 KST 00:00 ~ 오늘 KST 00:00
    now_kst = datetime.now(_KST)
    today_start_kst = now_kst.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start_kst = today_start_kst - timedelta(days=1)

    sql = """
        SELECT model, endpoint, success, error_class,
               COALESCE(input_tokens, 0) AS in_t,
               COALESCE(output_tokens, 0) AS out_t,
               COALESCE(cached_tokens, 0) AS cached_t,
               COALESCE(latency_ms, 0) AS lat_ms,
               session_id
        FROM welno.llm_usage_log
        WHERE ts >= %s AND ts < %s
    """
    rows = await db_manager.execute_query(sql, (yesterday_start_kst, today_start_kst))

    summary = {
        "date": yesterday_start_kst.strftime("%Y-%m-%d"),
        "total_calls": 0,
        "total_success": 0,
        "total_fail": 0,
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "total_cost_usd": 0.0,
        "by_endpoint": {},  # endpoint: {calls, fail, cost}
        "by_model": {},  # model: {calls, cost}
        "by_error_class": {},  # error_class: count
        "latency_p95_ms": 0,
        "unique_sessions": 0,
    }
    if not rows:
        return summary

    latencies: List[int] = []
    sessions = set()
    for r in rows:
        summary["total_calls"] += 1
        ok = bool(r["success"])
        if ok:
            summary["total_success"] += 1
        else:
            summary["total_fail"] += 1
            ec = r["error_class"] or "(none)"
            summary["by_error_class"][ec] = summary["by_error_class"].get(ec, 0) + 1
        in_t, out_t, cached_t = int(r["in_t"]), int(r["out_t"]), int(r["cached_t"])
        cost = estimate_usd(r["model"], in_t, out_t, cached_t)
        summary["total_input_tokens"] += in_t
        summary["total_output_tokens"] += out_t
        summary["total_cost_usd"] += cost
        ep = r["endpoint"] or "unknown"
        ep_bucket = summary["by_endpoint"].setdefault(ep, {"calls": 0, "fail": 0, "cost": 0.0})
        ep_bucket["calls"] += 1
        ep_bucket["cost"] += cost
        if not ok:
            ep_bucket["fail"] += 1
        m = r["model"] or "unknown"
        m_bucket = summary["by_model"].setdefault(m, {"calls": 0, "cost": 0.0})
        m_bucket["calls"] += 1
        m_bucket["cost"] += cost
        lat = int(r["lat_ms"] or 0)
        if lat > 0:
            latencies.append(lat)
        if r["session_id"]:
            sessions.add(r["session_id"])

    summary["unique_sessions"] = len(sessions)
    if latencies:
        latencies.sort()
        idx = int(len(latencies) * 0.95)
        summary["latency_p95_ms"] = latencies[min(idx, len(latencies) - 1)]
    return summary


def _format_summary_blocks(s: Dict[str, Any]) -> str:
    """Slack 메시지 본문."""
    if s["total_calls"] == 0:
        return f"📅 *{s['date']}* — 호출 0건 (트래픽 없음)"

    fail_rate = (s["total_fail"] / s["total_calls"] * 100) if s["total_calls"] else 0.0

    lines = [
        f"📅 *{s['date']} LLM 사용량 요약*",
        "",
        f"• 호출: *{s['total_calls']:,}* (성공 {s['total_success']:,} / 실패 {s['total_fail']:,} = {fail_rate:.1f}%)",
        f"• 비용: *${s['total_cost_usd']:.4f}* USD",
        f"• 토큰: in {s['total_input_tokens']:,} / out {s['total_output_tokens']:,}",
        f"• P95 latency: *{s['latency_p95_ms']:,}ms*",
        f"• Unique sessions: {s['unique_sessions']:,}",
    ]
    if s["by_endpoint"]:
        lines.append("")
        lines.append("*Endpoint*")
        for ep, b in sorted(s["by_endpoint"].items(), key=lambda x: -x[1]["calls"])[:5]:
            f_ratio = (b["fail"] / b["calls"] * 100) if b["calls"] else 0.0
            lines.append(f"  • {ep}: {b['calls']} (fail {f_ratio:.1f}%) ${b['cost']:.4f}")
    if s["by_model"]:
        lines.append("")
        lines.append("*Top Model*")
        for m, b in sorted(s["by_model"].items(), key=lambda x: -x[1]["calls"])[:3]:
            lines.append(f"  • {m}: {b['calls']} ${b['cost']:.4f}")
    if s["by_error_class"]:
        lines.append("")
        lines.append("*Error Class*")
        for ec, n in sorted(s["by_error_class"].items(), key=lambda x: -x[1]):
            lines.append(f"  • {ec}: {n}")
    return "\n".join(lines)


async def send_daily_cost_summary() -> bool:
    """매일 09:00 KST 호출. 어제 데이터 집계 + Slack DAILY_COST_SUMMARY 발송."""
    try:
        s = await _query_yesterday_summary()
        body = _format_summary_blocks(s)
        from ..core.config import settings
        from .slack_service import get_slack_service, AlertType
        if not (settings.slack_enabled and settings.slack_webhook_url):
            logger.info("[일일요약] slack 비활성 — 본문만 로그:\n%s", body)
            return False
        slack = get_slack_service(settings.slack_webhook_url, settings.slack_channel_id)
        await slack.send_error_alert(AlertType.DAILY_COST_SUMMARY, {
            "error_type": f"📅 LLM 일일요약 ({s['date']})",
            "location": "daily_summary_service",
            "error_message": body,
            "uuid": "system",
        })
        logger.info("[일일요약] Slack 발송 완료 — calls=%d cost=$%.4f", s["total_calls"], s["total_cost_usd"])
        return True
    except Exception as e:
        logger.error("[일일요약] 실행 실패: %s", e)
        return False
