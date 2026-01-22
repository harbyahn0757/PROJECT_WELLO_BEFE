-- Mediarc 필드 추가 마이그레이션
-- 실행: psql -h 10.0.1.10 -U peernine -d p9_mkt_biz -f migrations/add_mediarc_fields.sql

BEGIN;

-- 1. welno_patients 테이블에 Mediarc 관련 컬럼 추가
ALTER TABLE welno.welno_patients 
ADD COLUMN IF NOT EXISTS has_mediarc_report BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_questionnaire_data BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN welno.welno_patients.has_mediarc_report IS 'Mediarc 질병예측 리포트 존재 여부';
COMMENT ON COLUMN welno.welno_patients.has_questionnaire_data IS '문진 데이터 포함 여부';

-- 2. welno_mediarc_reports 테이블 생성 (이미 존재하면 스킵)
CREATE TABLE IF NOT EXISTS welno.welno_mediarc_reports (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES welno.welno_patients(id) ON DELETE CASCADE,
    patient_uuid VARCHAR(36) NOT NULL,
    hospital_id VARCHAR(20) NOT NULL,
    raw_response JSONB NOT NULL,
    mkt_uuid VARCHAR(50) UNIQUE,
    report_url TEXT,
    provider VARCHAR(20) DEFAULT 'twobecon',
    analyzed_at TIMESTAMPTZ,
    bodyage INTEGER,
    rank INTEGER,
    disease_data JSONB,
    cancer_data JSONB,
    has_questionnaire BOOLEAN DEFAULT FALSE,
    questionnaire_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(patient_uuid, hospital_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_mediarc_patient ON welno.welno_mediarc_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_mediarc_uuid ON welno.welno_mediarc_reports(mkt_uuid);
CREATE INDEX IF NOT EXISTS idx_mediarc_analyzed ON welno.welno_mediarc_reports(analyzed_at);
CREATE INDEX IF NOT EXISTS idx_mediarc_raw ON welno.welno_mediarc_reports USING GIN (raw_response);
CREATE INDEX IF NOT EXISTS idx_mediarc_disease ON welno.welno_mediarc_reports USING GIN (disease_data);
CREATE INDEX IF NOT EXISTS idx_mediarc_cancer ON welno.welno_mediarc_reports USING GIN (cancer_data);

-- 트리거 생성 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거가 이미 존재하는지 확인
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_welno_mediarc_reports_updated_at'
    ) THEN
        CREATE TRIGGER update_welno_mediarc_reports_updated_at 
            BEFORE UPDATE ON welno.welno_mediarc_reports 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- 코멘트 추가
COMMENT ON TABLE welno.welno_mediarc_reports IS 'Mediarc (Twobecon) 질병예측 리포트';
COMMENT ON COLUMN welno.welno_mediarc_reports.raw_response IS 'Mediarc API 원본 응답 (JSONB)';
COMMENT ON COLUMN welno.welno_mediarc_reports.bodyage IS '건강 나이';
COMMENT ON COLUMN welno.welno_mediarc_reports.rank IS '상위 퍼센트 순위';

COMMIT;

-- 확인 쿼리
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'welno' 
  AND table_name = 'welno_patients' 
  AND column_name IN ('has_mediarc_report', 'has_questionnaire_data');
