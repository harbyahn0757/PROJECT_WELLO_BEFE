-- 2026-04-15: mediArc AI 한 줄 요약 저장 테이블
-- on-demand 생성, hospital_id + patient_uuid UNIQUE. 채팅/캠페인/welno 3소스 공통.
-- 실행: psql -h 10.0.1.10 -U peernine -d p9_mkt_biz -f migrations/add_mediarc_ai_summary.sql

BEGIN;

CREATE TABLE IF NOT EXISTS welno.welno_mediarc_ai_summaries (
    id              SERIAL PRIMARY KEY,
    patient_uuid    VARCHAR(36) NOT NULL,
    hospital_id     VARCHAR(20) NOT NULL,
    summary         TEXT NOT NULL,
    model           VARCHAR(64) NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
    prompt_version  VARCHAR(16) NOT NULL DEFAULT 'v1',
    input_digest    VARCHAR(64),
    input_tokens    INTEGER,
    output_tokens   INTEGER,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (patient_uuid, hospital_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_sum_patient_hospital
    ON welno.welno_mediarc_ai_summaries (patient_uuid, hospital_id);

CREATE INDEX IF NOT EXISTS idx_ai_sum_created_at
    ON welno.welno_mediarc_ai_summaries (generated_at DESC);

COMMENT ON TABLE welno.welno_mediarc_ai_summaries IS 'mediArc 리포트 Haiku 1줄 요약 (on-demand, 캐시)';
COMMENT ON COLUMN welno.welno_mediarc_ai_summaries.input_digest IS 'SHA256 of report JSON input — 변경 시 stale 표시';
COMMENT ON COLUMN welno.welno_mediarc_ai_summaries.prompt_version IS '프롬프트 스키마 버전. v1 = 2026-04-15 초기.';

COMMIT;
