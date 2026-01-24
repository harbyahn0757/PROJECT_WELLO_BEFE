-- Campaign 결제 및 리포트 관리 테이블
-- 작성일: 2026-01-24
-- 목적: 질병예측 리포트 결제 및 외부 파트너 연동

-- Campaign Payments 테이블 생성
CREATE TABLE IF NOT EXISTS welno.tb_campaign_payments (
    -- 주문 정보
    oid VARCHAR(50) PRIMARY KEY,  -- 주문번호 (예: COCkkhabit_1737712345678)
    uuid VARCHAR(100) NOT NULL,  -- 파트너사 제공 사용자 식별자
    partner_id VARCHAR(50) DEFAULT 'kindhabit',  -- 파트너사 ID
    
    -- 사용자 정보
    user_name VARCHAR(100),  -- 사용자 이름 (복호화된 데이터)
    user_data JSONB,  -- 전체 사용자 건강 데이터 (JSON)
    email VARCHAR(255),  -- 이메일 주소
    
    -- 결제 정보
    amount INTEGER NOT NULL,  -- 결제 금액
    status VARCHAR(20) DEFAULT 'READY' CHECK (status IN ('READY', 'COMPLETED', 'FAILED', 'REFUNDED')),  -- 결제 상태
    tid VARCHAR(100),  -- 이니시스 거래번호
    payment_method VARCHAR(20),  -- 결제 수단 (CARD, VBANK 등)
    auth_date VARCHAR(20),  -- 승인일시
    error_message TEXT,  -- 에러 메시지
    
    -- 리포트 정보
    report_url TEXT,  -- 투비콘(Mediarc)에서 생성된 PDF 리포트 S3 주소
    mediarc_response JSONB,  -- Mediarc API 응답 전체 데이터
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),  -- 생성 시간
    updated_at TIMESTAMPTZ DEFAULT NOW()   -- 수정 시간
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_campaign_payments_uuid ON welno.tb_campaign_payments(uuid);
CREATE INDEX IF NOT EXISTS idx_campaign_payments_status ON welno.tb_campaign_payments(status);
CREATE INDEX IF NOT EXISTS idx_campaign_payments_partner ON welno.tb_campaign_payments(partner_id);
CREATE INDEX IF NOT EXISTS idx_campaign_payments_created ON welno.tb_campaign_payments(created_at);
CREATE INDEX IF NOT EXISTS idx_campaign_payments_email ON welno.tb_campaign_payments(email) WHERE email IS NOT NULL;

-- 주석 추가
COMMENT ON TABLE welno.tb_campaign_payments IS 'Campaign 결제 및 질병예측 리포트 관리 테이블';
COMMENT ON COLUMN welno.tb_campaign_payments.oid IS '주문번호 (Primary Key)';
COMMENT ON COLUMN welno.tb_campaign_payments.uuid IS '파트너사 제공 사용자 식별자';
COMMENT ON COLUMN welno.tb_campaign_payments.partner_id IS '파트너사 ID (기본값: kindhabit)';
COMMENT ON COLUMN welno.tb_campaign_payments.user_data IS '암호화 복호화된 건강 데이터 전체 (JSONB)';
COMMENT ON COLUMN welno.tb_campaign_payments.status IS '결제 상태 (READY/COMPLETED/FAILED/REFUNDED)';
COMMENT ON COLUMN welno.tb_campaign_payments.report_url IS '생성된 리포트 PDF S3 URL';
COMMENT ON COLUMN welno.tb_campaign_payments.mediarc_response IS 'Mediarc(투비콘) API 응답 데이터';

-- 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION welno.update_campaign_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 업데이트 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_campaign_payments_updated_at ON welno.tb_campaign_payments;
CREATE TRIGGER trigger_update_campaign_payments_updated_at
    BEFORE UPDATE ON welno.tb_campaign_payments
    FOR EACH ROW
    EXECUTE FUNCTION welno.update_campaign_payments_updated_at();
