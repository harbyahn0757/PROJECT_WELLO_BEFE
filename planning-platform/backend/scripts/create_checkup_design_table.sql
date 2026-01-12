-- 검진 설계 요청 테이블 생성
CREATE TABLE IF NOT EXISTS welno.welno_checkup_design_requests (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES welno.welno_patients(id) ON DELETE CASCADE,
    
    -- 선택한 염려 항목 (JSONB)
    selected_concerns JSONB NOT NULL,
    
    -- 설문 응답 (JSONB)
    survey_responses JSONB,
    
    -- 추가 고민사항 (텍스트)
    additional_concerns TEXT,
    
    -- 검진 설계 결과 (JSONB) - Perplexity/GPT 응답
    design_result JSONB,
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 검진 설계 요청 인덱스
CREATE INDEX IF NOT EXISTS idx_design_requests_patient ON welno.welno_checkup_design_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_design_requests_created ON welno.welno_checkup_design_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_design_requests_concerns ON welno.welno_checkup_design_requests USING GIN (selected_concerns);
CREATE INDEX IF NOT EXISTS idx_design_requests_survey ON welno.welno_checkup_design_requests USING GIN (survey_responses);

-- 트리거: updated_at 자동 업데이트
CREATE TRIGGER update_welno_checkup_design_requests_updated_at 
    BEFORE UPDATE ON welno.welno_checkup_design_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


