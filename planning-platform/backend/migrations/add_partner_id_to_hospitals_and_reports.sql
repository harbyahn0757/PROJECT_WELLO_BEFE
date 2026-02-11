-- 파트너 격리 완성: welno_hospitals, welno_mediarc_reports 테이블에 partner_id 컬럼 추가
-- 실행일: 2026-02-09
-- 목적: 병원과 리포트 데이터의 파트너별 격리 구현

BEGIN;

-- 1. welno_hospitals 테이블에 partner_id 컬럼 추가
ALTER TABLE welno.welno_hospitals 
ADD COLUMN partner_id VARCHAR(50) DEFAULT 'welno' NOT NULL;

-- 2. welno_mediarc_reports 테이블에 partner_id 컬럼 추가
ALTER TABLE welno.welno_mediarc_reports 
ADD COLUMN partner_id VARCHAR(50) DEFAULT 'welno' NOT NULL;

-- 3. 기존 데이터 마이그레이션 (기본값 'welno'로 설정)
-- welno_hospitals: 모든 기존 병원을 'welno' 파트너로 설정
UPDATE welno.welno_hospitals 
SET partner_id = 'welno' 
WHERE partner_id IS NULL;

-- welno_mediarc_reports: 모든 기존 리포트를 'welno' 파트너로 설정
UPDATE welno.welno_mediarc_reports 
SET partner_id = 'welno' 
WHERE partner_id IS NULL;

-- 4. 파트너별 복합 인덱스 생성

-- welno_hospitals 인덱스
CREATE INDEX IF NOT EXISTS idx_welno_hospitals_partner_id 
ON welno.welno_hospitals (partner_id);

CREATE INDEX IF NOT EXISTS idx_welno_hospitals_partner_hospital 
ON welno.welno_hospitals (partner_id, hospital_id);

CREATE INDEX IF NOT EXISTS idx_welno_hospitals_partner_active 
ON welno.welno_hospitals (partner_id, is_active) 
WHERE is_active = true;

-- welno_mediarc_reports 인덱스
CREATE INDEX IF NOT EXISTS idx_mediarc_reports_partner_id 
ON welno.welno_mediarc_reports (partner_id);

CREATE INDEX IF NOT EXISTS idx_mediarc_reports_partner_uuid 
ON welno.welno_mediarc_reports (partner_id, patient_uuid);

CREATE INDEX IF NOT EXISTS idx_mediarc_reports_partner_hospital 
ON welno.welno_mediarc_reports (partner_id, hospital_id);

CREATE INDEX IF NOT EXISTS idx_mediarc_reports_partner_created 
ON welno.welno_mediarc_reports (partner_id, created_at DESC);

-- 5. 기존 UNIQUE 제약조건 업데이트 (파트너별 격리 포함)
-- welno_mediarc_reports의 (patient_uuid, hospital_id) UNIQUE를 (partner_id, patient_uuid, hospital_id)로 변경

-- 기존 제약조건 확인 및 제거
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- 기존 UNIQUE 제약조건 찾기
    SELECT conname INTO constraint_name
    FROM pg_constraint 
    WHERE conrelid = 'welno.welno_mediarc_reports'::regclass 
    AND contype = 'u'
    AND array_length(conkey, 1) = 2;
    
    -- 제약조건이 존재하면 제거
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE welno.welno_mediarc_reports DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE '기존 UNIQUE 제약조건 % 제거됨', constraint_name;
    END IF;
END $$;

-- 새로운 파트너별 UNIQUE 제약조건 추가
ALTER TABLE welno.welno_mediarc_reports 
ADD CONSTRAINT uk_mediarc_reports_partner_uuid_hospital 
UNIQUE (partner_id, patient_uuid, hospital_id);

-- 6. 메디링스 파트너 특화 데이터 설정
-- 메디링스 관련 병원들을 'medilinx' 파트너로 설정
UPDATE welno.welno_hospitals 
SET partner_id = 'medilinx' 
WHERE hospital_name ILIKE '%메디링스%' 
   OR hospital_name ILIKE '%medilinx%'
   OR hospital_id IN (
       'KIM_HW_CLINIC',
       'CEBFB480143B6F24BEB0870567EBF05C9C3E6B2E8616461A9269E9C818D3F2B0'
   );

-- 메디링스 병원의 리포트들도 'medilinx' 파트너로 설정
UPDATE welno.welno_mediarc_reports 
SET partner_id = 'medilinx' 
WHERE hospital_id IN (
    SELECT hospital_id 
    FROM welno.welno_hospitals 
    WHERE partner_id = 'medilinx'
);

-- 7. 검증 쿼리
SELECT 'welno_hospitals 파트너별 분포' as table_name, partner_id, COUNT(*) as count
FROM welno.welno_hospitals 
GROUP BY partner_id
UNION ALL
SELECT 'welno_mediarc_reports 파트너별 분포', partner_id, COUNT(*)
FROM welno.welno_mediarc_reports 
GROUP BY partner_id
ORDER BY table_name, partner_id;

-- 8. 인덱스 생성 확인
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('welno_hospitals', 'welno_mediarc_reports')
    AND schemaname = 'welno'
    AND indexname LIKE '%partner%'
ORDER BY tablename, indexname;

COMMIT;

-- 마이그레이션 완료 메시지
SELECT '✅ 파트너 격리 마이그레이션 완료' as status,
       'welno_hospitals, welno_mediarc_reports 테이블에 partner_id 컬럼 추가 및 인덱스 생성 완료' as details;