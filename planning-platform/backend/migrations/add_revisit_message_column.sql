-- 재방문 추천 메시지 컬럼 추가 (3가지 시나리오별 메시지 JSONB)
-- tb_chat_session_tags에 태깅 시 생성된 재연락 추천 메시지 저장
-- 2026-03-05

ALTER TABLE welno.tb_chat_session_tags
ADD COLUMN IF NOT EXISTS suggested_revisit_messages JSONB DEFAULT NULL;

COMMENT ON COLUMN welno.tb_chat_session_tags.suggested_revisit_messages
IS '재방문 유도 추천 메시지 3종 {care_message, action_message, info_message} (follow_up_needed=true일 때 자동 생성)';
