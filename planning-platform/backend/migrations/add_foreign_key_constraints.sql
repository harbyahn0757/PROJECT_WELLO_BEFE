-- 데이터 무결성 강화: 외래키 제약조건 추가
-- 실행일: 2026-02-09
-- 목적: 테이블 간 참조 무결성 보장

BEGIN;

-- 1. 현재 외래키 제약조건 확인
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'welno'
    AND tc.table_name IN ('welno_patients', 'welno_mediarc_reports', 'tb_hospital_rag_config')
ORDER BY tc.table_name, kcu.column_name;

-- 2. 데이터 정합성 검증 (외래키 추가 전 검증)

-- welno_patients.hospital_id → welno_hospitals.hospital_id 검증
SELECT 'welno_patients 참조 무결성 검증' as check_name,
       COUNT(*) as invalid_references
FROM welno.welno_patients p
LEFT JOIN welno.welno_hospitals h ON p.hospital_id = h.hospital_id
WHERE h.hospital_id IS NULL;

-- welno_mediarc_reports.hospital_id → welno_hospitals.hospital_id 검증
SELECT 'welno_mediarc_reports 참조 무결성 검증' as check_name,
       COUNT(*) as invalid_references
FROM welno.welno_mediarc_reports r
LEFT JOIN welno.welno_hospitals h ON r.hospital_id = h.hospital_id
WHERE h.hospital_id IS NULL;

-- tb_hospital_rag_config.hospital_id → welno_hospitals.hospital_id 검증
SELECT 'tb_hospital_rag_config 참조 무결성 검증' as check_name,
       COUNT(*) as invalid_references
FROM welno.tb_hospital_rag_config c
LEFT JOIN welno.welno_hospitals h ON c.hospital_id = h.hospital_id
WHERE h.hospital_id IS NULL;

-- 3. 누락된 병원 데이터 추가 (참조 무결성 위반 방지)

-- welno_patients에서 참조하는 병원이 welno_hospitals에 없는 경우 추가
INSERT INTO welno.welno_hospitals (hospital_id, hospital_name, partner_id)
SELECT DISTINCT 
    p.hospital_id,
    '병원_' || p.hospital_id as hospital_name,
    COALESCE(p.partner_id, 'welno') as partner_id
FROM welno.welno_patients p
LEFT JOIN welno.welno_hospitals h ON p.hospital_id = h.hospital_id
WHERE h.hospital_id IS NULL
ON CONFLICT (hospital_id) DO NOTHING;

-- welno_mediarc_reports에서 참조하는 병원이 welno_hospitals에 없는 경우 추가
INSERT INTO welno.welno_hospitals (hospital_id, hospital_name, partner_id)
SELECT DISTINCT 
    r.hospital_id,
    '병원_' || r.hospital_id as hospital_name,
    r.partner_id
FROM welno.welno_mediarc_reports r
LEFT JOIN welno.welno_hospitals h ON r.hospital_id = h.hospital_id
WHERE h.hospital_id IS NULL
ON CONFLICT (hospital_id) DO NOTHING;

-- tb_hospital_rag_config에서 참조하는 병원이 welno_hospitals에 없는 경우 추가
INSERT INTO welno.welno_hospitals (hospital_id, hospital_name, partner_id)
SELECT DISTINCT 
    c.hospital_id,
    COALESCE(c.hospital_name, '병원_' || c.hospital_id) as hospital_name,
    c.partner_id
FROM welno.tb_hospital_rag_config c
LEFT JOIN welno.welno_hospitals h ON c.hospital_id = h.hospital_id
WHERE h.hospital_id IS NULL
ON CONFLICT (hospital_id) DO NOTHING;

-- 4. 외래키 제약조건 추가

-- welno_patients.hospital_id → welno_hospitals.hospital_id
DO $$
BEGIN
    -- 기존 외래키가 있는지 확인
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'welno' 
        AND table_name = 'welno_patients' 
        AND constraint_name = 'fk_welno_patients_hospital_id'
    ) THEN
        ALTER TABLE welno.welno_patients 
        ADD CONSTRAINT fk_welno_patients_hospital_id 
        FOREIGN KEY (hospital_id) REFERENCES welno.welno_hospitals(hospital_id)
        ON DELETE RESTRICT ON UPDATE CASCADE;
        
        RAISE NOTICE '외래키 제약조건 추가: welno_patients.hospital_id → welno_hospitals.hospital_id';
    ELSE
        RAISE NOTICE '외래키 제약조건 이미 존재: fk_welno_patients_hospital_id';
    END IF;
END $$;

-- welno_mediarc_reports.hospital_id → welno_hospitals.hospital_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'welno' 
        AND table_name = 'welno_mediarc_reports' 
        AND constraint_name = 'fk_welno_mediarc_reports_hospital_id'
    ) THEN
        ALTER TABLE welno.welno_mediarc_reports 
        ADD CONSTRAINT fk_welno_mediarc_reports_hospital_id 
        FOREIGN KEY (hospital_id) REFERENCES welno.welno_hospitals(hospital_id)
        ON DELETE RESTRICT ON UPDATE CASCADE;
        
        RAISE NOTICE '외래키 제약조건 추가: welno_mediarc_reports.hospital_id → welno_hospitals.hospital_id';
    ELSE
        RAISE NOTICE '외래키 제약조건 이미 존재: fk_welno_mediarc_reports_hospital_id';
    END IF;
END $$;

-- tb_hospital_rag_config.hospital_id → welno_hospitals.hospital_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'welno' 
        AND table_name = 'tb_hospital_rag_config' 
        AND constraint_name = 'fk_tb_hospital_rag_config_hospital_id'
    ) THEN
        ALTER TABLE welno.tb_hospital_rag_config 
        ADD CONSTRAINT fk_tb_hospital_rag_config_hospital_id 
        FOREIGN KEY (hospital_id) REFERENCES welno.welno_hospitals(hospital_id)
        ON DELETE RESTRICT ON UPDATE CASCADE;
        
        RAISE NOTICE '외래키 제약조건 추가: tb_hospital_rag_config.hospital_id → welno_hospitals.hospital_id';
    ELSE
        RAISE NOTICE '외래키 제약조건 이미 존재: fk_tb_hospital_rag_config_hospital_id';
    END IF;
END $$;

-- 5. 파트너 참조 무결성 확인 (선택적)
-- tb_partner_config 테이블이 있다면 partner_id 외래키도 추가할 수 있음
DO $$
BEGIN
    -- tb_partner_config 테이블 존재 확인
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'welno' AND table_name = 'tb_partner_config'
    ) THEN
        -- welno_hospitals.partner_id → tb_partner_config.partner_id
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'welno' 
            AND table_name = 'welno_hospitals' 
            AND constraint_name = 'fk_welno_hospitals_partner_id'
        ) THEN
            ALTER TABLE welno.welno_hospitals 
            ADD CONSTRAINT fk_welno_hospitals_partner_id 
            FOREIGN KEY (partner_id) REFERENCES welno.tb_partner_config(partner_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
            
            RAISE NOTICE '외래키 제약조건 추가: welno_hospitals.partner_id → tb_partner_config.partner_id';
        END IF;
        
        -- welno_mediarc_reports.partner_id → tb_partner_config.partner_id
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'welno' 
            AND table_name = 'welno_mediarc_reports' 
            AND constraint_name = 'fk_welno_mediarc_reports_partner_id'
        ) THEN
            ALTER TABLE welno.welno_mediarc_reports 
            ADD CONSTRAINT fk_welno_mediarc_reports_partner_id 
            FOREIGN KEY (partner_id) REFERENCES welno.tb_partner_config(partner_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
            
            RAISE NOTICE '외래키 제약조건 추가: welno_mediarc_reports.partner_id → tb_partner_config.partner_id';
        END IF;
    ELSE
        RAISE NOTICE 'tb_partner_config 테이블이 존재하지 않아 파트너 외래키 제약조건을 추가하지 않음';
    END IF;
END $$;

-- 6. 최종 검증
SELECT 'welno_patients 참조 무결성 재검증' as check_name,
       COUNT(*) as invalid_references
FROM welno.welno_patients p
LEFT JOIN welno.welno_hospitals h ON p.hospital_id = h.hospital_id
WHERE h.hospital_id IS NULL;

SELECT 'welno_mediarc_reports 참조 무결성 재검증' as check_name,
       COUNT(*) as invalid_references
FROM welno.welno_mediarc_reports r
LEFT JOIN welno.welno_hospitals h ON r.hospital_id = h.hospital_id
WHERE h.hospital_id IS NULL;

-- 7. 추가된 외래키 제약조건 확인
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'welno'
    AND tc.table_name IN ('welno_patients', 'welno_mediarc_reports', 'tb_hospital_rag_config', 'welno_hospitals')
ORDER BY tc.table_name, kcu.column_name;

COMMIT;

-- 마이그레이션 완료 메시지
SELECT '✅ 외래키 제약조건 마이그레이션 완료' as status,
       '데이터 참조 무결성이 보장됩니다' as details;