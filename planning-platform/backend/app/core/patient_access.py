"""
환자 데이터 접근 검증 — Phase 1 Soft Lock
lookup_key 페어 OR Tilko 세션 OR JWT 폴백

Phase 1 (현재): 검증 실패해도 WARN 로그만 + 200 응답 유지 (응답 동작 변경 0)
Phase 2 (차후): PATIENT_ACCESS_SOFT_LOCK=false 로 변경 시 401 raise

[P0_SOFT_LOCK] 로그 prefix — ES 로그 grep 용
"""

import logging
import os
from typing import Optional

from fastapi import Query, Header, Request

from .database import db_manager
from .security import verify_token
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Phase 1 Soft Lock 모드: True = WARN + 통과, False = 401 raise
# 환경변수로 Override 가능 (Phase 2 전환 시 config.env 에서 변경)
_SOFT_LOCK_ENV = os.environ.get("PATIENT_ACCESS_SOFT_LOCK", "true").lower()
SOFT_LOCK_MODE: bool = _SOFT_LOCK_ENV not in ("false", "0", "no")


async def soft_verify_patient_access(
    request: Request,
    patient_uuid: Optional[str] = None,
    lookup_key: Optional[str] = Query(None, description="알림톡 lookup_key"),
    tilko_session_id: Optional[str] = Header(None, alias="X-Tilko-Session-Id"),
    authorization: Optional[str] = Header(None),
) -> str:
    """
    Phase 1 Soft Lock — 환자 UUID 접근 권한 검증.

    검증 순서 (OR 조건, 1개라도 통과 시 즉시 return):
      1. lookup_key 페어 검증 — welno.welno_link_data.(lookup_key, wello_uuid) 일치 + 미만료
      2. Tilko 세션 검증 — Redis session.user_info.patient_uuid 일치
      3. WELNO JWT 검증 — JWT payload.sub == patient_uuid

    모두 실패:
      - SOFT_LOCK_MODE=True  → [P0_SOFT_LOCK] WARN 로그 + 통과 (200 유지)
      - SOFT_LOCK_MODE=False → 401 raise

    Args:
        request: FastAPI Request (path 로깅용)
        patient_uuid: 라우트 path param (라우트마다 다름 — 호출 시 주입)
        lookup_key: Query param ?lookup_key=
        tilko_session_id: X-Tilko-Session-Id 헤더
        authorization: Authorization 헤더 (Bearer JWT)

    Returns:
        str: 검증 통과된 patient_uuid
    """
    # patient_uuid 가 None 이면 path param 에서 추출 시도
    uuid_to_check = patient_uuid
    if not uuid_to_check:
        uuid_to_check = request.path_params.get("patient_uuid") or request.path_params.get("uuid", "")

    verified = False
    reason = "no_credential"

    # === 1. lookup_key 페어 검증 ===
    if lookup_key:
        reason = "lookup_key_mismatch"
        try:
            rows = await db_manager.execute_query(
                """SELECT 1 FROM welno.welno_link_data
                   WHERE lookup_key = %s
                     AND wello_uuid = %s
                     AND (expires_at IS NULL OR expires_at > NOW())
                   LIMIT 1""",
                (lookup_key, uuid_to_check),
            )
            if rows:
                verified = True
        except Exception as e:
            logger.warning(f"[P0_SOFT_LOCK] lookup_key DB 조회 오류: {e}")

    # === 2. Tilko 세션 검증 ===
    if not verified and tilko_session_id:
        reason = "tilko_session_mismatch"
        try:
            from ..data.redis_session_manager import redis_session_manager as session_manager
            session_data = session_manager.get_session(tilko_session_id)
            if session_data:
                user_info = session_data.get("user_info", {}) or {}
                session_patient_uuid = (
                    user_info.get("patient_uuid")
                    or session_data.get("patient_uuid")
                )
                if session_patient_uuid and str(session_patient_uuid) == str(uuid_to_check):
                    verified = True
        except Exception as e:
            logger.warning(f"[P0_SOFT_LOCK] Tilko 세션 검증 오류: {e}")

    # === 3. WELNO JWT 검증 ===
    if not verified and authorization and authorization.startswith("Bearer "):
        reason = "jwt_mismatch"
        try:
            token = authorization[7:]
            payload = verify_token(token)
            jwt_sub = payload.get("sub")
            if jwt_sub and str(jwt_sub) == str(uuid_to_check):
                verified = True
        except HTTPException:
            pass  # JWT 오류도 soft lock 로직으로 처리
        except Exception as e:
            logger.warning(f"[P0_SOFT_LOCK] JWT 검증 오류: {e}")

    # === 검증 결과 처리 ===
    if not verified:
        logger.warning(
            f"[P0_SOFT_LOCK] patient_access verification failed | "
            f"uuid={uuid_to_check} | reason={reason} | "
            f"lookup_key={bool(lookup_key)} | tilko={bool(tilko_session_id)} | "
            f"jwt={bool(authorization)} | path={request.url.path}"
        )
        if not SOFT_LOCK_MODE:
            # Phase 2: Hard Lock — 이 코드 경로는 현재 미사용
            raise HTTPException(
                status_code=401,
                detail=(
                    "환자 데이터 접근 권한이 없습니다. "
                    "lookup_key, X-Tilko-Session-Id, 또는 Bearer 토큰 중 하나가 필요합니다."
                ),
            )
        # Phase 1: Soft Lock — WARN 로그만, 통과
    return uuid_to_check or ""
