-- 파트너 설정에 Mediarc 및 기본 병원 설정 추가
-- 작성일: 2026-02-09
-- 목적: 하드코딩 제거를 위한 파트너별 동적 설정 강화

-- 1. 기존 파트너들에 Mediarc 설정 추가
UPDATE welno.tb_partner_config 
SET config = config || jsonb_build_object(
    'mediarc', jsonb_build_object(
        'enabled', true,
        'api_url', 'https://xogxog.com/api/external/mediarc/report/',
        'api_key', CASE 
            WHEN partner_id = 'welno' THEN 'welno_5a9bb40b5108ecd8ef864658d5a2d5ab'
            WHEN partner_id = 'medilinx' THEN 'medilinx_api_key_placeholder'
            WHEN partner_id = 'kindhabit' THEN 'kindhabit_api_key_placeholder'
            ELSE 'default_api_key_placeholder'
        END
    ),
    'default_hospital_id', CASE
        WHEN partner_id = 'welno' THEN 'PEERNINE'
        WHEN partner_id = 'medilinx' THEN 'KIM_HW_CLINIC'
        ELSE 'PEERNINE'
    END
)
WHERE partner_id IN ('welno', 'medilinx', 'kindhabit', 'welno_internal');

-- 2. welno 파트너가 없는 경우 생성
INSERT INTO welno.tb_partner_config (partner_id, partner_name, config, is_active) VALUES (
    'welno',
    'WELNO (기본)',
    '{
        "payment": {
            "required": false,
            "amount": 0
        },
        "iframe": {
            "allowed": true,
            "domains": ["*"]
        },
        "mediarc": {
            "enabled": true,
            "api_url": "https://xogxog.com/api/external/mediarc/report/",
            "api_key": "welno_5a9bb40b5108ecd8ef864658d5a2d5ab"
        },
        "default_hospital_id": "PEERNINE"
    }'::jsonb,
    true
) ON CONFLICT (partner_id) DO UPDATE SET
    config = EXCLUDED.config,
    updated_at = NOW();

-- 3. 확인 쿼리
SELECT 
    partner_id, 
    partner_name, 
    config->'mediarc' as mediarc_config,
    config->'default_hospital_id' as default_hospital_id,
    is_active 
FROM welno.tb_partner_config 
WHERE is_active = true
ORDER BY partner_id;