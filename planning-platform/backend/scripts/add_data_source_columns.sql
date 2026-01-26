-- WELNO 데이터 출처 추적 컬럼 추가 마이그레이션
-- 실행 순서: 1. 컬럼 추가 → 2. 인덱스 생성 → 3. 기존 데이터 업데이트

-- ==============================================
-- 1. welno_patients 테이블
-- ==============================================

-- 1-1. 컬럼 추가
ALTER TABLE welno.welno_patients 
ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'tilko' 
CHECK (data_source IN ('tilko', 'indexeddb', 'partner'));

ALTER TABLE welno.welno_patients 
ADD COLUMN IF NOT EXISTS last_indexeddb_sync_at TIMESTAMPTZ;

ALTER TABLE welno.welno_patients 
ADD COLUMN IF NOT EXISTS last_partner_sync_at TIMESTAMPTZ;

-- 1-2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_patients_data_source ON welno.welno_patients(data_source);

-- 1-3. 기존 데이터 업데이트 (NULL → 'tilko')
UPDATE welno.welno_patients 
SET data_source = 'tilko' 
WHERE data_source IS NULL;

-- ==============================================
-- 2. welno_checkup_data 테이블
-- ==============================================

-- 2-1. 컬럼 추가
ALTER TABLE welno.welno_checkup_data 
ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'tilko' 
CHECK (data_source IN ('tilko', 'indexeddb', 'partner'));

ALTER TABLE welno.welno_checkup_data 
ADD COLUMN IF NOT EXISTS indexeddb_synced_at TIMESTAMPTZ;

ALTER TABLE welno.welno_checkup_data 
ADD COLUMN IF NOT EXISTS partner_id VARCHAR(50);

ALTER TABLE welno.welno_checkup_data 
ADD COLUMN IF NOT EXISTS partner_oid VARCHAR(50);

-- 2-2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_checkup_data_source ON welno.welno_checkup_data(data_source);
CREATE INDEX IF NOT EXISTS idx_checkup_partner ON welno.welno_checkup_data(partner_id, partner_oid) WHERE partner_id IS NOT NULL;

-- 2-3. 기존 데이터 업데이트 (NULL → 'tilko')
UPDATE welno.welno_checkup_data 
SET data_source = 'tilko' 
WHERE data_source IS NULL;

-- ==============================================
-- 3. welno_prescription_data 테이블
-- ==============================================

-- 3-1. 컬럼 추가
ALTER TABLE welno.welno_prescription_data 
ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'tilko' 
CHECK (data_source IN ('tilko', 'indexeddb', 'partner'));

ALTER TABLE welno.welno_prescription_data 
ADD COLUMN IF NOT EXISTS indexeddb_synced_at TIMESTAMPTZ;

ALTER TABLE welno.welno_prescription_data 
ADD COLUMN IF NOT EXISTS partner_id VARCHAR(50);

ALTER TABLE welno.welno_prescription_data 
ADD COLUMN IF NOT EXISTS partner_oid VARCHAR(50);

-- 3-2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_prescription_data_source ON welno.welno_prescription_data(data_source);
CREATE INDEX IF NOT EXISTS idx_prescription_partner ON welno.welno_prescription_data(partner_id, partner_oid) WHERE partner_id IS NOT NULL;

-- 3-3. 기존 데이터 업데이트 (NULL → 'tilko')
UPDATE welno.welno_prescription_data 
SET data_source = 'tilko' 
WHERE data_source IS NULL;

-- ==============================================
-- 검증 쿼리
-- ==============================================

-- 컬럼 추가 확인
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'welno' 
  AND table_name IN ('welno_patients', 'welno_checkup_data', 'welno_prescription_data')
  AND column_name IN ('data_source', 'last_indexeddb_sync_at', 'last_partner_sync_at', 'partner_id', 'partner_oid', 'indexeddb_synced_at')
ORDER BY table_name, column_name;

-- 데이터 출처별 건수 확인
SELECT 'welno_patients' as table_name, data_source, COUNT(*) as count 
FROM welno.welno_patients 
GROUP BY data_source
UNION ALL
SELECT 'welno_checkup_data', data_source, COUNT(*) 
FROM welno.welno_checkup_data 
GROUP BY data_source
UNION ALL
SELECT 'welno_prescription_data', data_source, COUNT(*) 
FROM welno.welno_prescription_data 
GROUP BY data_source
ORDER BY table_name, data_source;
