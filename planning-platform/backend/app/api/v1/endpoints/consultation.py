"""
상담 관리 API — 검진설계 완료 후 상담 요청/목록/상세/상태 변경
partner_office.py의 consultation-request, consultation-status를 분리·확장
"""

import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Path
from pydantic import BaseModel

from ....core.database import db_manager


def _parse_json(val):
    """JSONB 값 파싱 헬퍼 (이미 파싱된 경우/문자열/None 처리)"""
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return val
    return val


def _determine_item_status(value_str: str, item_refs: list) -> str:
    """
    ItemReferences 기반 판정. 정상/경계/질환의심/이상 반환.
    Tilko raw_data의 Items[].ItemReferences[] 구조 활용.
    """
    if not item_refs:
        return "판정없음"

    try:
        value = float(value_str)
    except (ValueError, TypeError):
        # 비수치(음성/양성 등)는 문자 비교
        lower = (value_str or "").strip()
        if lower in ("음성", "정상", "negative", "normal"):
            return "정상"
        if lower in ("양성", "positive"):
            return "이상"
        return "판정없음"

    # 질환의심 범위 확인
    abnormal = next(
        (r for r in item_refs if r.get("Name") == "질환의심"), None
    )
    if abnormal:
        rng = abnormal.get("Value", "")
        if _in_ref_range(value, rng):
            return "질환의심"

    # 정상 범위 확인
    normal = next(
        (r for r in item_refs
         if r.get("Name") in ("정상", "정상(A)", "정상(B)")),
        None,
    )
    if normal:
        rng = normal.get("Value", "")
        if _in_ref_range(value, rng):
            return "정상"

    # 경계 범위 확인
    border = next(
        (r for r in item_refs
         if r.get("Name") in ("정상(B)", "정상(경계)")),
        None,
    )
    if border:
        rng = border.get("Value", "")
        if _in_ref_range(value, rng):
            return "경계"

    return "이상"


def _in_ref_range(value: float, range_str: str) -> bool:
    """참조 범위 문자열(예: '0~99', '100이상')에 값이 포함되는지 확인."""
    if not range_str:
        return False
    range_str = range_str.strip()

    # "N이상" 패턴
    if "이상" in range_str:
        try:
            threshold = float(range_str.replace("이상", "").strip())
            return value >= threshold
        except (ValueError, TypeError):
            return False

    # "N이하" 패턴
    if "이하" in range_str:
        try:
            threshold = float(range_str.replace("이하", "").strip())
            return value <= threshold
        except (ValueError, TypeError):
            return False

    # "N~M" 패턴
    for sep in ("~", "-", "∼"):
        if sep in range_str:
            parts = range_str.split(sep)
            if len(parts) == 2:
                try:
                    lo = float(parts[0].strip()) if parts[0].strip() else -999999
                    hi = float(parts[1].strip()) if parts[1].strip() else 999999
                    return lo <= value <= hi
                except (ValueError, TypeError):
                    pass

    return False


def _parse_inspections(raw_data) -> list:
    """
    Tilko raw_data.Inspections 구조를 파싱하여 프론트에서
    바로 사용 가능한 구조화된 검사 항목 리스트 반환.

    반환 형식:
    [
      {
        "name": "계측검사",
        "items": [
          {"name": "신장", "value": "181.3", "unit": "Cm", "status": "정상"},
          ...
        ]
      },
      ...
    ]
    """
    if not isinstance(raw_data, dict):
        return []

    inspections = raw_data.get("Inspections", [])
    if not isinstance(inspections, list):
        return []

    result = []
    for inspection in inspections:
        if not isinstance(inspection, dict):
            continue
        section_name = inspection.get("Gubun", "기타검사")
        section_items = []

        for illness in (inspection.get("Illnesses") or []):
            if not isinstance(illness, dict):
                continue
            for item in (illness.get("Items") or []):
                if not isinstance(item, dict):
                    continue
                name = item.get("Name", "")
                value = item.get("Value", "")
                unit = item.get("Unit", "")
                refs = item.get("ItemReferences", [])

                if not name:
                    continue

                status = _determine_item_status(value, refs)
                section_items.append({
                    "name": name,
                    "value": value,
                    "unit": unit,
                    "status": status,
                })

        if section_items:
            result.append({
                "name": section_name,
                "items": section_items,
            })

    return result


def _extract_step1_highlights(step1: dict) -> Optional[dict]:
    """step1_result에서 상담에 필요한 핵심 필드만 추출."""
    if not isinstance(step1, dict):
        return None
    return {
        "persona": step1.get("persona"),
        "risk_profile": step1.get("risk_profile"),
        "chronic_analysis": step1.get("chronic_analysis"),
        "concern_vs_reality": step1.get("concern_vs_reality"),
        "patient_summary": step1.get("patient_summary"),
        "analysis": step1.get("analysis"),
        "survey_reflection": step1.get("survey_reflection"),
        "selected_concerns_analysis": step1.get(
            "selected_concerns_analysis"
        ),
    }


def _extract_step2_highlights(step2: dict) -> Optional[dict]:
    """step2_result에서 상담에 필요한 핵심 필드만 추출."""
    if not isinstance(step2, dict):
        return None
    return {
        "strategies": step2.get("strategies"),
        "doctor_comment": step2.get("doctor_comment"),
        "summary": step2.get("summary"),
        "priority_1": step2.get("priority_1"),
        "priority_2": step2.get("priority_2"),
        "priority_3": step2.get("priority_3"),
        "recommended_items": step2.get("recommended_items"),
        "total_count": step2.get("total_count"),
    }

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/consultation", tags=["consultation"])


# ─── Models ───────────────────────────────────────────────────

class ConsultationRequestBody(BaseModel):
    uuid: str
    hospital_id: str
    partner_id: Optional[str] = None
    consultation_type: str = "checkup"  # 'checkup' | 'revisit'


class ConsultationStatusBody(BaseModel):
    uuid: str
    hospital_id: str
    status: str  # 'pending' | 'contacted' | 'completed'


# ─── 1. POST /consultation/request ───────────────────────────

@router.post("/request")
async def consultation_request(req: ConsultationRequestBody):
    """수검자가 상담 요청 (ResultPage에서 호출)"""
    try:
        if req.consultation_type not in ("checkup", "revisit"):
            raise HTTPException(
                status_code=400,
                detail="consultation_type은 'checkup' 또는 'revisit'",
            )

        # uuid + hospital_id로 기존 세션 찾기
        existing = await db_manager.execute_one(
            """SELECT t.session_id
               FROM welno.tb_chat_session_tags t
               JOIN welno.tb_partner_rag_chat_log c
                 ON c.session_id = t.session_id
               WHERE c.user_uuid = %s AND c.hospital_id = %s
               ORDER BY c.created_at DESC LIMIT 1""",
            (req.uuid, req.hospital_id),
        )

        if existing:
            # 기존 세션에 상담 상태 업데이트
            await db_manager.execute_update(
                """UPDATE welno.tb_chat_session_tags
                   SET consultation_requested = true,
                       consultation_type = %s,
                       consultation_status = 'pending',
                       consultation_consent_at = NOW()
                   WHERE session_id = %s""",
                (req.consultation_type, existing["session_id"]),
            )
            session_id = existing["session_id"]
        else:
            # 세션 없으면 신규 태그 레코드 생성
            import uuid as uuid_mod

            session_id = str(uuid_mod.uuid4())
            await db_manager.execute_update(
                """INSERT INTO welno.tb_chat_session_tags
                       (session_id, consultation_requested,
                        consultation_type, consultation_status,
                        consultation_consent_at)
                   VALUES (%s, true, %s, 'pending', NOW())""",
                (session_id, req.consultation_type),
            )

        # 검진설계 요청도 consultation_requested 상태로 갱신
        await db_manager.execute_update(
            """UPDATE welno.welno_checkup_design_requests
               SET status = 'consultation_requested', updated_at = NOW()
               WHERE uuid = %s AND hospital_id = %s
                 AND design_result IS NOT NULL
                 AND status != 'consultation_requested'""",
            (req.uuid, req.hospital_id),
        )

        print(f"[consultation] request ok uuid={req.uuid} session={session_id}")
        return {
            "status": "ok",
            "session_id": session_id,
            "consultation_type": req.consultation_type,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[consultation] request error: {e}")
        raise HTTPException(status_code=500, detail="상담 요청 처리 중 오류")


# ─── 2. GET /consultation/list ────────────────────────────────

@router.get("/list")
async def consultation_list(
    status: str = Query("all", description="pending|contacted|completed|all"),
    hospital_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    search: Optional[str] = Query(None, description="이름/전화번호 검색"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """백오피스 상담 요청 목록"""
    try:
        conditions = ["t.consultation_requested = true"]
        params = []

        if status and status != "all":
            conditions.append("t.consultation_status = %s")
            params.append(status)

        if hospital_id:
            conditions.append("c.hospital_id = %s")
            params.append(hospital_id)

        if date_from:
            conditions.append("t.consultation_consent_at >= %s")
            params.append(date_from)

        if date_to:
            conditions.append("t.consultation_consent_at <= %s")
            params.append(date_to + " 23:59:59")

        where = " AND ".join(conditions)

        # 이름/전화 검색은 LEFT JOIN 후 HAVING으로 처리
        search_clause = ""
        if search:
            search_clause = (
                " AND (p.name ILIKE %s OR p.phone_number ILIKE %s)"
            )
            params.append(f"%{search}%")
            params.append(f"%{search}%")

        # 총 건수
        count_params = list(params)
        count_sql = f"""
            SELECT COUNT(*) AS cnt
            FROM welno.tb_chat_session_tags t
            JOIN welno.tb_partner_rag_chat_log c
              ON c.session_id = t.session_id
            LEFT JOIN welno.welno_patients p
              ON p.uuid = c.user_uuid AND p.hospital_id = c.hospital_id
            WHERE {where}{search_clause}"""
        count_row = await db_manager.execute_one(count_sql, tuple(count_params))
        total = count_row["cnt"] if count_row else 0

        # 목록 (페이징)
        offset = (page - 1) * limit
        list_params = list(params) + [limit, offset]

        rows = await db_manager.execute_query(
            f"""SELECT
                    t.session_id,
                    c.user_uuid AS uuid,
                    p.name,
                    p.phone_number AS phone,
                    t.consultation_consent_at AS requested_at,
                    t.consultation_status AS status,
                    t.consultation_type,
                    t.conversation_summary,
                    d.design_result
                FROM welno.tb_chat_session_tags t
                JOIN welno.tb_partner_rag_chat_log c
                  ON c.session_id = t.session_id
                LEFT JOIN welno.welno_patients p
                  ON p.uuid = c.user_uuid AND p.hospital_id = c.hospital_id
                LEFT JOIN LATERAL (
                    SELECT design_result
                    FROM welno.welno_checkup_design_requests
                    WHERE uuid = c.user_uuid AND hospital_id = c.hospital_id
                      AND design_result IS NOT NULL
                    ORDER BY created_at DESC LIMIT 1
                ) d ON true
                WHERE {where}{search_clause}
                ORDER BY t.consultation_consent_at DESC NULLS LAST
                LIMIT %s OFFSET %s""",
            tuple(list_params),
        )

        # 각 항목에 design_summary 추가
        items = []
        for r in (rows or []):
            design_summary = None
            dr = r.get("design_result")
            if dr:
                if isinstance(dr, str):
                    try:
                        dr = json.loads(dr)
                    except (json.JSONDecodeError, TypeError):
                        dr = None
                if isinstance(dr, dict):
                    rec_items = dr.get("recommended_items") or []
                    summary_text = dr.get("patient_summary", "")
                    design_summary = {
                        "recommended_count": len(rec_items),
                        "ai_summary": (
                            summary_text[:80] + "..."
                            if len(summary_text) > 80
                            else summary_text
                        ),
                    }

            items.append({
                "session_id": r.get("session_id"),
                "uuid": r.get("uuid"),
                "name": r.get("name"),
                "phone": r.get("phone"),
                "requested_at": (
                    str(r["requested_at"])[:19]
                    if r.get("requested_at")
                    else None
                ),
                "status": r.get("status"),
                "consultation_type": r.get("consultation_type"),
                "design_summary": design_summary,
            })

        return {"items": items, "total": total, "page": page}

    except Exception as e:
        print(f"[consultation] list error: {e}")
        raise HTTPException(status_code=500, detail="상담 목록 조회 중 오류")


# ─── 3. GET /consultation/detail/{uuid} ───────────────────────

@router.get("/detail/{uuid}")
async def consultation_detail(
    uuid: str = Path(..., description="환자 UUID"),
    hospital_id: Optional[str] = Query(None),
):
    """백오피스 고객 상세 (기본정보 + 건강검진 + 검진설계 결과)"""
    try:
        # 1) 환자 기본정보
        patient_row = await db_manager.execute_one(
            """SELECT uuid, name, phone_number, birth_date, gender,
                      hospital_id, created_at
               FROM welno.welno_patients
               WHERE uuid = %s
               ORDER BY created_at DESC LIMIT 1""",
            (uuid,),
        )
        patient = None
        if patient_row:
            patient = {
                "uuid": patient_row["uuid"],
                "name": patient_row.get("name"),
                "phone": patient_row.get("phone_number"),
                "birth_date": (
                    str(patient_row["birth_date"])
                    if patient_row.get("birth_date")
                    else None
                ),
                "gender": patient_row.get("gender"),
                "data_source": "welno_patients",
            }

        # 2) 건강검진 데이터 — raw_data 파싱하여 항목별 값+단위+판정 포함
        health_rows = await db_manager.execute_query(
            """SELECT year, checkup_date, location, code, description,
                      height, weight,
                      blood_pressure_high, blood_pressure_low,
                      blood_sugar, cholesterol, raw_data,
                      collected_at, data_source
               FROM welno.welno_checkup_data
               WHERE patient_uuid = %s
               ORDER BY collected_at DESC""",
            (uuid,),
        )
        health_data = []
        for h in (health_rows or []):
            raw = h.get("raw_data")
            if isinstance(raw, str):
                try:
                    raw = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    pass

            # summary: 기존 요약 필드 (하위 호환)
            height_val = float(h["height"]) if h.get("height") else None
            weight_val = float(h["weight"]) if h.get("weight") else None
            bmi = None
            if height_val and weight_val and height_val > 0:
                h_m = height_val / 100.0
                bmi = round(weight_val / (h_m * h_m), 1)

            summary = {
                "height": height_val,
                "weight": weight_val,
                "bmi": bmi,
                "blood_pressure_high": h.get("blood_pressure_high"),
                "blood_pressure_low": h.get("blood_pressure_low"),
                "blood_sugar": h.get("blood_sugar"),
                "cholesterol": h.get("cholesterol"),
            }

            # inspections: raw_data 파싱 결과
            inspections = _parse_inspections(raw) if isinstance(raw, dict) else []

            health_data.append({
                "year": h.get("year"),
                "checkup_date": h.get("checkup_date"),
                "location": h.get("location"),
                "code": h.get("code"),
                "description": h.get("description"),
                "summary": summary,
                "inspections": inspections,
                # 하위 호환: 기존 flat 필드 유지
                "height": height_val,
                "weight": weight_val,
                "blood_pressure_high": h.get("blood_pressure_high"),
                "blood_pressure_low": h.get("blood_pressure_low"),
                "blood_sugar": h.get("blood_sugar"),
                "cholesterol": h.get("cholesterol"),
                "collected_at": (
                    str(h["collected_at"])[:19]
                    if h.get("collected_at")
                    else None
                ),
                "data_source": "welno_checkup_data",
            })

        # 3) 검진설계 결과 — step1_result + step2_result 전체 포함
        design_conds = ["d.uuid = %s", "d.design_result IS NOT NULL"]
        design_params = [uuid]
        if hospital_id:
            design_conds.append("d.hospital_id = %s")
            design_params.append(hospital_id)

        design_rows = await db_manager.execute_query(
            f"""SELECT d.id, d.hospital_id, d.partner_id,
                       d.status, d.trigger_source,
                       d.design_result, d.selected_concerns,
                       d.auto_concerns, d.survey_responses,
                       d.selected_medication_texts,
                       d.step1_result, d.step2_result,
                       d.created_at
                FROM welno.welno_checkup_design_requests d
                WHERE {' AND '.join(design_conds)}
                ORDER BY d.created_at DESC""",
            tuple(design_params),
        )
        design_results = []
        for dr_row in (design_rows or []):
            dr = _parse_json(dr_row.get("design_result")) or {}
            step1_raw = _parse_json(dr_row.get("step1_result"))
            step2_raw = _parse_json(dr_row.get("step2_result"))

            design_results.append({
                "id": dr_row["id"],
                "hospital_id": dr_row.get("hospital_id"),
                "status": dr_row.get("status"),
                "trigger_source": dr_row.get("trigger_source"),
                "design_result": dr,
                "selected_concerns": _parse_json(
                    dr_row.get("selected_concerns")
                ),
                "auto_concerns": _parse_json(
                    dr_row.get("auto_concerns")
                ),
                "survey_responses": _parse_json(
                    dr_row.get("survey_responses")
                ),
                "selected_medication_texts": _parse_json(
                    dr_row.get("selected_medication_texts")
                ),
                # step1/step2 전체 JSON
                "step1_result": step1_raw,
                "step2_result": step2_raw,
                # 상담용 하이라이트 (프론트에서 바로 사용)
                "step1_highlights": _extract_step1_highlights(
                    step1_raw
                ) if step1_raw else None,
                "step2_highlights": _extract_step2_highlights(
                    step2_raw
                ) if step2_raw else None,
                "created_at": (
                    str(dr_row["created_at"])[:19]
                    if dr_row.get("created_at")
                    else None
                ),
                "data_source": "welno_checkup_design_requests",
            })

        # 4-a) 타이밍 데이터
        timing = {}
        try:
            entry_row = await db_manager.execute_one(
                """SELECT created_at FROM welno.tb_partner_rag_chat_log
                   WHERE user_uuid = %s
                   ORDER BY created_at ASC LIMIT 1""",
                (uuid,),
            )
            timing["entry_at"] = (
                str(entry_row["created_at"])[:19] if entry_row and entry_row.get("created_at") else None
            )

            design_start_row = await db_manager.execute_one(
                """SELECT created_at FROM welno.welno_checkup_design_requests
                   WHERE uuid = %s ORDER BY created_at ASC LIMIT 1""",
                (uuid,),
            )
            timing["design_start_at"] = (
                str(design_start_row["created_at"])[:19]
                if design_start_row and design_start_row.get("created_at") else None
            )

            design_done_row = await db_manager.execute_one(
                """SELECT updated_at FROM welno.welno_checkup_design_requests
                   WHERE uuid = %s AND status IN ('step2_completed','consultation_requested')
                   ORDER BY updated_at DESC LIMIT 1""",
                (uuid,),
            )
            timing["design_complete_at"] = (
                str(design_done_row["updated_at"])[:19]
                if design_done_row and design_done_row.get("updated_at") else None
            )

            consult_row = await db_manager.execute_one(
                """SELECT consultation_consent_at FROM welno.tb_chat_session_tags
                   WHERE session_id IN (
                     SELECT session_id FROM welno.tb_partner_rag_chat_log
                     WHERE user_uuid = %s
                   ) AND consultation_requested = true LIMIT 1""",
                (uuid,),
            )
            timing["consultation_requested_at"] = (
                str(consult_row["consultation_consent_at"])[:19]
                if consult_row and consult_row.get("consultation_consent_at") else None
            )
        except Exception as t_err:
            logger.warning(f"[consultation] timing 조회 실패: {t_err}")

        # 4-b) 처방 데이터
        prescription_data = []
        try:
            rx_rows = await db_manager.execute_query(
                """SELECT hospital_name, treatment_date, treatment_type,
                          visit_count, prescription_count, medication_count,
                          raw_data, data_source
                   FROM welno.welno_prescription_data
                   WHERE patient_uuid = %s
                   ORDER BY treatment_date DESC""",
                (uuid,),
            )
            for rx in (rx_rows or []):
                meds = []
                raw = _parse_json(rx.get("raw_data"))
                if isinstance(raw, dict):
                    details = raw.get(
                        "RetrieveTreatmentInjectionInformationPersonDetailList", []
                    )
                    for d in (details or []):
                        meds.append({
                            "name": d.get("ChoBangYakPumMyung", ""),
                            "effect": d.get("ChoBangYakPumHyoneung", ""),
                            "days": d.get("TuyakIlSoo"),
                        })
                prescription_data.append({
                    "hospital_name": rx.get("hospital_name"),
                    "treatment_date": str(rx["treatment_date"]) if rx.get("treatment_date") else None,
                    "treatment_type": rx.get("treatment_type"),
                    "medication_count": rx.get("medication_count"),
                    "medications": meds,
                    "data_source": rx.get("data_source"),
                })
        except Exception as rx_err:
            logger.warning(f"[consultation] prescription 조회 실패: {rx_err}")

        # 4-c) 세션 태그 (tb_chat_session_tags)
        session_tags = None
        try:
            tag_row = await db_manager.execute_one(
                """SELECT interest_tags, risk_tags, key_concerns,
                          conversation_summary, sentiment, risk_level,
                          counselor_recommendations, commercial_tags,
                          buying_signal, prospect_type, action_intent,
                          medical_tags, lifestyle_tags, nutrition_tags,
                          anxiety_level, hospital_prospect_score,
                          medical_urgency, engagement_score,
                          suggested_revisit_messages
                   FROM welno.tb_chat_session_tags
                   WHERE session_id IN (
                     SELECT session_id
                     FROM welno.tb_partner_rag_chat_log
                     WHERE user_uuid = %s
                   )
                   ORDER BY created_at DESC LIMIT 1""",
                (uuid,),
            )
            if tag_row:
                session_tags = {
                    "interest_tags": _parse_json(tag_row.get("interest_tags")),
                    "risk_tags": _parse_json(tag_row.get("risk_tags")),
                    "key_concerns": _parse_json(tag_row.get("key_concerns")),
                    "conversation_summary": tag_row.get("conversation_summary"),
                    "sentiment": tag_row.get("sentiment"),
                    "risk_level": tag_row.get("risk_level"),
                    "counselor_recommendations": _parse_json(
                        tag_row.get("counselor_recommendations")
                    ),
                    "commercial_tags": _parse_json(tag_row.get("commercial_tags")),
                    "buying_signal": tag_row.get("buying_signal"),
                    "prospect_type": tag_row.get("prospect_type"),
                    "action_intent": tag_row.get("action_intent"),
                    "medical_tags": _parse_json(tag_row.get("medical_tags")),
                    "lifestyle_tags": _parse_json(tag_row.get("lifestyle_tags")),
                    "nutrition_tags": _parse_json(tag_row.get("nutrition_tags")),
                    "anxiety_level": tag_row.get("anxiety_level"),
                    "hospital_prospect_score": tag_row.get(
                        "hospital_prospect_score"
                    ),
                    "medical_urgency": tag_row.get("medical_urgency"),
                    "engagement_score": tag_row.get("engagement_score"),
                    "suggested_revisit_messages": _parse_json(
                        tag_row.get("suggested_revisit_messages")
                    ),
                }
        except Exception as tag_err:
            logger.warning(f"[consultation] session_tags 조회 실패: {tag_err}")

        # 5) 병원 보유 검사 항목 (welno_external_checkup_items)
        hospital_checkup_items = []
        try:
            h_id = hospital_id or (patient.get("hospital_id") if patient else None)
            if h_id:
                hci_rows = await db_manager.execute_query(
                    """SELECT e.id, e.item_name, e.category, e.sub_category,
                              e.target_trigger, e.gap_description,
                              e.solution_narrative, e.algorithm_class
                       FROM welno.welno_external_checkup_items e
                       JOIN welno.welno_hospital_external_checkup_mapping m
                         ON m.external_checkup_item_id = e.id
                       WHERE m.hospital_id = %s AND m.is_active = true
                       ORDER BY m.display_order""",
                    (h_id,),
                )
                for row in (hci_rows or []):
                    hospital_checkup_items.append({
                        "id": row["id"],
                        "item_name": row.get("item_name"),
                        "category": row.get("category"),
                        "sub_category": row.get("sub_category"),
                        "target_trigger": row.get("target_trigger"),
                        "gap_description": row.get("gap_description"),
                        "solution_narrative": row.get("solution_narrative"),
                        "algorithm_class": row.get("algorithm_class"),
                    })
        except Exception as hci_err:
            logger.warning(f"[consultation] hospital items 조회 실패: {hci_err}")

        # 6) 데이터 라벨링
        data_labels = {
            "patient": "welno_patients",
            "healthData": "welno_checkup_data (Tilko raw_data 파싱 포함)",
            "healthData.summary": "welno_checkup_data 요약 필드",
            "healthData.inspections": "welno_checkup_data.raw_data → Inspections[].Illnesses[].Items[] 파싱",
            "designResult": "welno_checkup_design_requests (AI)",
            "designResult.step1_result": "welno_checkup_design_requests.step1_result (JSONB)",
            "designResult.step2_result": "welno_checkup_design_requests.step2_result (JSONB)",
            "designResult.step1_highlights": "step1_result에서 persona/risk_profile/chronic_analysis/concern_vs_reality 추출",
            "designResult.step2_highlights": "step2_result에서 strategies/doctor_comment/priority_2,3 추출",
            "mlRecommendations": "향후 데이터레이크 ML 연동 시 채워짐 (예약 필드)",
        }

        return {
            "patient": patient,
            "healthData": health_data,
            "designResult": design_results,
            "sessionTags": session_tags,
            "timing": timing,
            "prescriptionData": prescription_data,
            "hospitalCheckupItems": hospital_checkup_items,
            "mlRecommendations": None,
            "dataLabels": data_labels,
        }

    except Exception as e:
        print(f"[consultation] detail error: {e}")
        raise HTTPException(status_code=500, detail="상담 상세 조회 중 오류")


# ─── 4. POST /consultation/status ─────────────────────────────

@router.post("/status")
async def consultation_status(req: ConsultationStatusBody):
    """백오피스에서 상담 상태 변경"""
    try:
        if req.status not in ("pending", "contacted", "completed"):
            raise HTTPException(
                status_code=400,
                detail="status는 'pending', 'contacted', 'completed' 중 하나",
            )

        # uuid + hospital_id로 세션 찾기
        session = await db_manager.execute_one(
            """SELECT t.session_id
               FROM welno.tb_chat_session_tags t
               JOIN welno.tb_partner_rag_chat_log c
                 ON c.session_id = t.session_id
               WHERE c.user_uuid = %s AND c.hospital_id = %s
                 AND t.consultation_requested = true
               ORDER BY c.created_at DESC LIMIT 1""",
            (req.uuid, req.hospital_id),
        )
        if not session:
            raise HTTPException(
                status_code=404, detail="상담 요청을 찾을 수 없습니다"
            )

        await db_manager.execute_update(
            """UPDATE welno.tb_chat_session_tags
               SET consultation_status = %s
               WHERE session_id = %s""",
            (req.status, session["session_id"]),
        )

        print(
            f"[consultation] status changed uuid={req.uuid} "
            f"session={session['session_id']} -> {req.status}"
        )
        return {
            "status": "ok",
            "session_id": session["session_id"],
            "new_status": req.status,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[consultation] status error: {e}")
        raise HTTPException(status_code=500, detail="상담 상태 변경 중 오류")
