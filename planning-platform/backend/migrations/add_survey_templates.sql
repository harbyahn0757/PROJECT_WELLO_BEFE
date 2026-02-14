-- 동적 설문 템플릿 시스템 마이그레이션
-- 2026-02-13

-- 1. 설문 템플릿 마스터
CREATE TABLE IF NOT EXISTS welno.tb_survey_templates (
    id              SERIAL PRIMARY KEY,
    partner_id      VARCHAR(100) NOT NULL,
    hospital_id     VARCHAR(100) NOT NULL,
    template_name   VARCHAR(200) NOT NULL,
    description     TEXT DEFAULT '',
    is_active       BOOLEAN NOT NULL DEFAULT false,
    version         INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_template_active
    ON welno.tb_survey_templates (partner_id, hospital_id) WHERE is_active = true;

-- 2. 템플릿 질문 항목
CREATE TABLE IF NOT EXISTS welno.tb_survey_template_questions (
    id              SERIAL PRIMARY KEY,
    template_id     INTEGER NOT NULL REFERENCES welno.tb_survey_templates(id) ON DELETE CASCADE,
    question_key    VARCHAR(100) NOT NULL,
    question_label  VARCHAR(500) NOT NULL,
    question_type   VARCHAR(20) NOT NULL DEFAULT 'rating',
    is_required     BOOLEAN NOT NULL DEFAULT true,
    options         JSONB DEFAULT NULL,
    display_order   INTEGER NOT NULL DEFAULT 0,
    config          JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_survey_question_template ON welno.tb_survey_template_questions (template_id, display_order);

-- 3. 동적 설문 응답 (JSONB)
CREATE TABLE IF NOT EXISTS welno.tb_survey_responses_dynamic (
    id              SERIAL PRIMARY KEY,
    template_id     INTEGER NOT NULL REFERENCES welno.tb_survey_templates(id),
    partner_id      VARCHAR(100) NOT NULL,
    hospital_id     VARCHAR(100) NOT NULL,
    answers         JSONB NOT NULL,
    free_comment    TEXT DEFAULT '',
    respondent_uuid VARCHAR(200) DEFAULT NULL,
    user_agent      VARCHAR(500) DEFAULT NULL,
    ip_address      VARCHAR(45)  DEFAULT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_survey_dynamic_hospital ON welno.tb_survey_responses_dynamic (hospital_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_dynamic_template ON welno.tb_survey_responses_dynamic (template_id);
CREATE INDEX IF NOT EXISTS idx_survey_dynamic_answers_gin ON welno.tb_survey_responses_dynamic USING GIN (answers);
