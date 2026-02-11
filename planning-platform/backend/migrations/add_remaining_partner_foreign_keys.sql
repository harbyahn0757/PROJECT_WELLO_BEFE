-- 나머지 테이블들에 partner_id 외래키 제약조건 추가
-- 실행일: 2026-02-09
-- 목적: 모든 partner_id 참조의 무결성 보장

BEGIN;

-- 1. 현재 외래키 제약조건 확인
SELECT 
    tc.table_name, 
    kcu.column_name, 
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'welno'
    AND kcu.column_name = 'partner_id'
ORDER BY tc.table_name;

-- 2. partner_id를 가진 테이블들 확인
SELECT 
    table_name,
    column_name,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'welno' 
    AND column_name = 'partner_id'
ORDER BY table_name;

-- 3. 데이터 정합성 사전 검증
-- welno_patients.partner_id 검증
SELECT 'welno_patients 참조 검증' as table_name,
       COUNT(*) as total_rows,
       COUNT(CASE WHEN partner_id IS NOT NULL THEN 1 END) as with_partner_id,
       COUNT(CASE WHEN partner_id IS NULL THEN 1 END) as null_partner_id
FROM welno.welno_patients;

-- tb_campaign_payments.partner_id 검증  
SELECT 'tb_campaign_payments 참조 검증' as table_name,
       COUNT(*) as total_rows,
       COUNT(CASE WHEN partner_id IS NOT NULL THEN 1 END) as with_partner_id,
       COUNT(CASE WHEN partner_id IS NULL THEN 1 END) as null_partner_id
FROM welno.tb_campaign_payments;

-- tb_hospital_rag_config.partner_id 검증
SELECT 'tb_hospital_rag_config 참조 검증' as table_name,
       COUNT(*) as total_rows,
       COUNT(CASE WHEN partner_id IS NOT NULL THEN 1 END) as with_partner_id,
       COUNT(CASE WHEN partner_id IS NULL THEN 1 END) as null_partner_id
FROM welno.tb_hospital_rag_config;

-- 4. NULL partner_id를 기본값으로 업데이트 (외래키 추가 전 필수)
-- welno_patients의 NULL partner_id를 'welno'로 설정
UPDATE welno.welno_patients 
SET partner_id = 'welno' 
WHERE partner_id IS NULL;

-- tb_campaign_payments의 NULL partner_id를 'welno'로 설정
UPDATE welno.tb_campaign_payments 
SET partner_id = 'welno' 
WHERE partner_id IS NULL;

-- tb_hospital_rag_config의 NULL partner_id를 'welno'로 설정
UPDATE welno.tb_hospital_rag_config 
SET partner_id = 'welno' 
WHERE partner_id IS NULL;

-- 5. 외래키 제약조건 추가

-- welno_patients.partner_id → tb_partner_config.partner_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'welno' 
        AND table_name = 'welno_patients' 
        AND constraint_name = 'fk_welno_patients_partner_id'
    ) THEN
        ALTER TABLE welno.welno_patients 
        ADD CONSTRAINT fk_welno_patients_partner_id 
        FOREIGN KEY (partner_id) REFERENCES welno.tb_partner_config(partner_id)
        ON DELETE RESTRICT ON UPDATE CASCADE;
        
        RAISE NOTICE '외래키 제약조건 추가: welno_patients.partner_id → tb_partner_config.partner_id';
    ELSE
        RAISE NOTICE '외래키 제약조건 이미 존재: fk_welno_patients_partner_id';
    END IF;
END $$;

-- tb_campaign_payments.partner_id → tb_partner_config.partner_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'welno' 
        AND table_name = 'tb_campaign_payments' 
        AND constraint_name = 'fk_tb_campaign_payments_partner_id'
    ) THEN
        ALTER TABLE welno.tb_campaign_payments 
        ADD CONSTRAINT fk_tb_campaign_payments_partner_id 
        FOREIGN KEY (partner_id) REFERENCES welno.tb_partner_config(partner_id)
        ON DELETE RESTRICT ON UPDATE CASCADE;
        
        RAISE NOTICE '외래키 제약조건 추가: tb_campaign_payments.partner_id → tb_partner_config.partner_id';
    ELSE
        RAISE NOTICE '외래키 제약조건 이미 존재: fk_tb_campaign_payments_partner_id';
    END IF;
END $$;

-- tb_hospital_rag_config.partner_id → tb_partner_config.partner_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'welno' 
        AND table_name = 'tb_hospital_rag_config' 
        AND constraint_name = 'fk_tb_hospital_rag_config_partner_id'
    ) THEN
        ALTER TABLE welno.tb_hospital_rag_config 
        ADD CONSTRAINT fk_tb_hospital_rag_config_partner_id 
        FOREIGN KEY (partner_id) REFERENCES welno.tb_partner_config(partner_id)
        ON DELETE RESTRICT ON UPDATE CASCADE;
        
        RAISE NOTICE '외래키 제약조건 추가: tb_hospital_rag_config.partner_id → tb_partner_config.partner_id';
    ELSE
        RAISE NOTICE '외래키 제약조건 이미 존재: fk_tb_hospital_rag_config_partner_id';
    END IF;
END $$;

-- 6. 최종 외래키 제약조건 확인
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
    AND kcu.column_name = 'partner_id'
ORDER BY tc.table_name;

-- 7. 데이터 정합성 최종 검증
SELECT 'welno_patients 최종 검증' as table_name,
       COUNT(*) as total_rows,
       COUNT(CASE WHEN partner_id IS NOT NULL THEN 1 END) as with_partner_id
FROM welno.welno_patients;

SELECT 'tb_campaign_payments 최종 검증' as table_name,
       COUNT(*) as total_rows,
       COUNT(CASE WHEN partner_id IS NOT NULL THEN 1 END) as with_partner_id
FROM welno.tb_campaign_payments;

SELECT 'tb_hospital_rag_config 최종 검증' as table_name,
       COUNT(*) as total_rows,
       COUNT(CASE WHEN partner_id IS NOT NULL THEN 1 END) as with_partner_id
FROM welno.tb_hospital_rag_config;

COMMIT;

-- 마이그레이션 완료 메시지
SELECT '✅ 파트너 외래키 제약조건 추가 완료' as status,
       '모든 partner_id 참조에 무결성 제약조건 적용됨' as details;