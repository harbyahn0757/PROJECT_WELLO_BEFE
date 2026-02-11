-- 파트너별 환자 관리 개선을 위한 복합 인덱스 추가
-- welno_patients 테이블에 성능 최적화 및 파트너 격리 강화

-- 1. 파트너별 UUID 조회 최적화 (가장 자주 사용되는 패턴)
CREATE INDEX IF NOT EXISTS idx_welno_patients_partner_uuid 
ON welno.welno_patients (partner_id, uuid);

-- 2. 파트너별 생성일 조회 최적화 (최근 환자 조회용)
CREATE INDEX IF NOT EXISTS idx_welno_patients_partner_created 
ON welno.welno_patients (partner_id, created_at DESC);

-- 3. 파트너별 약관 동의 상태 조회 최적화
CREATE INDEX IF NOT EXISTS idx_welno_patients_partner_terms 
ON welno.welno_patients (partner_id, terms_agreement);

-- 인덱스 생성 확인
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'welno_patients' 
    AND schemaname = 'welno'
    AND indexname LIKE 'idx_welno_patients_partner%'
ORDER BY indexname;