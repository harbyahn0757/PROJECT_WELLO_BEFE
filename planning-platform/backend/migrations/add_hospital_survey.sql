-- 병원 만족도 설문조사 응답 테이블
CREATE TABLE IF NOT EXISTS welno.tb_hospital_survey_responses (
    id              SERIAL PRIMARY KEY,
    partner_id      VARCHAR(100) NOT NULL,
    hospital_id     VARCHAR(100) NOT NULL,
    reservation_process     SMALLINT NOT NULL CHECK (reservation_process BETWEEN 1 AND 5),
    facility_cleanliness    SMALLINT NOT NULL CHECK (facility_cleanliness BETWEEN 1 AND 5),
    staff_kindness          SMALLINT NOT NULL CHECK (staff_kindness BETWEEN 1 AND 5),
    waiting_time            SMALLINT NOT NULL CHECK (waiting_time BETWEEN 1 AND 5),
    overall_satisfaction    SMALLINT NOT NULL CHECK (overall_satisfaction BETWEEN 1 AND 5),
    free_comment    TEXT DEFAULT '',
    respondent_uuid VARCHAR(200) DEFAULT NULL,
    user_agent      VARCHAR(500) DEFAULT NULL,
    ip_address      VARCHAR(45)  DEFAULT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_hospital_created ON welno.tb_hospital_survey_responses (hospital_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_partner_hospital ON welno.tb_hospital_survey_responses (partner_id, hospital_id);
