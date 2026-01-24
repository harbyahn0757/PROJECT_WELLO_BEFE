-- 파트너 설정 테이블 생성
-- 작성일: 2026-01-24
-- 목적: 파트너사별 결제, iframe, 암호화 정책 관리

-- 파트너 설정 테이블
CREATE TABLE IF NOT EXISTS welno.tb_partner_config (
    partner_id VARCHAR(50) PRIMARY KEY,
    partner_name VARCHAR(100) NOT NULL,
    config JSONB NOT NULL,  -- {"payment": {...}, "iframe": {...}, "encryption": {...}}
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- config JSONB 구조 예시:
-- {
--   "payment": {
--     "required": true,
--     "amount": 7900
--   },
--   "iframe": {
--     "allowed": false,
--     "domains": []
--   },
--   "encryption": {
--     "aes_key": "kindhabit_disease_predict_key_32",
--     "aes_iv": "kindhabit_iv_16 "
--   }
-- }

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_partner_config_active ON welno.tb_partner_config(is_active) WHERE is_active = true;

-- updated_at 트리거
CREATE OR REPLACE FUNCTION welno.update_partner_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_partner_config_updated_at ON welno.tb_partner_config;
CREATE TRIGGER trigger_update_partner_config_updated_at
    BEFORE UPDATE ON welno.tb_partner_config
    FOR EACH ROW
    EXECUTE FUNCTION welno.update_partner_config_updated_at();

-- 주석 추가
COMMENT ON TABLE welno.tb_partner_config IS '파트너사별 정책 설정 (결제, iframe, 암호화)';
COMMENT ON COLUMN welno.tb_partner_config.partner_id IS '파트너 ID (예: medilinx, kindhabit)';
COMMENT ON COLUMN welno.tb_partner_config.partner_name IS '파트너 표시명';
COMMENT ON COLUMN welno.tb_partner_config.config IS 'JSONB 설정 (payment, iframe, encryption)';
COMMENT ON COLUMN welno.tb_partner_config.is_active IS '활성 상태';

-- ============================================================================
-- 초기 데이터: 기존 파트너 등록
-- ============================================================================

-- 1. KindHabit (기존)
INSERT INTO welno.tb_partner_config (partner_id, partner_name, config, is_active) VALUES (
    'kindhabit',
    'KindHabit',
    '{
        "payment": {
            "required": true,
            "amount": 7900
        },
        "iframe": {
            "allowed": false,
            "domains": []
        },
        "encryption": {
            "aes_key": "kindhabit_disease_predict_key_32",
            "aes_iv": "kindhabit_iv_16 "
        }
    }'::jsonb,
    true
) ON CONFLICT (partner_id) DO UPDATE SET
    config = EXCLUDED.config,
    updated_at = NOW();

-- 2. MediLinx (신규)
INSERT INTO welno.tb_partner_config (partner_id, partner_name, config, is_active) VALUES (
    'medilinx',
    'MediLinx',
    '{
        "payment": {
            "required": true,
            "amount": 7900
        },
        "iframe": {
            "allowed": false,
            "domains": []
        },
        "encryption": {
            "aes_key": "medilinx_disease_predict_key_32",
            "aes_iv": "medilinx_iv_16 "
        }
    }'::jsonb,
    true
) ON CONFLICT (partner_id) DO UPDATE SET
    config = EXCLUDED.config,
    updated_at = NOW();

-- 조회 확인
SELECT partner_id, partner_name, config->>'payment' as payment_config, is_active 
FROM welno.tb_partner_config;
