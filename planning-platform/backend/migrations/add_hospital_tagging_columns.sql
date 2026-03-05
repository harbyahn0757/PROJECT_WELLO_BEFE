-- 병원 파트너용 태깅 컬럼 추가 (tb_chat_session_tags)
-- 기존 커머스/헬스케어 컬럼은 유지, 병원 전용 6개 추가

ALTER TABLE welno.tb_chat_session_tags
    ADD COLUMN IF NOT EXISTS medical_tags JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS lifestyle_tags JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS medical_urgency VARCHAR(20),
    ADD COLUMN IF NOT EXISTS anxiety_level VARCHAR(20),
    ADD COLUMN IF NOT EXISTS prospect_type VARCHAR(30),
    ADD COLUMN IF NOT EXISTS hospital_prospect_score SMALLINT;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_tags_prospect_type
    ON welno.tb_chat_session_tags(prospect_type);
CREATE INDEX IF NOT EXISTS idx_chat_tags_medical_urgency
    ON welno.tb_chat_session_tags(medical_urgency);
CREATE INDEX IF NOT EXISTS idx_chat_tags_hospital_score
    ON welno.tb_chat_session_tags(hospital_prospect_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_chat_tags_medical_tags
    ON welno.tb_chat_session_tags USING GIN(medical_tags);

COMMENT ON COLUMN welno.tb_chat_session_tags.medical_tags IS '의료 관심 태그 (혈압/당뇨/간 등) — 병원 파트너용';
COMMENT ON COLUMN welno.tb_chat_session_tags.lifestyle_tags IS '생활습관 태그 (다이어트/운동 등) — 병원 파트너용';
COMMENT ON COLUMN welno.tb_chat_session_tags.medical_urgency IS 'urgent/borderline/normal — 의료 긴급도';
COMMENT ON COLUMN welno.tb_chat_session_tags.anxiety_level IS 'high/medium/low — 환자 불안 수준';
COMMENT ON COLUMN welno.tb_chat_session_tags.prospect_type IS '병원 4분류: chronic_management/needs_visit/borderline_worried/lifestyle_improvable';
COMMENT ON COLUMN welno.tb_chat_session_tags.hospital_prospect_score IS '0-100 병원 가망 점수';
