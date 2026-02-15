-- LLM(Gemini) 태깅 실패 추적 컬럼 추가
-- 2026-02-15: Gemini 호출 시도/실패 여부 및 실패 사유를 기록하여
--             rule-based 폴백 원인을 구분할 수 있도록 함

ALTER TABLE welno.tb_chat_session_tags
  ADD COLUMN IF NOT EXISTS llm_attempted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS llm_failed    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS llm_error     VARCHAR(500) DEFAULT NULL;

COMMENT ON COLUMN welno.tb_chat_session_tags.llm_attempted IS 'Gemini 호출 시도 여부';
COMMENT ON COLUMN welno.tb_chat_session_tags.llm_failed IS 'Gemini 호출 실패 여부';
COMMENT ON COLUMN welno.tb_chat_session_tags.llm_error IS '실패 사유 (api_key_missing, json_parse_error, invalid_response, api_error:...)';
