-- 대화 세션 태깅 테이블
-- 자동 태깅 시스템: 관심사, 위험 태그, 키워드, 감정 분석, 대화 요약 등

CREATE TABLE IF NOT EXISTS welno.tb_chat_session_tags (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    partner_id VARCHAR(50) NOT NULL,
    -- 자동 태깅 필드
    interest_tags JSONB DEFAULT '[]',       -- ["다이어트", "혈압", "당뇨"]
    risk_tags JSONB DEFAULT '[]',           -- ["고혈압_전단계", "비만", "간기능_이상"]
    keyword_tags JSONB DEFAULT '[]',        -- ["위", "암", "용종", "콜레스테롤"]
    sentiment VARCHAR(20),                   -- positive, neutral, negative, confused
    -- 메타
    conversation_summary TEXT,               -- 1-2문장 요약
    data_quality_score SMALLINT DEFAULT 0,   -- 0-100 (검진 데이터 완성도)
    has_discrepancy BOOLEAN DEFAULT FALSE,
    -- 시간
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- 유니크 제약 (upsert용)
    CONSTRAINT uq_chat_tags_session_partner UNIQUE (session_id, partner_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_tags_session ON welno.tb_chat_session_tags(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_tags_partner ON welno.tb_chat_session_tags(partner_id);
CREATE INDEX IF NOT EXISTS idx_chat_tags_interest ON welno.tb_chat_session_tags USING GIN(interest_tags);
CREATE INDEX IF NOT EXISTS idx_chat_tags_risk ON welno.tb_chat_session_tags USING GIN(risk_tags);
CREATE INDEX IF NOT EXISTS idx_chat_tags_created ON welno.tb_chat_session_tags(created_at DESC);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION welno.update_chat_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_tags_updated_at ON welno.tb_chat_session_tags;
CREATE TRIGGER trg_chat_tags_updated_at
    BEFORE UPDATE ON welno.tb_chat_session_tags
    FOR EACH ROW
    EXECUTE FUNCTION welno.update_chat_tags_updated_at();
