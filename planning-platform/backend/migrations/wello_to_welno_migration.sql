-- wello → welno 스키마 통합 마이그레이션 스크립트
-- 생성일: 2025-01-XX
-- 목적: wello 스키마의 모든 테이블과 데이터를 welno 스키마로 통합

BEGIN;

-- ============================================
-- 1. wello 스키마의 테이블을 welno로 이동
-- ============================================

-- 1.1 wello.wello_checkup_design_requests → welno.welno_checkup_design_requests
-- (이미 welno에 존재할 수 있으므로 확인 후 처리)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'wello' AND table_name = 'wello_checkup_design_requests') THEN
        -- wello 데이터를 welno로 복사 (중복 제외)
        INSERT INTO welno.welno_checkup_design_requests 
        SELECT * FROM wello.wello_checkup_design_requests
        ON CONFLICT DO NOTHING;
        
        -- wello 테이블 삭제
        DROP TABLE IF EXISTS wello.wello_checkup_design_requests CASCADE;
    END IF;
END $$;

-- 1.2 wello.wello_external_checkup_items → welno.welno_external_checkup_items
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'wello' AND table_name = 'wello_external_checkup_items') THEN
        INSERT INTO welno.welno_external_checkup_items 
        SELECT * FROM wello.wello_external_checkup_items
        ON CONFLICT (item_name) DO NOTHING;
        
        DROP TABLE IF EXISTS wello.wello_external_checkup_items CASCADE;
    END IF;
END $$;

-- 1.3 wello.wello_hospital_external_checkup_mapping → welno.welno_hospital_external_checkup_mapping
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'wello' AND table_name = 'wello_hospital_external_checkup_mapping') THEN
        INSERT INTO welno.welno_hospital_external_checkup_mapping 
        SELECT * FROM wello.wello_hospital_external_checkup_mapping
        ON CONFLICT (hospital_id, external_checkup_item_id) DO NOTHING;
        
        DROP TABLE IF EXISTS wello.wello_hospital_external_checkup_mapping CASCADE;
    END IF;
END $$;

-- 1.4 wello.wello_hospitals → welno.welno_hospitals (병합)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'wello' AND table_name = 'wello_hospitals') THEN
        -- welno에 없는 병원만 추가
        INSERT INTO welno.welno_hospitals 
        SELECT * FROM wello.wello_hospitals w
        WHERE NOT EXISTS (
            SELECT 1 FROM welno.welno_hospitals n 
            WHERE n.hospital_id = w.hospital_id
        );
        
        -- welno에 이미 있는 병원은 업데이트 (필요한 경우)
        UPDATE welno.welno_hospitals n
        SET 
            hospital_name = COALESCE(w.hospital_name, n.hospital_name),
            checkup_items = COALESCE(w.checkup_items, n.checkup_items),
            national_checkup_items = COALESCE(w.national_checkup_items, n.national_checkup_items),
            recommended_items = COALESCE(w.recommended_items, n.recommended_items),
            updated_at = NOW()
        FROM wello.wello_hospitals w
        WHERE n.hospital_id = w.hospital_id;
        
        DROP TABLE IF EXISTS wello.wello_hospitals CASCADE;
    END IF;
END $$;

-- 1.5 wello_password_sessions 테이블 생성 (welno 스키마에)
CREATE TABLE IF NOT EXISTS welno.welno_password_sessions (
    id SERIAL PRIMARY KEY,
    patient_uuid VARCHAR(100) NOT NULL,
    hospital_id VARCHAR(50) NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_fingerprint VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_sessions_token ON welno.welno_password_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_password_sessions_patient ON welno.welno_password_sessions(patient_uuid, hospital_id);
CREATE INDEX IF NOT EXISTS idx_password_sessions_expires ON welno.welno_password_sessions(expires_at);

-- 1.6 wello_collection_history → welno.welno_collection_history
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'wello' AND table_name = 'wello_collection_history') THEN
        INSERT INTO welno.welno_collection_history 
        SELECT * FROM wello.wello_collection_history
        ON CONFLICT DO NOTHING;
        
        DROP TABLE IF EXISTS wello.wello_collection_history CASCADE;
    END IF;
END $$;

-- ============================================
-- 2. 설문 템플릿 관련 테이블 처리
-- ============================================
-- 설문 템플릿 관련 테이블들은 wello 스키마에 그대로 유지하거나
-- 필요시 welno로 이동할 수 있습니다.
-- 현재는 welno 스키마에 해당 테이블이 없으므로 유지

-- ============================================
-- 3. 외래키 및 인덱스 재생성 확인
-- ============================================
-- 마이그레이션 후 외래키 관계가 올바르게 설정되었는지 확인

COMMIT;

-- 마이그레이션 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ wello → welno 스키마 통합 마이그레이션 완료!';
    RAISE NOTICE '📊 다음 단계: 데이터 무결성 검증 및 테스트';
END $$;
