-- Migration: 시뮬레이션 캐시 테이블 신규 생성
-- Phase 3-B/3-C: compute_milestone_scenario 결과 캐시 (UNIQUE: patient_uuid + hospital_id + input_digest)
-- 적용: psql -U peernine -d p9_mkt_biz -f 20260415_add_welno_mediarc_simulations.sql

CREATE TABLE IF NOT EXISTS welno.welno_mediarc_simulations (
    id              BIGSERIAL PRIMARY KEY,
    patient_uuid    VARCHAR(64)  NOT NULL,
    hospital_id     VARCHAR(32)  NOT NULL DEFAULT '',
    input_digest    VARCHAR(64)  NOT NULL,
    input_json      JSONB        NOT NULL,
    result_json     JSONB        NOT NULL,
    engine_version  VARCHAR(16)  NOT NULL DEFAULT 'v1',
    generated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_welno_mediarc_simulations
        UNIQUE (patient_uuid, hospital_id, input_digest)
);

CREATE INDEX IF NOT EXISTS ix_welno_mediarc_sim_updated
    ON welno.welno_mediarc_simulations (updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_welno_mediarc_sim_patient
    ON welno.welno_mediarc_simulations (patient_uuid, hospital_id);

COMMENT ON TABLE welno.welno_mediarc_simulations IS
    'mediArc Phase 3-B/3-C: 마일스톤 시나리오 계산 결과 캐시. input_digest 변경 시 신규 row 자동 생성.';
