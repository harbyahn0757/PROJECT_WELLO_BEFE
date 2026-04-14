"""
operations.py — 리포트 엔진 기반 복합 연산.

partner_office.py 엔드포인트에서 직접 호출:
    build_engine_stats()            — sync, EngineStats dict
    compare_single(uuid, db, engine) — async, ComparisonData dict
    verify_batch(limit, hosp, force, db, engine) — async, VerificationData dict

금지:
    - services/mediarc/ import 없음
    - welno_mediarc_reports SELECT 이외 DML 없음
    - engine.py 수정 없음
"""

import json
import logging
from pathlib import Path
from typing import Any, Optional

from .facade import ENGINE_AVAILABLE, MODEL_LOADED, EngineFacade

logger = logging.getLogger(__name__)

_BASE = Path(__file__).parent


# ──────────────────────────────────────────────────────────────────────────────
# build_engine_stats (sync)
# ──────────────────────────────────────────────────────────────────────────────

def build_engine_stats() -> dict:
    """rr_ci_table.json + RR_MATRIX → FE EngineStats 스키마.

    Returns:
        { total_rr, pmid_coverage, confidence, diseases, validation }
    엔진 미로드 시 error 키 포함 dict 반환 (예외 없음).
    """
    engine = EngineFacade()
    return engine.compute_stats()


# ──────────────────────────────────────────────────────────────────────────────
# compare_single (async)
# ──────────────────────────────────────────────────────────────────────────────

async def compare_single(
    uuid: str,
    db_manager: Any,
    engine: EngineFacade,
) -> dict:
    """Twobecon 저장 결과 vs 엔진 실시간 계산 비교.

    welno_mediarc_reports에서 환자의 최신 분석 결과를 SELECT(읽기만)한 뒤
    engine.run()으로 실시간 재계산하여 질환별 rate를 비교한다.

    Args:
        uuid:       patient_uuid (welno.welno_mediarc_reports 기준)
        db_manager: app state의 db_manager (execute_query 또는 fetch_one 지원)
        engine:     EngineFacade 싱글톤

    Returns:
        FE ComparisonData 스키마:
        {
            patient: { uuid, name, age, sex },
            twobecon: { bodyage, rank },
            mediarc:  { bodyage, rank },
            match_rate: float,
            comparison: [{ disease, twobecon_rate, mediarc_rate, diff }]
        }
    엔진 미로드 / 레코드 없으면 error 키 포함 dict 반환.
    """
    if not ENGINE_AVAILABLE:
        return {"error": "engine not available", "uuid": uuid}

    # welno_mediarc_reports — SELECT만 (INSERT/UPDATE/DELETE 금지)
    sql = """
        SELECT patient_uuid, patient_name, patient_age, patient_sex,
               bodyage, rank, disease_data, cancer_data,
               health_data, analyzed_at
        FROM welno.welno_mediarc_reports
        WHERE patient_uuid = %s
        ORDER BY analyzed_at DESC
        LIMIT 1
    """
    try:
        row = await db_manager.execute_one(sql, (uuid,))
    except Exception as e:
        logger.warning("compare_single: DB 조회 실패 uuid=%s — %s", uuid, e)
        return {"error": f"DB 조회 실패: {e}", "uuid": uuid}

    if row is None:
        return {"error": "레코드 없음", "uuid": uuid}

    # Twobecon 결과 재구성
    twobecon_bodyage = row.get("bodyage")
    twobecon_rank = row.get("rank")

    disease_raw: dict = {}
    for key in ("disease_data", "cancer_data"):
        val = row.get(key)
        if val:
            try:
                chunk = json.loads(val) if isinstance(val, str) else val
                disease_raw.update(chunk)
            except Exception:
                pass

    # 실시간 엔진 계산
    health_raw: dict = {}
    health_val = row.get("health_data")
    if health_val:
        try:
            health_raw = json.loads(health_val) if isinstance(health_val, str) else health_val
        except Exception:
            pass

    age = row.get("patient_age") or health_raw.get("age", 0)
    sex = row.get("patient_sex") or health_raw.get("sex", "M")
    name = row.get("patient_name") or "익명"

    patient_dict = {k: v for k, v in health_raw.items() if k not in ("age", "sex", "_name")}
    patient_dict["age"] = age
    patient_dict["sex"] = sex

    try:
        mediarc_result = engine.run(name=name, patient=patient_dict)
    except Exception as e:
        logger.warning("compare_single: engine.run 실패 uuid=%s — %s", uuid, e)
        mediarc_result = {}

    mediarc_bodyage = (mediarc_result.get("bodyage") or {}).get("bodyage")
    mediarc_rank = mediarc_result.get("rank")

    # 질환별 비교
    mediarc_diseases: dict = mediarc_result.get("diseases") or {}
    comparison = []
    all_diseases = set(disease_raw.keys()) | set(mediarc_diseases.keys())
    for disease in sorted(all_diseases):
        tb_rate = None
        if disease in disease_raw:
            d = disease_raw[disease]
            tb_rate = d.get("ratio") or d.get("rate")
        me_rate = None
        if disease in mediarc_diseases:
            d2 = mediarc_diseases[disease]
            me_rate = d2.get("rate") or d2.get("ratio")
        diff = None
        if tb_rate is not None and me_rate is not None:
            try:
                diff = round(float(me_rate) - float(tb_rate), 4)
            except (TypeError, ValueError):
                pass
        comparison.append({
            "disease": disease,
            "twobecon_rate": tb_rate,
            "mediarc_rate": me_rate,
            "diff": diff,
        })

    # match_rate: diff < 0.05 이내 비율
    matched = sum(
        1 for c in comparison
        if c["diff"] is not None and abs(c["diff"]) < 0.05
    )
    total_comparable = sum(
        1 for c in comparison if c["diff"] is not None
    )
    match_rate = round(matched / total_comparable, 4) if total_comparable > 0 else 0.0

    return {
        "patient": {"uuid": uuid, "name": name, "age": age, "sex": sex},
        "twobecon": {"bodyage": twobecon_bodyage, "rank": twobecon_rank},
        "mediarc": {"bodyage": mediarc_bodyage, "rank": mediarc_rank},
        "match_rate": match_rate,
        "comparison": comparison,
    }


# ──────────────────────────────────────────────────────────────────────────────
# verify_batch (async)
# ──────────────────────────────────────────────────────────────────────────────

async def verify_batch(
    limit: int,
    hospital_id: Optional[str],
    force: bool,
    db_manager: Any,
    engine: EngineFacade,
) -> dict:
    """전수 검증 배치 — welno_mediarc_reports 전체 대상.

    force=False 이고 이미 최근 24시간 이내 검증 결과가 있으면
    캐시된 결과를 재사용 (초기 구현: 항상 실행).

    Returns:
        FE VerificationData 스키마:
        {
            total_patients: int,
            processed: int,
            match_rate: float,
            disease_summary: { disease: { avg_diff, count } },
            anomalies: [{ uuid, disease, diff }],
            top_match: { uuid, match_rate },
            worst_match: { uuid, match_rate },
        }
    """
    if not ENGINE_AVAILABLE:
        return {"error": "engine not available"}

    # 최근 N건 UUID 목록
    sql_uuids = """
        SELECT DISTINCT ON (patient_uuid) patient_uuid
        FROM welno.welno_mediarc_reports
        ORDER BY patient_uuid, analyzed_at DESC
        LIMIT %s
    """
    if hospital_id:
        sql_uuids = """
            SELECT DISTINCT ON (r.patient_uuid) r.patient_uuid
            FROM welno.welno_mediarc_reports r
            JOIN welno.patients p ON p.uuid = r.patient_uuid
            WHERE p.hospital_id = %s
            ORDER BY r.patient_uuid, r.analyzed_at DESC
            LIMIT %s
        """

    try:
        if hospital_id:
            rows = await db_manager.execute_query(sql_uuids, (hospital_id, limit))
        else:
            rows = await db_manager.execute_query(sql_uuids, (limit,))
    except Exception as e:
        logger.warning("verify_batch: UUID 목록 조회 실패 — %s", e)
        return {"error": f"UUID 목록 조회 실패: {e}"}

    uuids = [r["patient_uuid"] for r in (rows or [])]
    results = []
    for uid in uuids:
        try:
            r = await compare_single(uid, db_manager, engine)
            if "error" not in r:
                results.append(r)
        except Exception as e:
            logger.warning("verify_batch: compare_single 실패 uuid=%s — %s", uid, e)

    if not results:
        return {
            "total_patients": len(uuids),
            "processed": 0,
            "match_rate": 0.0,
            "disease_summary": {},
            "anomalies": [],
            "top_match": None,
            "worst_match": None,
        }

    # 집계
    overall_match = round(
        sum(r["match_rate"] for r in results) / len(results), 4
    )

    disease_acc: dict = {}
    anomalies = []
    for r in results:
        for c in r.get("comparison", []):
            if c["diff"] is None:
                continue
            d = c["disease"]
            if d not in disease_acc:
                disease_acc[d] = {"total_diff": 0.0, "count": 0}
            disease_acc[d]["total_diff"] += abs(c["diff"])
            disease_acc[d]["count"] += 1
            if abs(c["diff"]) >= 0.1:
                anomalies.append({
                    "uuid": r["patient"]["uuid"],
                    "disease": d,
                    "diff": c["diff"],
                })

    disease_summary = {
        d: {
            "avg_diff": round(v["total_diff"] / v["count"], 4),
            "count": v["count"],
        }
        for d, v in disease_acc.items()
    }

    sorted_results = sorted(results, key=lambda x: x["match_rate"])
    worst = sorted_results[0] if sorted_results else None
    top = sorted_results[-1] if sorted_results else None

    return {
        "total_patients": len(uuids),
        "processed": len(results),
        "match_rate": overall_match,
        "disease_summary": disease_summary,
        "anomalies": anomalies[:50],  # 최대 50건
        "top_match": {"uuid": top["patient"]["uuid"], "match_rate": top["match_rate"]} if top else None,
        "worst_match": {"uuid": worst["patient"]["uuid"], "match_rate": worst["match_rate"]} if worst else None,
    }
