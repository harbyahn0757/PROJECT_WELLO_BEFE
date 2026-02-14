-- LLM 기반 채팅 태깅 시스템 업그레이드
-- tb_chat_session_tags 테이블에 LLM 태깅 관련 컬럼 추가

ALTER TABLE welno.tb_chat_session_tags
  ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20) DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS key_concerns JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS follow_up_needed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tagging_model VARCHAR(50) DEFAULT 'rule-based',
  ADD COLUMN IF NOT EXISTS tagging_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS counselor_recommendations JSONB DEFAULT '[]';
