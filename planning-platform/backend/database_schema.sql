-- 웰노 통합 데이터베이스 스키마
-- 생성일: 2026-02-09
-- 설명: 모든 웰노 관련 테이블을 welno 스키마로 통합

CREATE SCHEMA IF NOT EXISTS welno;

-- 1. 파트너 설정 테이블
CREATE TABLE IF NOT EXISTS welno.tb_partner_config (
    partner_id VARCHAR(50) PRIMARY KEY,
    partner_name VARCHAR(100) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. 병원 RAG 설정 테이블
CREATE TABLE IF NOT EXISTS welno.tb_hospital_rag_config (
    id SERIAL PRIMARY KEY,
    partner_id VARCHAR(50) NOT NULL,
    hospital_id VARCHAR(255) NOT NULL,
    hospital_name VARCHAR(200),
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(partner_id, hospital_id),
    FOREIGN KEY (partner_id) REFERENCES welno.tb_partner_config(partner_id)
);

-- 3. 병원 정보 테이블
CREATE TABLE IF NOT EXISTS welno.welno_hospitals (
    hospital_id VARCHAR(255) PRIMARY KEY,
    partner_id VARCHAR(50) DEFAULT 'welno' NOT NULL,
    hospital_name VARCHAR(200),
    hospital_code VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    FOREIGN KEY (partner_id) REFERENCES welno.tb_partner_config(partner_id)
);

-- 4. 환자 기본정보 테이블
CREATE TABLE IF NOT EXISTS welno.welno_patients (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) UNIQUE NOT NULL,
    hospital_id VARCHAR(255) NOT NULL,
    partner_id VARCHAR(50) DEFAULT 'welno' NOT NULL,
    name VARCHAR(100),
    birth_date DATE,
    gender CHAR(1),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    FOREIGN KEY (hospital_id) REFERENCES welno.welno_hospitals(hospital_id),
    FOREIGN KEY (partner_id) REFERENCES welno.tb_partner_config(partner_id)
);

-- 5. 건강검진 데이터 테이블
CREATE TABLE IF NOT EXISTS welno.welno_checkup_data (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES welno.welno_patients(id) ON DELETE CASCADE,
    checkup_date DATE,
    height DECIMAL(5,2),
    weight DECIMAL(5,2),
    bmi DECIMAL(5,2),
    systolic_bp INTEGER,
    diastolic_bp INTEGER,
    blood_sugar INTEGER,
    cholesterol INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. 처방전 데이터 테이블
CREATE TABLE IF NOT EXISTS welno.welno_prescription_data (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES welno.welno_patients(id) ON DELETE CASCADE,
    prescription_date DATE,
    doctor_name VARCHAR(100),
    hospital_name VARCHAR(200),
    medication_name VARCHAR(200),
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    duration_days INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. 메디아크 리포트 테이블
CREATE TABLE IF NOT EXISTS welno.welno_mediarc_reports (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES welno.welno_patients(id) ON DELETE CASCADE,
    hospital_id VARCHAR(255) NOT NULL,
    partner_id VARCHAR(50) DEFAULT 'welno' NOT NULL,
    bodyage INTEGER,
    report_data JSONB,
    analyzed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(patient_id, hospital_id, partner_id),
    FOREIGN KEY (hospital_id) REFERENCES welno.welno_hospitals(hospital_id),
    FOREIGN KEY (partner_id) REFERENCES welno.tb_partner_config(partner_id)
);

-- 8. 캠페인 결제 테이블 (통합)
CREATE TABLE IF NOT EXISTS welno.tb_campaign_payments (
    oid VARCHAR(50) PRIMARY KEY,
    uuid VARCHAR(100) NOT NULL,
    partner_id VARCHAR(50) DEFAULT 'kindhabit',
    user_name VARCHAR(100),
    user_data JSONB,
    email VARCHAR(255),
    amount INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'READY',
    tid VARCHAR(100),
    payment_method VARCHAR(20),
    auth_date VARCHAR(20),
    error_message TEXT,
    report_url TEXT,
    mediarc_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    pipeline_step VARCHAR(30) DEFAULT 'INIT',
    tilko_session_id VARCHAR(100),
    remarks TEXT,
    test_mode BOOLEAN DEFAULT false,
    FOREIGN KEY (partner_id) REFERENCES welno.tb_partner_config(partner_id)
);

-- 9. 데이터 수집 이력 테이블 (통합)
CREATE TABLE IF NOT EXISTS welno.welno_collection_history (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER,
    collection_type VARCHAR(20),
    tilko_session_id VARCHAR(100),
    success BOOLEAN DEFAULT false,
    health_records_count INTEGER DEFAULT 0,
    prescription_records_count INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (patient_id) REFERENCES welno.welno_patients(id) ON DELETE CASCADE
);

-- 10. 검진 설계 요청 테이블
CREATE TABLE IF NOT EXISTS welno.welno_checkup_design_requests (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES welno.welno_patients(id) ON DELETE CASCADE,
    request_data JSONB,
    response_data JSONB,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 11. 외부 검진 항목 테이블
CREATE TABLE IF NOT EXISTS welno.welno_external_checkup_items (
    id SERIAL PRIMARY KEY,
    item_code VARCHAR(50) UNIQUE NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 12. 병원-외부검진 매핑 테이블
CREATE TABLE IF NOT EXISTS welno.welno_hospital_external_checkup_mapping (
    id SERIAL PRIMARY KEY,
    hospital_id VARCHAR(255) NOT NULL,
    external_item_id INTEGER NOT NULL,
    hospital_item_code VARCHAR(100),
    hospital_item_name VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    FOREIGN KEY (hospital_id) REFERENCES welno.welno_hospitals(hospital_id),
    FOREIGN KEY (external_item_id) REFERENCES welno.welno_external_checkup_items(id)
);

-- 13. 비밀번호 세션 테이블
CREATE TABLE IF NOT EXISTS welno.welno_password_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    user_data JSONB,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 14. 파트너 RAG 채팅 로그 테이블
CREATE TABLE IF NOT EXISTS welno.tb_partner_rag_chat_log (
    id SERIAL PRIMARY KEY,
    partner_id VARCHAR(50) NOT NULL,
    hospital_id VARCHAR(255),
    user_id VARCHAR(100),
    session_id VARCHAR(100),
    message_type VARCHAR(20), -- 'user', 'assistant', 'system'
    message_content TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    FOREIGN KEY (partner_id) REFERENCES welno.tb_partner_config(partner_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_welno_patients_uuid ON welno.welno_patients(uuid);
CREATE INDEX IF NOT EXISTS idx_welno_patients_hospital_id ON welno.welno_patients(hospital_id);
CREATE INDEX IF NOT EXISTS idx_welno_patients_partner_id ON welno.welno_patients(partner_id);
CREATE INDEX IF NOT EXISTS idx_tb_campaign_payments_uuid ON welno.tb_campaign_payments(uuid);
CREATE INDEX IF NOT EXISTS idx_tb_campaign_payments_partner_id ON welno.tb_campaign_payments(partner_id);
CREATE INDEX IF NOT EXISTS idx_welno_mediarc_reports_patient_hospital_partner ON welno.welno_mediarc_reports(patient_id, hospital_id, partner_id);
CREATE INDEX IF NOT EXISTS idx_tb_hospital_rag_config_partner_hospital ON welno.tb_hospital_rag_config(partner_id, hospital_id);
CREATE INDEX IF NOT EXISTS idx_welno_collection_history_patient_id ON welno.welno_collection_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_welno_collection_history_tilko_session_id ON welno.welno_collection_history(tilko_session_id);

-- 코멘트 추가
COMMENT ON SCHEMA welno IS '웰노 통합 스키마 - 모든 웰노 관련 테이블 통합 관리';
COMMENT ON TABLE welno.tb_partner_config IS '파트너 설정 정보 (결제, 암호화, RAG 등 모든 설정 통합)';
COMMENT ON TABLE welno.tb_hospital_rag_config IS '병원별 RAG 채팅 설정 (LLM 페르소나, 테마, 환영메시지 등)';
COMMENT ON TABLE welno.tb_campaign_payments IS '캠페인 결제 정보 (3개 테이블 통합: welno, p9_mkt_biz, public)';
COMMENT ON TABLE welno.welno_collection_history IS '데이터 수집 이력 (public.wello_collection_history에서 이동)';