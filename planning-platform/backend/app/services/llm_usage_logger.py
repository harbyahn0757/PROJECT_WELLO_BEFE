"""
LLMUsageLogger — LLM API 호출 비용 추적 싱글턴

welno.llm_usage_log 테이블에 비동기 fire-and-forget INSERT.
에러 시 logger.warning만 기록, LLM 응답 차단 없음.
"""

import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)


class LLMUsageLogger:
    """LLM 사용량 로그 싱글턴. 비동기 fire-and-forget."""

    _instance: Optional["LLMUsageLogger"] = None

    def __new__(cls) -> "LLMUsageLogger":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def log(
        self,
        model: str,
        endpoint: str,
        session_id: Optional[str] = None,
        partner_id: Optional[str] = None,
        hospital_id: Optional[str] = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cached_tokens: int = 0,
        latency_ms: Optional[int] = None,
        success: bool = True,
        error_class: Optional[str] = None,
    ) -> None:
        """비동기 fire-and-forget INSERT. 에러 시 warning만."""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(
                    self._insert(
                        model=model,
                        endpoint=endpoint,
                        session_id=session_id,
                        partner_id=partner_id,
                        hospital_id=hospital_id,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        cached_tokens=cached_tokens,
                        latency_ms=latency_ms,
                        success=success,
                        error_class=error_class,
                    )
                )
        except RuntimeError:
            pass  # no event loop — 무시 (startup 전 호출 등)

    async def _insert(
        self,
        model: str,
        endpoint: str,
        session_id: Optional[str],
        partner_id: Optional[str],
        hospital_id: Optional[str],
        input_tokens: int,
        output_tokens: int,
        cached_tokens: int,
        latency_ms: Optional[int],
        success: bool,
        error_class: Optional[str],
    ) -> None:
        try:
            from ..core.database import get_db_pool
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO welno.llm_usage_log
                      (model, endpoint, session_id, partner_id, hospital_id,
                       input_tokens, output_tokens, cached_tokens,
                       latency_ms, success, error_class)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                    """,
                    model, endpoint, session_id, partner_id, hospital_id,
                    input_tokens, output_tokens, cached_tokens,
                    latency_ms, success, error_class,
                )
        except Exception as exc:
            logger.warning("[LLMUsageLogger] INSERT 실패 (무시): %s", exc)


# 모듈 레벨 싱글턴
llm_usage_logger = LLMUsageLogger()
