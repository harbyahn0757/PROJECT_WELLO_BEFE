-- Migration: mediArc 리포트 결과 캐시 테이블 신규 생성
-- GET /mediarc-report/{uuid} — EngineFacade().run() 35초 재계산 방지
-- UNIQUE: patient_uuid + hospital_id (건강데이터 변경 시 digest로 무효화)
-- 적용: psql -U peernine -d p9_mkt_biz -f 20260416_add_welno_mediarc_report_cache.sql

CREATE TABLE IF NOT EXISTS welno.welno_mediarc_report_cache (
    id              BIGSERIAL    PRIMARY KEY,
    patient_uuid    VARCHAR(64)  NOT NULL,
    hospital_id     VARCHAR(32)  NOT NULL DEFAULT '',
    input_digest    VARCHAR(64)  NOT NULL,
    result_json     JSONB        NOT NULL,
    engine_version  VARCHAR(16)  NOT NULL DEFAULT 'v1',
    generated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_welno_mediarc_report_cache
        UNIQUE (patient_uuid, hospital_id)
);

CREATE INDEX IF NOT EXISTS ix_welno_mediarc_rpt_cache_uuid
    ON welno.welno_mediarc_report_cache (patient_uuid);

CREATE INDEX IF NOT EXISTS ix_welno_mediarc_rpt_cache_updated
    ON welno.welno_mediarc_report_cache (updated_at DESC);

COMMENT ON TABLE welno.welno_mediarc_report_cache IS
    'mediArc GET /mediarc-report/{uuid} 엔진 계산 결과 캐시. '
    'health_data 변경(input_digest 불일치) 시 자동 재계산 후 UPSERT.';
