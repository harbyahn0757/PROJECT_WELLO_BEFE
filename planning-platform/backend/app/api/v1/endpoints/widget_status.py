"""
Public widget-status endpoint (인증 불필요).

외부 임베드 사이트(파트너사)에서 위젯 init 시 fail-closed 판정용.
파트너사는 available + status 두 필드만 보면 된다 (모델/provider는 내부 정보).
"""
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Query

from ....services.llm_router import llm_router, LLMState

router = APIRouter()

# 파트너사용 단순 status enum
# - operational: 정상 운영
# - degraded:    동작은 하나 응답 속도 등이 평소 대비 저하 (사용자에게 안내 가능)
# - maintenance: 운영자 수동 점검 (의도된 비활성)
# - unavailable: 시스템 장애로 사용 불가
STATUS_OPERATIONAL = "operational"
STATUS_DEGRADED = "degraded"
STATUS_MAINTENANCE = "maintenance"
STATUS_UNAVAILABLE = "unavailable"

# 심각도 (높을수록 나쁨)
_SEVERITY = {
    STATUS_OPERATIONAL: 0,
    STATUS_DEGRADED: 1,
    STATUS_MAINTENANCE: 2,
    STATUS_UNAVAILABLE: 3,
}


def _to_partner_status(enabled: bool, reason: str) -> str:
    """파트너사용 단순 상태 매핑."""
    if not enabled:
        if reason == "manual_override":
            return STATUS_MAINTENANCE
        return STATUS_UNAVAILABLE
    if reason == "degraded_slow":
        return STATUS_DEGRADED
    return STATUS_OPERATIONAL


@router.get("/widget-status")
async def widget_status(widget: Optional[str] = Query(None, description="특정 위젯만 조회")):
    """
    위젯 가용성 + 상태 조회 (공개 엔드포인트, 인증 불필요).

    파트너사 응답 핵심 필드:
    - available: bool — 사용 가능 여부 (true이면 위젯 띄워도 됨)
    - status:    str  — operational | degraded | maintenance | unavailable
    - widgets.<name>.available / status — 위젯별 동일 형식

    내부 진단용 _meta 필드는 디버깅 보조 (파트너사가 신경 쓰지 않아도 됨).
    """
    state = llm_router.state
    overrides = llm_router.get_widget_overrides()

    provider_map = {
        LLMState.HEALTHY: "gemini",
        LLMState.DEGRADED: "openai",
        LLMState.DOWN: None,
    }

    def _rag_chat_raw() -> dict:
        ovr = overrides.get("rag_chat")
        if ovr == "disabled":
            return {"enabled": False, "reason": "manual_override"}
        if state == LLMState.DOWN:
            return {"enabled": False, "reason": "llm_unavailable"}
        if state == LLMState.DEGRADED:
            return {"enabled": True, "reason": "degraded_slow"}
        return {"enabled": True, "reason": "ok"}

    def _llm_independent_raw(name: str) -> dict:
        ovr = overrides.get(name)
        if ovr == "disabled":
            return {"enabled": False, "reason": "manual_override"}
        return {"enabled": True, "reason": "ok"}

    raw_widgets = {
        "rag_chat": _rag_chat_raw(),
        "survey": _llm_independent_raw("survey"),
        "character_intro": _llm_independent_raw("character_intro"),
    }

    # 파트너사용 단순 형식 + 호환을 위한 raw 필드 둘 다 노출
    widgets_full = {}
    for name, raw in raw_widgets.items():
        widgets_full[name] = {
            "available": raw["enabled"],
            "status": _to_partner_status(raw["enabled"], raw["reason"]),
            # ── 호환용 (기존 위젯 코드/내부 디버그) ─────
            "enabled": raw["enabled"],
            "reason": raw["reason"],
        }

    # 전체 가용성/상태 — 가장 나쁜 위젯 기준
    if widget and widget in widgets_full:
        scope = {widget: widgets_full[widget]}
    else:
        scope = widgets_full

    overall_available = all(w["available"] for w in scope.values())
    overall_status = max(
        (w["status"] for w in scope.values()),
        key=lambda s: _SEVERITY[s],
        default=STATUS_OPERATIONAL,
    )

    response = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        # ── 파트너사가 봐야 할 핵심 ────────────────────
        "available": overall_available,
        "status": overall_status,
        "widgets": scope,
        # ── 내부 진단 (파트너사는 무시 가능) ───────────
        "_meta": {
            "llm_state": state.value,
            "llm_provider": provider_map[state],
            "since": llm_router.state_entered_at_iso(),
        },
    }
    return response
