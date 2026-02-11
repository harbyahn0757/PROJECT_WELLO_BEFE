-- 파트너별 클라이언트 관리 개선을 위한 복합 인덱스 추가
-- tb_campaign_payments 테이블에 성능 최적화 및 파트너 격리 강화

-- 1. 파트너별 UUID 조회 최적화 (가장 자주 사용되는 패턴)
CREATE INDEX IF NOT EXISTS idx_campaign_payments_partner_uuid 
ON welno.tb_campaign_payments (partner_id, uuid);

-- 2. 파트너별 상태 조회 최적화 (리포트 생성 상태 확인용)
CREATE INDEX IF NOT EXISTS idx_campaign_payments_partner_status 
ON welno.tb_campaign_payments (partner_id, status);

-- 3. 파트너별 생성일 조회 최적화 (최근 주문 조회용)
CREATE INDEX IF NOT EXISTS idx_campaign_payments_partner_created 
ON welno.tb_campaign_payments (partner_id, created_at DESC);

-- 4. 파트너별 UUID + 상태 복합 조회 최적화 (완료된 주문 조회용)
CREATE INDEX IF NOT EXISTS idx_campaign_payments_partner_uuid_status 
ON welno.tb_campaign_payments (partner_id, uuid, status);

-- 5. 파트너별 파이프라인 단계 조회 최적화 (진행 상황 추적용)
CREATE INDEX IF NOT EXISTS idx_campaign_payments_partner_pipeline 
ON welno.tb_campaign_payments (partner_id, pipeline_step);

-- 인덱스 생성 확인
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'tb_campaign_payments' 
    AND schemaname = 'welno'
    AND indexname LIKE 'idx_campaign_payments_partner%'
ORDER BY indexname;