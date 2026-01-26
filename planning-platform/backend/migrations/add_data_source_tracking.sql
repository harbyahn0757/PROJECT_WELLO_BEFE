-- 데이터 출처 추적 시스템 추가
-- 작성일: 2026-01-25
-- 목적: 데이터 출처(tilko, indexeddb, partner) 추적 및 동기화 시간 기록

-- 1. welno_patients 테이블에 데이터 출처 추적 컬럼 추가
ALTER TABLE welno.welno_patients 
ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'tilko' CHECK (data_source IN ('tilko', 'indexeddb', 'partner')),
ADD COLUMN IF NOT EXISTS last_indexeddb_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_partner_sync_at TIMESTAMPTZ;

COMMENT ON COLUMN welno.welno_patients.data_source IS '데이터 출처: tilko(직접수집), indexeddb(클라이언트업로드), partner(파트너사제공)';
COMMENT ON COLUMN welno.welno_patients.last_indexeddb_sync_at IS 'IndexedDB에서 마지막 동기화 시간';
COMMENT ON COLUMN welno.welno_patients.last_partner_sync_at IS '파트너사에서 마지막 동기화 시간';

-- 2. welno_checkup_data 테이블에 데이터 출처 추적 컬럼 추가
-- 주의: 실제 테이블에 patient_uuid 컬럼이 있는지 확인 필요 (스키마에는 patient_id만 있음)
-- 만약 patient_uuid가 없다면 patient_id를 통해 환자 정보를 조회해야 함
ALTER TABLE welno.welno_checkup_data 
ADD COLUMN IF NOT EXISTS patient_uuid VARCHAR(36),
ADD COLUMN IF NOT EXISTS hospital_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'tilko' CHECK (data_source IN ('tilko', 'indexeddb', 'partner')),
ADD COLUMN IF NOT EXISTS indexeddb_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS partner_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS partner_oid VARCHAR(50);

COMMENT ON COLUMN welno.welno_checkup_data.patient_uuid IS '환자 UUID (인덱싱 및 조회용)';
COMMENT ON COLUMN welno.welno_checkup_data.hospital_id IS '병원 ID (인덱싱 및 조회용)';
COMMENT ON COLUMN welno.welno_checkup_data.data_source IS '데이터 출처: tilko(직접수집), indexeddb(클라이언트업로드), partner(파트너사제공)';
COMMENT ON COLUMN welno.welno_checkup_data.indexeddb_synced_at IS 'IndexedDB에서 업로드된 시간';
COMMENT ON COLUMN welno.welno_checkup_data.partner_id IS '파트너사 ID (partner 출처인 경우)';
COMMENT ON COLUMN welno.welno_checkup_data.partner_oid IS '파트너사 주문번호 (partner 출처인 경우)';

-- 3. welno_prescription_data 테이블에 데이터 출처 추적 컬럼 추가
ALTER TABLE welno.welno_prescription_data 
ADD COLUMN IF NOT EXISTS patient_uuid VARCHAR(36),
ADD COLUMN IF NOT EXISTS hospital_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'tilko' CHECK (data_source IN ('tilko', 'indexeddb', 'partner')),
ADD COLUMN IF NOT EXISTS indexeddb_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS partner_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS partner_oid VARCHAR(50);

COMMENT ON COLUMN welno.welno_prescription_data.patient_uuid IS '환자 UUID (인덱싱 및 조회용)';
COMMENT ON COLUMN welno.welno_prescription_data.hospital_id IS '병원 ID (인덱싱 및 조회용)';
COMMENT ON COLUMN welno.welno_prescription_data.data_source IS '데이터 출처: tilko(직접수집), indexeddb(클라이언트업로드), partner(파트너사제공)';
COMMENT ON COLUMN welno.welno_prescription_data.indexeddb_synced_at IS 'IndexedDB에서 업로드된 시간';
COMMENT ON COLUMN welno.welno_prescription_data.partner_id IS '파트너사 ID (partner 출처인 경우)';
COMMENT ON COLUMN welno.welno_prescription_data.partner_oid IS '파트너사 주문번호 (partner 출처인 경우)';

-- 4. 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_checkup_data_source ON welno.welno_checkup_data(data_source);
CREATE INDEX IF NOT EXISTS idx_checkup_patient_uuid ON welno.welno_checkup_data(patient_uuid, hospital_id);
CREATE INDEX IF NOT EXISTS idx_checkup_partner ON welno.welno_checkup_data(partner_id, partner_oid) WHERE partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prescription_data_source ON welno.welno_prescription_data(data_source);
CREATE INDEX IF NOT EXISTS idx_prescription_patient_uuid ON welno.welno_prescription_data(patient_uuid, hospital_id);
CREATE INDEX IF NOT EXISTS idx_prescription_partner ON welno.welno_prescription_data(partner_id, partner_oid) WHERE partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patients_data_source ON welno.welno_patients(data_source);
