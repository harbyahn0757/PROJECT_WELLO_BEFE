"""
LLMUsageLogger — LLM API 호출 비용 추적 싱글턴

welno.llm_usage_log 테이블에 비동기 fire-and-forget INSERT.
DB 접근은 기존 db_manager (psycopg2 동기) 재사용. INSERT 실패는 logger.warning만,
LLM 응답 차단 없음.
"""

import asyncio
import logging
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
        ttft_ms: Optional[int] = None,
    ) -> None:
        """비동기 fire-and-forget INSERT. 에러 시 warning만.
        P2-2: ttft_ms 컬럼 — 스트리밍 첫 chunk 도달 latency (P95 < 500ms SLO).
        """
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return  # no running loop — startup 전 호출 등은 무시

        loop.create_task(
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
                ttft_ms=ttft_ms,
            )
        )

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
        ttft_ms: Optional[int] = None,
    ) -> None:
        try:
            from ..core.database import db_manager
            await db_manager.execute_update(
                """
                INSERT INTO welno.llm_usage_log
                  (model, endpoint, session_id, partner_id, hospital_id,
                   input_tokens, output_tokens, cached_tokens,
                   latency_ms, success, error_class, ttft_ms)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    model, endpoint, session_id, partner_id, hospital_id,
                    input_tokens, output_tokens, cached_tokens,
                    latency_ms, success, error_class, ttft_ms,
                ),
            )
        except Exception as exc:
            logger.warning("[LLMUsageLogger] INSERT 실패 (무시): %s", exc)


# 모듈 레벨 싱글턴
llm_usage_logger = LLMUsageLogger()
