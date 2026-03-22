-- 상담 요청 컬럼 추가 (tb_chat_session_tags)
-- 기존 follow_up_needed(AI 자동판단)과 구분하여, 사용자 명시적 동의를 추적

ALTER TABLE welno.tb_chat_session_tags
  ADD COLUMN IF NOT EXISTS consultation_requested BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS consultation_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS consultation_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS consultation_consent_at TIMESTAMPTZ;

COMMENT ON COLUMN welno.tb_chat_session_tags.consultation_requested IS '사용자 명시적 상담 동의 여부';
COMMENT ON COLUMN welno.tb_chat_session_tags.consultation_type IS '상담 유형: rehab(재활) / checkup(검진예약)';
COMMENT ON COLUMN welno.tb_chat_session_tags.consultation_status IS '상담 상태: pending / contacted / completed';
COMMENT ON COLUMN welno.tb_chat_session_tags.consultation_consent_at IS '동의 시점';

CREATE INDEX IF NOT EXISTS idx_chat_tags_consultation
  ON welno.tb_chat_session_tags (consultation_requested, consultation_status)
  WHERE consultation_requested = true;
