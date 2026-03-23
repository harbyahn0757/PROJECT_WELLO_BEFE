-- 검진설계 캠페인 모듈화를 위한 스키마 확장
-- 2026-03-23

-- 1. welno_checkup_design_requests 확장
ALTER TABLE welno.welno_checkup_design_requests
  ADD COLUMN IF NOT EXISTS partner_id VARCHAR(50) DEFAULT 'welno',
  ADD COLUMN IF NOT EXISTS trigger_source VARCHAR(20) DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS auto_concerns JSONB;

COMMENT ON COLUMN welno.welno_checkup_design_requests.partner_id IS '파트너 ID (welno, kindhabit 등)';
COMMENT ON COLUMN welno.welno_checkup_design_requests.trigger_source IS '트리거 소스 (user, auto_data, manual_backoffice, campaign)';
COMMENT ON COLUMN welno.welno_checkup_design_requests.auto_concerns IS '자동 추출된 관심항목 (auto_extract_concerns 결과)';

CREATE INDEX IF NOT EXISTS idx_design_requests_partner
  ON welno.welno_checkup_design_requests(partner_id);
CREATE INDEX IF NOT EXISTS idx_design_requests_trigger_source
  ON welno.welno_checkup_design_requests(trigger_source);

-- 2. 트리거 실행 이력 테이블
CREATE TABLE IF NOT EXISTS welno.welno_trigger_log (
  id SERIAL PRIMARY KEY,
  patient_uuid VARCHAR(100),
  partner_id VARCHAR(50),
  trigger_type VARCHAR(50) NOT NULL,
  trigger_source VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE welno.welno_trigger_log IS '자동/수동 트리거 실행 이력';
COMMENT ON COLUMN welno.welno_trigger_log.trigger_type IS 'checkup_design, disease_report 등';
COMMENT ON COLUMN welno.welno_trigger_log.trigger_source IS 'auto_data, manual_backoffice, campaign';
COMMENT ON COLUMN welno.welno_trigger_log.status IS 'pending, success, failed, skipped';

CREATE INDEX IF NOT EXISTS idx_trigger_log_patient
  ON welno.welno_trigger_log(patient_uuid);
CREATE INDEX IF NOT EXISTS idx_trigger_log_partner
  ON welno.welno_trigger_log(partner_id);
CREATE INDEX IF NOT EXISTS idx_trigger_log_created
  ON welno.welno_trigger_log(created_at DESC);
