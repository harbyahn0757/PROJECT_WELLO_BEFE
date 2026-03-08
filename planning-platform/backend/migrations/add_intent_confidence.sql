-- Phase H: conversation_intent + classification_confidence 컬럼 추가
-- 2026-03-08
-- conversation_intent: 대화 의도 1차 분류 (health_question/ux_issue/greeting/off_topic)
-- classification_confidence: LLM 분류 신뢰도 (0.0-1.0)

ALTER TABLE welno.tb_chat_session_tags
  ADD COLUMN IF NOT EXISTS conversation_intent VARCHAR(20) DEFAULT 'health_question',
  ADD COLUMN IF NOT EXISTS classification_confidence REAL DEFAULT 0.5;

-- 인덱스: conversation_intent로 필터링 시 활용
CREATE INDEX IF NOT EXISTS idx_chat_tags_conversation_intent
  ON welno.tb_chat_session_tags (conversation_intent);
