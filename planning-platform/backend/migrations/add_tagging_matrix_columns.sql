-- 태깅 매트릭스 고도화: 대화 깊이, 참여도, 행동 의향, 식단·영양제 관심 컬럼 추가
-- 2026-02-14

ALTER TABLE welno.tb_chat_session_tags
  ADD COLUMN IF NOT EXISTS conversation_depth VARCHAR(20) DEFAULT 'shallow',
  ADD COLUMN IF NOT EXISTS engagement_score SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS action_intent VARCHAR(20) DEFAULT 'passive',
  ADD COLUMN IF NOT EXISTS nutrition_tags JSONB DEFAULT '[]';
