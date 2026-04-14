"""
report_engine — mediArc 자체 계산 엔진 패키지.

외부 노출 (partner_office.py에서 import 가능):
    EngineFacade           — 싱글톤 파사드 + run(name, patient) 인터페이스
    ENGINE_AVAILABLE       — 엔진 로드 성공 여부
    MODEL_LOADED           — pkl 모델 로드 성공 여부
    compare_single         — Twobecon vs 엔진 실시간 비교 (async)
    verify_batch           — 전수 검증 배치 (async)
    build_engine_stats     — 엔진 통계 집계 (sync)
    to_engine_patient      — health_data + age/sex → engine patient dict

backward compat (기존 코드 유지):
    generate_report, compute_stats — 편의 래퍼
    to_engine_input, infer_group, adapt_report_to_fe_schema

services/mediarc/ import 금지 — 독립 계산 계층.
"""

from .facade import (  # noqa: F401
    EngineFacade,
    generate_report,
    compute_stats,
    ENGINE_AVAILABLE,
    MODEL_LOADED,
)
from .adapter import (  # noqa: F401
    to_engine_input,
    to_engine_patient,
    infer_group,
    adapt_report_to_fe_schema,
)
from .operations import (  # noqa: F401
    compare_single,
    verify_batch,
    build_engine_stats,
)

__all__ = [
    # partner_office.py 계약 7개
    "EngineFacade",
    "ENGINE_AVAILABLE",
    "MODEL_LOADED",
    "compare_single",
    "verify_batch",
    "build_engine_stats",
    "to_engine_patient",
    # backward compat
    "generate_report",
    "compute_stats",
    "to_engine_input",
    "infer_group",
    "adapt_report_to_fe_schema",
]
