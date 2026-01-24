-- WELNO 건강정보 데이터베이스 스키마
-- 생성일: 2025-10-18
-- 목적: Tilko API로 수집한 건강정보 저장 및 관리

-- 1. 환자 기본정보 테이블
CREATE TABLE IF NOT EXISTS welno.welno_patients (
    -- 기본 식별자
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) UNIQUE NOT NULL,  -- URL 파라미터의 UUID
    hospital_id VARCHAR(20) NOT NULL,  -- URL 파라미터의 병원 ID
    
    -- 개인정보 (Tilko 인증 시 사용)
    name VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    birth_date DATE NOT NULL,
    gender CHAR(1) CHECK (gender IN ('M', 'F')),
    
    -- 인증 관련
    last_auth_at TIMESTAMPTZ,  -- 마지막 인증 시간
    tilko_session_id VARCHAR(100),  -- 마지막 Tilko 세션 ID
    
    -- 데이터 수집 상태
    has_health_data BOOLEAN DEFAULT FALSE,
    has_prescription_data BOOLEAN DEFAULT FALSE,
    has_mediarc_report BOOLEAN DEFAULT FALSE,  -- Mediarc 질병예측 리포트 존재 여부
    has_questionnaire_data BOOLEAN DEFAULT FALSE,  -- 문진 데이터 포함 여부
    last_data_update TIMESTAMPTZ,  -- 마지막 데이터 업데이트 시간
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 파트너/가입 출처 관련 플래그 추가
    registration_source VARCHAR(20) DEFAULT 'DIRECT', -- DIRECT, PARTNER, HOSPITAL 등
    partner_id VARCHAR(50), -- 가입 시 식별된 파트너 ID (예: medilinx)
    
    -- 인덱스
    UNIQUE(uuid, hospital_id)
);

-- 2. 건강검진 데이터 테이블 (모든 필드 저장)
CREATE TABLE IF NOT EXISTS welno.welno_checkup_data (
    -- 기본 식별자
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES welno.welno_patients(id) ON DELETE CASCADE,
    
    -- 원본 데이터 전체 저장 (JSON) - 메인 저장소
    raw_data JSONB NOT NULL,  -- Tilko API 원본 응답 전체 (Year, CheckUpDate, Code, Location, Description, Inspections 등 모든 필드)
    
    -- 자주 검색되는 필드만 별도 컬럼 (인덱싱용)
    year VARCHAR(10),  -- raw_data->>'Year'
    checkup_date VARCHAR(20),  -- raw_data->>'CheckUpDate'
    location VARCHAR(100),  -- raw_data->>'Location'
    code VARCHAR(20),  -- raw_data->>'Code'
    description TEXT,  -- raw_data->>'Description'
    
    -- 주요 검사 결과 (빠른 조회용) - Inspections 배열에서 추출
    height DECIMAL(5,2),  -- 신장 (cm)
    weight DECIMAL(5,2),  -- 체중 (kg)
    bmi DECIMAL(4,1),     -- 체질량지수 (kg/m2)
    waist_circumference DECIMAL(4,1),  -- 허리둘레 (cm)
    blood_pressure_high INTEGER,  -- 최고혈압 (mmHg)
    blood_pressure_low INTEGER,   -- 최저혈압 (mmHg)
    blood_sugar INTEGER,  -- 공복혈당 (mg/dL)
    cholesterol INTEGER,  -- 총콜레스테롤 (mg/dL)
    hdl_cholesterol INTEGER,  -- HDL 콜레스테롤 (mg/dL)
    ldl_cholesterol INTEGER,  -- LDL 콜레스테롤 (mg/dL)
    triglyceride INTEGER,  -- 중성지방 (mg/dL)
    hemoglobin DECIMAL(3,1),  -- 혈색소 (g/dL)
    
    -- 메타데이터
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 건강검진 데이터 인덱스
CREATE INDEX IF NOT EXISTS idx_checkup_patient_date ON welno.welno_checkup_data(patient_id, year, checkup_date);
CREATE INDEX IF NOT EXISTS idx_checkup_location ON welno.welno_checkup_data(location);
CREATE INDEX IF NOT EXISTS idx_checkup_code ON welno.welno_checkup_data(code);
CREATE INDEX IF NOT EXISTS idx_checkup_raw_data ON welno.welno_checkup_data USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_checkup_vital_signs ON welno.welno_checkup_data(height, weight, bmi, blood_pressure_high, blood_pressure_low);

-- 3. 처방전 데이터 테이블 (모든 필드 저장)
CREATE TABLE IF NOT EXISTS welno.welno_prescription_data (
    -- 기본 식별자
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES welno.welno_patients(id) ON DELETE CASCADE,
    
    -- 원본 데이터 전체 저장 (JSON) - 메인 저장소
    raw_data JSONB NOT NULL,  -- Tilko API 원본 응답 전체 (Idx, Page, ByungEuiwonYakGukMyung, Address, JinRyoGaesiIl, JinRyoHyungTae, BangMoonIpWonIlsoo, CheoBangHoiSoo, TuYakYoYangHoiSoo, RetrieveTreatmentInjectionInformationPersonDetailList 등 모든 필드)
    
    -- 자주 검색되는 필드만 별도 컬럼 (인덱싱용)
    idx VARCHAR(10),  -- raw_data->>'Idx'
    page VARCHAR(10), -- raw_data->>'Page'
    hospital_name VARCHAR(100),  -- raw_data->>'ByungEuiwonYakGukMyung'
    address VARCHAR(200),  -- raw_data->>'Address'
    treatment_date DATE,  -- raw_data->>'JinRyoGaesiIl'
    treatment_type VARCHAR(50),  -- raw_data->>'JinRyoHyungTae'
    visit_count INTEGER,  -- raw_data->>'BangMoonIpWonIlsoo'
    prescription_count INTEGER,  -- raw_data->>'CheoBangHoiSoo'
    medication_count INTEGER,  -- raw_data->>'TuYakYoYangHoiSoo'
    
    -- 처방 상세 정보 (RetrieveTreatmentInjectionInformationPersonDetailList 배열 길이)
    detail_records_count INTEGER DEFAULT 0,
    
    -- 메타데이터
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 처방전 데이터 인덱스
CREATE INDEX IF NOT EXISTS idx_prescription_patient_date ON welno.welno_prescription_data(patient_id, treatment_date);
CREATE INDEX IF NOT EXISTS idx_prescription_hospital ON welno.welno_prescription_data(hospital_name);
CREATE INDEX IF NOT EXISTS idx_prescription_type ON welno.welno_prescription_data(treatment_type);
CREATE INDEX IF NOT EXISTS idx_prescription_raw_data ON welno.welno_prescription_data USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_prescription_counts ON welno.welno_prescription_data(visit_count, prescription_count, medication_count);

-- 3-1. Mediarc 질병예측 리포트 테이블
CREATE TABLE IF NOT EXISTS welno.welno_mediarc_reports (
    -- 기본 식별자
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES welno.welno_patients(id) ON DELETE CASCADE,
    patient_uuid VARCHAR(36) NOT NULL,
    hospital_id VARCHAR(20) NOT NULL,
    
    -- 원본 응답 전체 저장 (JSONB) - 메인 저장소
    raw_response JSONB NOT NULL,  -- Mediarc/Twobecon API 원본 응답 전체
    
    -- 자주 사용되는 필드 (빠른 조회용)
    mkt_uuid VARCHAR(50) UNIQUE,  -- 마케팅 UUID (BNR 캠페인 ID)
    report_url TEXT,  -- PDF 리포트 URL
    provider VARCHAR(20) DEFAULT 'twobecon',  -- 제공자 (twobecon, mediarc 등)
    
    -- 분석 결과 핵심 정보
    analyzed_at TIMESTAMPTZ,  -- 분석 완료 시각
    bodyage INTEGER,  -- 체질 나이 (건강 나이)
    rank INTEGER,  -- 등수 (상위 몇%)
    
    -- 질병 및 암 예측 데이터 (JSONB)
    disease_data JSONB,  -- 질병 예측 결과 (name, score, label 등)
    cancer_data JSONB,  -- 암 예측 결과 (name, score, label 등)
    
    -- 문진 데이터 포함 여부
    has_questionnaire BOOLEAN DEFAULT FALSE,
    questionnaire_data JSONB,  -- 문진 응답 데이터 (drink, smoke, family, disease, cancer)
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 인덱스 및 제약조건
    UNIQUE(patient_uuid, hospital_id)  -- 환자별 최신 리포트만 저장
);

-- Mediarc 리포트 인덱스
CREATE INDEX IF NOT EXISTS idx_mediarc_patient ON welno.welno_mediarc_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_mediarc_uuid ON welno.welno_mediarc_reports(mkt_uuid);
CREATE INDEX IF NOT EXISTS idx_mediarc_analyzed ON welno.welno_mediarc_reports(analyzed_at);
CREATE INDEX IF NOT EXISTS idx_mediarc_raw ON welno.welno_mediarc_reports USING GIN (raw_response);
CREATE INDEX IF NOT EXISTS idx_mediarc_disease ON welno.welno_mediarc_reports USING GIN (disease_data);
CREATE INDEX IF NOT EXISTS idx_mediarc_cancer ON welno.welno_mediarc_reports USING GIN (cancer_data);

-- Mediarc 리포트 updated_at 트리거
CREATE TRIGGER update_welno_mediarc_reports_updated_at 
    BEFORE UPDATE ON welno.welno_mediarc_reports 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. 데이터 수집 이력 테이블 (선택사항)
CREATE TABLE IF NOT EXISTS welno.welno_collection_history (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES welno.welno_patients(id) ON DELETE CASCADE,
    
    -- 수집 정보
    collection_type VARCHAR(20) CHECK (collection_type IN ('health', 'prescription', 'both')),
    tilko_session_id VARCHAR(100),
    
    -- 수집 결과
    success BOOLEAN DEFAULT FALSE,
    health_records_count INTEGER DEFAULT 0,
    prescription_records_count INTEGER DEFAULT 0,
    error_message TEXT,
    
    -- 메타데이터
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- 인덱스
    INDEX idx_collection_patient (patient_id),
    INDEX idx_collection_session (tilko_session_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_patients_uuid_hospital ON welno.welno_patients(uuid, hospital_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON welno.welno_patients(phone_number);
CREATE INDEX IF NOT EXISTS idx_patients_last_auth ON welno.welno_patients(last_auth_at);

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_welno_patients_updated_at 
    BEFORE UPDATE ON welno.welno_patients 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_welno_checkup_data_updated_at 
    BEFORE UPDATE ON welno.welno_checkup_data 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_welno_prescription_data_updated_at 
    BEFORE UPDATE ON welno.welno_prescription_data 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. 검진 설계 요청 테이블 (업셀링용 데이터 저장)
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

-- 샘플 데이터 (테스트용)
INSERT INTO welno.welno_patients (uuid, hospital_id, name, phone_number, birth_date, gender) 
VALUES 
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'KHW001', '테스트환자', '01012345678', '1990-01-01', 'M')
ON CONFLICT (uuid, hospital_id) DO NOTHING;
