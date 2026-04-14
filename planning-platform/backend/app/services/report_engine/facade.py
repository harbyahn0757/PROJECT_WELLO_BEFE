"""
facade.py — EngineFacade 싱글톤 + 편의 함수.

서버 시작 시 1회 로드(lazy). pkl/json 로드 실패 시 ENGINE_AVAILABLE=False,
MODEL_LOADED=False 로 폴백 — app crash 없이 계속 기동.
"""

import json
import logging
from pathlib import Path
from threading import Lock
from typing import Optional

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# 엔진 임포트 (로드 실패 격리)
# ──────────────────────────────────────────────────────────────────────────────

ENGINE_AVAILABLE: bool = False
MODEL_LOADED: bool = False

try:
    from .engine import (
        RR_MATRIX,
        run_for_patient,
        compute_bioage_gb,
    )
    ENGINE_AVAILABLE = True
    _pkl = Path(__file__).parent / "bioage_model.pkl"
    MODEL_LOADED = _pkl.exists()
except Exception as _e:
    logger.error("report_engine: engine.py 로드 실패 — %s", _e)
    run_for_patient = None      # type: ignore[assignment]
    compute_bioage_gb = None    # type: ignore[assignment]
    RR_MATRIX = {}              # type: ignore[assignment]


# ──────────────────────────────────────────────────────────────────────────────
# EngineFacade
# ──────────────────────────────────────────────────────────────────────────────

class EngineFacade:
    """mediArc 엔진 싱글톤 파사드 (프로세스당 1회 로드)."""

    _instance: Optional["EngineFacade"] = None
    _lock: Lock = Lock()
    _warmed: bool = False

    def __new__(cls) -> "EngineFacade":
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
        return cls._instance

    def warmup(self) -> None:
        """pkl 로드 앞당김. 실패해도 앱 기동 계속."""
        if self._warmed:
            return
        if not ENGINE_AVAILABLE or compute_bioage_gb is None:
            logger.warning("report_engine: warmup 생략 — 엔진 미로드")
            self._warmed = True
            return
        dummy = {
            "age": 40, "sex": "M", "bmi": 22.0, "sbp": 120, "dbp": 75,
            "fbg": 90, "height": 170, "weight": 65, "waist": 80,
            "hemoglobin": 14.0, "tc": 180, "hdl": 50, "ldl": 110, "tg": 100,
            "ast": 20, "alt": 20, "ggt": 20, "cr": 1.0, "gfr": 100,
        }
        try:
            compute_bioage_gb(dummy)
            logger.info("report_engine: warmup OK")
        except Exception as e:
            logger.warning("report_engine: warmup pkl 로드 실패 — %s (bioage 건너뜀)", e)
        self._warmed = True

    def generate_report(self, patient_dict: dict) -> dict:
        """engine.run_for_patient 호출 후 FE ReportData 형식 반환.
        _name 키로 이름 전달 (내부 pop). ENGINE_AVAILABLE=False → 빈 dict."""
        if not ENGINE_AVAILABLE or run_for_patient is None:
            return {}

        name: str = patient_dict.pop("_name", "익명")
        try:
            raw = run_for_patient(name, patient_dict)
        except Exception as e:
            logger.exception("report_engine: run_for_patient 실패 — %s", e)
            return {}

        age_val = raw.get("age", patient_dict.get("age", 0))
        bodyage_val = raw.get("bodyage")
        delta_val = raw.get("bodyage_delta")

        # bioage_gb (pkl 기반, 실패 시 None 유지)
        bioage_gb_result: Optional[dict] = None
        if MODEL_LOADED and compute_bioage_gb is not None:
            try:
                bioage_gb_result = compute_bioage_gb(patient_dict)
            except Exception as e:
                logger.warning("report_engine: compute_bioage_gb 실패 — %s", e)
        if bioage_gb_result:
            bodyage_val = bioage_gb_result["bioage_gb"]
            delta_val = round(bodyage_val - age_val, 1)

        # nutrition (nutrition_rules.py — 소문자 → 대문자 브리지)
        nutrition_result: Optional[dict] = None
        try:
            from .nutrition_rules import recommend_nutrients, caution_nutrients
            # nutrition_rules는 대문자 키 사용 (ALT, SBP, FBG, TC, LDL, BMI, creatinine)
            _nr_patient = {
                "ALT":        patient_dict.get("alt"),
                "SBP":        patient_dict.get("sbp"),
                "DBP":        patient_dict.get("dbp"),
                "BMI":        patient_dict.get("bmi"),
                "creatinine": patient_dict.get("cr"),
                "TC":         patient_dict.get("tc"),
                "LDL":        patient_dict.get("ldl"),
                "FBG":        patient_dict.get("fbg"),
            }
            # disease_results: nutrition_rules 호환 포맷 (result = "이상"/"정상")
            _nr_diseases = {
                d: {"result": "이상" if v.get("rank", 100) <= 30 else "정상"}
                for d, v in (raw.get("diseases") or {}).items()
            }
            nutrition_result = {
                "recommend": recommend_nutrients(_nr_patient, _nr_diseases),
                "caution":   caution_nutrients(_nr_patient, _nr_diseases),
            }
        except Exception as _ne:
            logger.warning("report_engine: nutrition 생성 실패 — %s", _ne)

        return {
            "name": name,
            "age": age_val,
            "sex": raw.get("sex"),
            "group": raw.get("group"),
            "bodyage": {"bodyage": bodyage_val, "delta": delta_val, "bioage_gb": bioage_gb_result},
            "rank": raw.get("bodyage_rank"),
            "diseases": raw.get("diseases", {}),
            "gauges": raw.get("gauges", {}),
            "improved": raw.get("improved", {}),
            "disease_ages": raw.get("disease_ages", {}),
            "patient_info": {"age": age_val, "sex": raw.get("sex"), "group": raw.get("group")},
            "nutrition": nutrition_result,
        }

    def run(self, name: str, patient: dict) -> dict:
        """partner_office.py 호출 인터페이스 — generate_report의 명시적 래퍼.

        Args:
            name:    환자 이름 (표시용)
            patient: to_engine_patient() 반환값 (age, sex, bmi, sbp, ... 포함)

        Returns:
            generate_report 동일 schema: bodyage, rank, diseases, gauges, ...
        """
        merged = {"_name": name, **patient}
        return self.generate_report(merged)

    def compute_stats(self) -> dict:
        """RR_MATRIX + rr_ci_table.json 에서 EngineStats 집계."""
        if not ENGINE_AVAILABLE:
            return {"error": "engine not available"}

        rr_ci_path = Path(__file__).parent / "rr_ci_table.json"
        rr_ci: dict = {}
        if rr_ci_path.exists():
            try:
                with open(rr_ci_path, encoding="utf-8") as f:
                    rr_ci = json.load(f)
            except Exception as e:
                logger.warning("report_engine: rr_ci_table.json 로드 실패 — %s", e)

        total_rr = sum(len(v) for v in RR_MATRIX.values()) if RR_MATRIX else 0
        diseases_count = len(RR_MATRIX)
        total_rr_ci = sum(len(v) for v in rr_ci.values()) if rr_ci else total_rr
        pmid_count = sum(
            1 for d_factors in RR_MATRIX.values()
            for fd in (d_factors.values() if isinstance(d_factors, dict) else [])
            if isinstance(fd, dict) and fd.get("pmid")
        )
        pmid_pct = round(pmid_count / total_rr * 100, 1) if total_rr > 0 else 0.0

        return {
            "total_rr": total_rr_ci if rr_ci else total_rr,
            "pmid_coverage": pmid_pct,
            "diseases": diseases_count,
            "confidence": {"verified": pmid_count, "total": total_rr},
            "validation": {
                "model": "Gradient Boosting (서울대 PMID 40231591)",
                "n": 1005, "r2_test": 0.69,
                "model_loaded": MODEL_LOADED,
            },
            "engine_available": ENGINE_AVAILABLE,
        }


# ──────────────────────────────────────────────────────────────────────────────
# 편의 함수
# ──────────────────────────────────────────────────────────────────────────────

def generate_report(patient_dict: dict) -> dict:
    """EngineFacade().generate_report() 래퍼."""
    return EngineFacade().generate_report(patient_dict)


def compute_stats() -> dict:
    """EngineFacade().compute_stats() 래퍼."""
    return EngineFacade().compute_stats()
