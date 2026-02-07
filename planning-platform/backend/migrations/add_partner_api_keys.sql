-- 파트너 설정에 API Key 추가
-- 작성일: 2026-02-06
-- 목적: RAG 채팅 API 인증을 위한 API Key 관리

-- 기존 파트너 설정에 API Key 추가
UPDATE welno.tb_partner_config 
SET config = config || jsonb_build_object('api_key', 
    CASE 
        WHEN partner_id = 'kindhabit' THEN 'kh_' || encode(gen_random_bytes(16), 'hex')
        WHEN partner_id = 'medilinx' THEN 'ml_' || encode(gen_random_bytes(16), 'hex')
        ELSE 'pk_' || encode(gen_random_bytes(16), 'hex')
    END
)
WHERE config->>'api_key' IS NULL;

-- 테스트용 파트너 추가 (개발 환경용)
INSERT INTO welno.tb_partner_config (partner_id, partner_name, config, is_active) VALUES (
    'test_partner',
    'Test Partner',
    '{
        "payment": {
            "required": false,
            "amount": 0
        },
        "iframe": {
            "allowed": true,
            "domains": ["localhost", "127.0.0.1", "test.example.com"]
        },
        "encryption": {
            "aes_key": "test_partner_key_32_characters",
            "aes_iv": "test_iv_16_chars"
        },
        "api_key": "test_pk_12345678901234567890123456789012"
    }'::jsonb,
    true
) ON CONFLICT (partner_id) DO UPDATE SET
    config = EXCLUDED.config,
    updated_at = NOW();

-- API Key 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_partner_config_api_key 
ON welno.tb_partner_config USING GIN ((config->>'api_key'));

-- 조회 확인
SELECT 
    partner_id, 
    partner_name, 
    config->>'api_key' as api_key,
    config->'iframe'->>'allowed' as iframe_allowed,
    config->'iframe'->'domains' as allowed_domains,
    is_active 
FROM welno.tb_partner_config
ORDER BY partner_id;

-- API Key 검증 함수 테스트
-- SELECT partner_id, partner_name FROM welno.tb_partner_config WHERE config->>'api_key' = 'test_pk_12345678901234567890123456789012';