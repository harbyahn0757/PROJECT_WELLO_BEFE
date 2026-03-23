"""
검진설계 자동 트리거 서비스

검진 데이터 저장 완료 시 비동기로 Step1(Persona 분석)을 자동 실행.
campaign_payment.py의 trigger_report_generation() 패턴 참조.
"""

import logging
import asyncio
import json
from typing import Optional, Dict, Any

import asyncpg

from ..core.config import settings

logger = logging.getLogger(__name__)

DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!",
}


async def trigger_auto_checkup_design(
    patient_uuid: str,
    hospital_id: str,
    partner_id: str = "welno",
) -> None:
    """검진 데이터 저장 후 자동으로 Step1 분석을 실행하는 백그라운드 태스크.

    조건:
    1. 파트너 설정에서 auto_planning.enabled = true
    2. 해당 환자에 기존 완료된 설계(step2_completed)가 없음
    3. 건강 데이터가 충분함 (최소 1건)

    campaign_payment.py:trigger_report_generation() 패턴:
    - asyncio.create_task()로 호출
    - 실패해도 메인 흐름에 영향 없음
    - 결과를 DB에 기록
    """
    log_id = None
    try:
        # 트리거 로그 시작
        log_id = await _create_trigger_log(patient_uuid, partner_id, "pending")

        # 1. 파트너 설정 체크
        if not await _is_auto_planning_enabled(partner_id):
            logger.info(f"[auto_trigger] 파트너 {partner_id} 자동 플래닝 비활성화")
            await _update_trigger_log(log_id, "skipped", {"reason": "auto_planning disabled"})
            return

        # 2. 기존 설계 중복 체크
        if await _has_existing_design(patient_uuid, hospital_id):
            logger.info(f"[auto_trigger] {patient_uuid} 이미 설계 완료, 스킵")
            await _update_trigger_log(log_id, "skipped", {"reason": "design already exists"})
            return

        # 3. 건강 데이터 조회
        health_data = await _get_health_data(patient_uuid, hospital_id)
        if not health_data:
            logger.info(f"[auto_trigger] {patient_uuid} 건강 데이터 없음, 스킵")
            await _update_trigger_log(log_id, "skipped", {"reason": "no health data"})
            return

        # 4. 자동 관심항목 추출
        from .checkup_design.auto_concerns import auto_extract_concerns

        concerns = auto_extract_concerns(health_data)
        if not concerns:
            logger.info(f"[auto_trigger] {patient_uuid} 추출된 관심항목 없음, 스킵")
            await _update_trigger_log(log_id, "skipped", {"reason": "no concerns extracted"})
            return

        # 5. Step1 실행
        step1_result = await _run_step1(patient_uuid, hospital_id, concerns, health_data)

        # 6. 결과 저장
        await _save_auto_design(
            patient_uuid, hospital_id, partner_id,
            concerns, step1_result,
        )

        await _update_trigger_log(log_id, "success", {
            "concerns_count": len(concerns),
            "step1_completed": True,
        })
        logger.info(
            f"[auto_trigger] {patient_uuid} 자동 Step1 완료 — "
            f"concerns: {len(concerns)}개"
        )

    except Exception as e:
        logger.error(f"[auto_trigger] {patient_uuid} 실패: {e}")
        if log_id:
            await _update_trigger_log(log_id, "failed", None, str(e))


# ── 내부 헬퍼 ──────────────────────────────────────────────


async def _is_auto_planning_enabled(partner_id: str) -> bool:
    """파트너 설정에서 checkup_design.auto_planning.enabled 확인."""
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        row = await conn.fetchrow(
            "SELECT config FROM welno.tb_partner_config WHERE partner_id = $1",
            partner_id,
        )
        if not row:
            # 설정 없으면 기본 비활성화
            return False
        config = row["config"]
        if isinstance(config, str):
            config = json.loads(config)
        return (
            config.get("checkup_design", {})
            .get("auto_planning", {})
            .get("enabled", False)
        )
    except Exception as e:
        logger.error(f"[auto_trigger] 파트너 설정 조회 실패: {e}")
        return False
    finally:
        if conn:
            await conn.close()


async def _has_existing_design(patient_uuid: str, hospital_id: str) -> bool:
    """해당 환자에 완료된 검진설계가 있는지 확인."""
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        row = await conn.fetchrow(
            """SELECT id FROM welno.welno_checkup_design_requests
               WHERE uuid = $1 AND hospital_id = $2 AND status = 'step2_completed'
               LIMIT 1""",
            patient_uuid, hospital_id,
        )
        return row is not None
    except Exception as e:
        logger.error(f"[auto_trigger] 기존 설계 조회 실패: {e}")
        return True  # 안전하게 스킵
    finally:
        if conn:
            await conn.close()


async def _get_health_data(
    patient_uuid: str, hospital_id: str
) -> list:
    """welno_checkup_data에서 건강 데이터 조회."""
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        rows = await conn.fetch(
            """SELECT raw_data, year, checkup_date, location
               FROM welno.welno_checkup_data
               WHERE patient_uuid = $1 AND hospital_id = $2
               ORDER BY checkup_date DESC""",
            patient_uuid, hospital_id,
        )
        result = []
        for row in rows:
            raw = row["raw_data"]
            if isinstance(raw, str):
                try:
                    raw = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    continue
            result.append({
                "raw_data": raw,
                "year": row["year"],
                "checkup_date": row["checkup_date"],
                "location": row["location"],
            })
        return result
    except Exception as e:
        logger.error(f"[auto_trigger] 건강 데이터 조회 실패: {e}")
        return []
    finally:
        if conn:
            await conn.close()


async def _run_step1(
    patient_uuid: str,
    hospital_id: str,
    concerns: list,
    health_data: list,
) -> Optional[Dict[str, Any]]:
    """Step1 분석 실행 (Gemini 호출)."""
    from .gemini_service import gemini_service, GeminiRequest
    from .checkup_design import (
        create_checkup_design_prompt_step1,
        CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP1,
    )
    from .welno_data_service import WelnoDataService

    svc = WelnoDataService()

    # 환자 정보
    patient = await svc.get_patient_by_uuid(patient_uuid)
    patient_name = patient.get("name", "환자") if patient else "환자"
    patient_age = patient.get("age") if patient else None
    patient_gender = patient.get("gender", "M") if patient else "M"

    # 프롬프트 생성
    prompt_result = create_checkup_design_prompt_step1(
        patient_name=patient_name,
        patient_age=patient_age,
        patient_gender=patient_gender,
        health_data=health_data,
        prescription_data=[],
        selected_concerns=concerns,
    )
    prompt = prompt_result.get("prompt", "")

    # Gemini 호출
    response = await gemini_service.call_api(GeminiRequest(
        prompt=prompt,
        model=settings.google_gemini_fast_model,
        temperature=0.7,
        max_tokens=4000,
        system_instruction=CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP1,
    ))

    if not response.success or not response.content:
        logger.error(f"[auto_trigger] Step1 Gemini 호출 실패: {response.error}")
        return None

    # JSON 파싱
    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        return json.loads(content.strip())
    except (json.JSONDecodeError, IndexError) as e:
        logger.error(f"[auto_trigger] Step1 JSON 파싱 실패: {e}")
        return {"raw_content": response.content}


async def _save_auto_design(
    patient_uuid: str,
    hospital_id: str,
    partner_id: str,
    concerns: list,
    step1_result: Optional[Dict],
) -> None:
    """자동 설계 결과를 DB에 저장."""
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)

        # patient_id 조회
        patient_row = await conn.fetchrow(
            "SELECT id FROM welno.welno_patients WHERE uuid = $1",
            patient_uuid,
        )
        patient_id = patient_row["id"] if patient_row else None

        await conn.execute(
            """INSERT INTO welno.welno_checkup_design_requests
               (patient_id, uuid, hospital_id, partner_id,
                selected_concerns, auto_concerns, step1_result,
                status, trigger_source, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7,
                       'step1_completed', 'auto_data', NOW(), NOW())""",
            patient_id, patient_uuid, hospital_id, partner_id,
            json.dumps(concerns, ensure_ascii=False),
            json.dumps(concerns, ensure_ascii=False),
            json.dumps(step1_result, ensure_ascii=False) if step1_result else None,
        )
    except Exception as e:
        logger.error(f"[auto_trigger] 자동 설계 저장 실패: {e}")
    finally:
        if conn:
            await conn.close()


async def _create_trigger_log(
    patient_uuid: str, partner_id: str, status: str
) -> Optional[int]:
    """트리거 로그 생성, id 반환."""
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        row = await conn.fetchrow(
            """INSERT INTO welno.welno_trigger_log
               (patient_uuid, partner_id, trigger_type, trigger_source, status)
               VALUES ($1, $2, 'checkup_design', 'auto_data', $3)
               RETURNING id""",
            patient_uuid, partner_id, status,
        )
        return row["id"] if row else None
    except Exception as e:
        logger.error(f"[auto_trigger] 로그 생성 실패: {e}")
        return None
    finally:
        if conn:
            await conn.close()


async def _update_trigger_log(
    log_id: Optional[int],
    status: str,
    result: Optional[Dict] = None,
    error_message: Optional[str] = None,
) -> None:
    """트리거 로그 상태 업데이트."""
    if log_id is None:
        return
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        await conn.execute(
            """UPDATE welno.welno_trigger_log
               SET status = $1, result = $2, error_message = $3
               WHERE id = $4""",
            status,
            json.dumps(result, ensure_ascii=False) if result else None,
            error_message,
            log_id,
        )
    except Exception as e:
        logger.error(f"[auto_trigger] 로그 업데이트 실패: {e}")
    finally:
        if conn:
            await conn.close()
