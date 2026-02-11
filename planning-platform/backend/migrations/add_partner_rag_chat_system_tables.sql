-- 1. 파트너 RAG 채팅 대화 로그 테이블 (튜닝 및 품질 분석용)
-- 목적: 파트너별·병원별 대화 기록 수집 (각 발화별 타임스탬프 포함)

CREATE TABLE IF NOT EXISTS welno.tb_partner_rag_chat_log (
    id BIGSERIAL PRIMARY KEY,
    partner_id VARCHAR(50) NOT NULL,
    hospital_id VARCHAR(255) NOT NULL,
    user_uuid VARCHAR(128) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    client_info JSONB, -- {ip, referer, user_agent}
    initial_data JSONB, -- 웜업 시 수신된 데이터 요약
    conversation JSONB NOT NULL DEFAULT '[]', -- [{role, content, timestamp}, ...]
    message_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_rag_log_session
    ON welno.tb_partner_rag_chat_log(partner_id, session_id);

CREATE INDEX IF NOT EXISTS idx_partner_rag_log_partner_hospital
    ON welno.tb_partner_rag_chat_log(partner_id, hospital_id);

-- 2. 병원별 RAG 및 LLM 설정 관리 테이블
-- 목적: 웰노/파트너 모드 분기 및 병원별 페르소나, 모델, UI 테마 설정

CREATE TABLE IF NOT EXISTS welno.tb_hospital_rag_config (
    id SERIAL PRIMARY KEY,
    partner_id VARCHAR(50) NOT NULL, -- 'welno'인 경우 기본 모드 설정
    hospital_id VARCHAR(255) NOT NULL, -- 병원별 식별자
    
    -- LLM 페르소나 및 프롬프트 설정
    persona_prompt TEXT, -- LLM의 역할/성격 정의 (System Role)
    welcome_message TEXT, -- 초기 맞춤형 인사말
    
    -- 기술 설정
    llm_config JSONB DEFAULT '{
        "model": "gemini-3-flash-preview",
        "temperature": 0.7,
        "max_tokens": 2000
    }',
    embedding_config JSONB DEFAULT '{
        "model": "text-embedding-ada-002",
        "index_name": "faiss_db"
    }',
    
    -- UI/테마 설정 (하드코딩 제거용)
    theme_config JSONB DEFAULT '{
        "theme": "default",
        "logo_url": null,
        "primary_color": "#7B5E4F"
    }',
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_partner_hospital UNIQUE (partner_id, hospital_id)
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION welno.update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_partner_rag_log_at ON welno.tb_partner_rag_chat_log;
CREATE TRIGGER trg_update_partner_rag_log_at
    BEFORE UPDATE ON welno.tb_partner_rag_chat_log
    FOR EACH ROW EXECUTE FUNCTION welno.update_timestamp_column();

DROP TRIGGER IF EXISTS trg_update_hospital_rag_config_at ON welno.tb_hospital_rag_config;
CREATE TRIGGER trg_update_hospital_rag_config_at
    BEFORE UPDATE ON welno.tb_hospital_rag_config
    FOR EACH ROW EXECUTE FUNCTION welno.update_timestamp_column();

-- 주석
COMMENT ON TABLE welno.tb_partner_rag_chat_log IS '파트너 RAG 채팅 대화 로그';
COMMENT ON TABLE welno.tb_hospital_rag_config IS '병원별 RAG/LLM 설정 관리 (페르소나 포함)';
