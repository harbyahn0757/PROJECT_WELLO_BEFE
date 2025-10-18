-- WELLO 건강정보 데이터베이스 스키마
-- 생성일: 2025-10-18
-- 목적: Tilko API로 수집한 건강정보 저장 및 관리

-- 1. 환자 기본정보 테이블
CREATE TABLE IF NOT EXISTS wello_patients (
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
    last_data_update TIMESTAMPTZ,  -- 마지막 데이터 업데이트 시간
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 인덱스
    UNIQUE(uuid, hospital_id)
);

-- 2. 건강검진 데이터 테이블 (모든 필드 저장)
CREATE TABLE IF NOT EXISTS wello_checkup_data (
    -- 기본 식별자
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES wello_patients(id) ON DELETE CASCADE,
    
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
CREATE INDEX IF NOT EXISTS idx_checkup_patient_date ON wello_checkup_data(patient_id, year, checkup_date);
CREATE INDEX IF NOT EXISTS idx_checkup_location ON wello_checkup_data(location);
CREATE INDEX IF NOT EXISTS idx_checkup_code ON wello_checkup_data(code);
CREATE INDEX IF NOT EXISTS idx_checkup_raw_data ON wello_checkup_data USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_checkup_vital_signs ON wello_checkup_data(height, weight, bmi, blood_pressure_high, blood_pressure_low);

-- 3. 처방전 데이터 테이블 (모든 필드 저장)
CREATE TABLE IF NOT EXISTS wello_prescription_data (
    -- 기본 식별자
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES wello_patients(id) ON DELETE CASCADE,
    
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
CREATE INDEX IF NOT EXISTS idx_prescription_patient_date ON wello_prescription_data(patient_id, treatment_date);
CREATE INDEX IF NOT EXISTS idx_prescription_hospital ON wello_prescription_data(hospital_name);
CREATE INDEX IF NOT EXISTS idx_prescription_type ON wello_prescription_data(treatment_type);
CREATE INDEX IF NOT EXISTS idx_prescription_raw_data ON wello_prescription_data USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_prescription_counts ON wello_prescription_data(visit_count, prescription_count, medication_count);

-- 4. 데이터 수집 이력 테이블 (선택사항)
CREATE TABLE IF NOT EXISTS wello_collection_history (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES wello_patients(id) ON DELETE CASCADE,
    
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
CREATE INDEX IF NOT EXISTS idx_patients_uuid_hospital ON wello_patients(uuid, hospital_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON wello_patients(phone_number);
CREATE INDEX IF NOT EXISTS idx_patients_last_auth ON wello_patients(last_auth_at);

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_wello_patients_updated_at 
    BEFORE UPDATE ON wello_patients 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wello_checkup_data_updated_at 
    BEFORE UPDATE ON wello_checkup_data 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wello_prescription_data_updated_at 
    BEFORE UPDATE ON wello_prescription_data 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 샘플 데이터 (테스트용)
INSERT INTO wello_patients (uuid, hospital_id, name, phone_number, birth_date, gender) 
VALUES 
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'KHW001', '테스트환자', '01012345678', '1990-01-01', 'M')
ON CONFLICT (uuid, hospital_id) DO NOTHING;
