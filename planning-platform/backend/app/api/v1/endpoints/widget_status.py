"""
Public widget-status endpoint (인증 불필요).

외부 임베드 사이트(파트너사)에서 위젯 init 시 fail-closed 판정용.
LLM 상태(HEALTHY/DEGRADED/DOWN)와 위젯별 노출 여부를 반환.
"""
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Query

from ....services.llm_router import llm_router, LLMState

router = APIRouter()


@router.get("/widget-status")
async def widget_status(widget: Optional[str] = Query(None, description="특정 위젯만 조회")):
    """
    LLM 상태 및 위젯 활성화 여부 반환.

    - llm.state: HEALTHY | DEGRADED | DOWN
    - llm.provider: gemini | openai | null
    - widgets.rag_chat.enabled: DOWN이면 false (fail-closed)
    - widgets.survey / character_intro: LLM 독립 위젯 (DOWN이어도 true)
    """
    state = llm_router.state
    overrides = llm_router.get_widget_overrides()

    provider_map = {
        LLMState.HEALTHY: "gemini",
        LLMState.DEGRADED: "openai",
        LLMState.DOWN: None,
    }

    def _rag_chat_status() -> dict:
        ovr = overrides.get("rag_chat")
        if ovr == "disabled":
            return {"enabled": False, "reason": "manual_override"}
        if state == LLMState.DOWN:
            return {"enabled": False, "reason": "llm_unavailable"}
        if state == LLMState.DEGRADED:
            return {"enabled": True, "reason": "degraded_slow"}
        return {"enabled": True, "reason": "ok"}

    def _llm_independent(name: str) -> dict:
        ovr = overrides.get(name)
        if ovr == "disabled":
            return {"enabled": False, "reason": "manual_override"}
        return {"enabled": True, "reason": "ok"}

    widgets_all = {
        "rag_chat": _rag_chat_status(),
        "survey": _llm_independent("survey"),
        "character_intro": _llm_independent("character_intro"),
    }

    response = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "llm": {
            "state": state.value,
            "provider": provider_map[state],
            "since": llm_router.state_entered_at_iso(),
        },
        "widgets": (
            {widget: widgets_all[widget]}
            if widget and widget in widgets_all
            else widgets_all
        ),
    }
    return response
