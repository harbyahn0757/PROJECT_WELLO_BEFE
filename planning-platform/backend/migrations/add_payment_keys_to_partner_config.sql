-- 파트너 설정에 결제 키 추가
-- 실행일: 2026-02-09
-- 목적: 하드코딩된 결제 키를 파트너별 설정으로 이전

BEGIN;

-- 1. 현재 파트너별 결제 설정 확인
SELECT 
    partner_id,
    partner_name,
    config->'payment' as current_payment_config
FROM welno.tb_partner_config
ORDER BY partner_id;

-- 2. 모든 파트너에 결제 키 추가 (현재는 모든 파트너가 동일한 키 사용)
UPDATE welno.tb_partner_config 
SET config = jsonb_set(
    jsonb_set(
        jsonb_set(
            jsonb_set(
                config, 
                '{payment,mid}', 
                '"COCkkhabit"'
            ),
            '{payment,hash_key}',
            '"3CB8183A4BE283555ACC8363C0360223"'
        ),
        '{payment,iniapi_key}',
        '"oAOMaMsnwnSvlu4l"'
    ),
    '{payment,iniapi_iv}',
    '"4PqCmQ0Fn0kSJQ=="'
),
updated_at = NOW()
WHERE partner_id IN ('welno', 'kindhabit', 'medilinx', 'welno_internal', 'test_partner');

-- 3. 서비스 도메인도 파트너별로 설정 (현재는 kindhabit 도메인을 기본으로 사용)
UPDATE welno.tb_partner_config 
SET config = jsonb_set(
    config,
    '{payment,service_domain}',
    '"https://report.kindhabit.com"'
),
updated_at = NOW()
WHERE partner_id IN ('welno', 'kindhabit', 'medilinx', 'welno_internal', 'test_partner');

-- 4. test_partner는 테스트용 MID 사용
UPDATE welno.tb_partner_config 
SET config = jsonb_set(
    jsonb_set(
        config, 
        '{payment,mid}', 
        '"INIpayTest"'
    ),
    '{payment,service_domain}',
    '"https://test.example.com"'
),
updated_at = NOW()
WHERE partner_id = 'test_partner';

-- 5. 업데이트 결과 확인
SELECT 
    partner_id,
    partner_name,
    config->'payment' as updated_payment_config
FROM welno.tb_partner_config
ORDER BY partner_id;

-- 6. 결제 키 조회 성능을 위한 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_partner_config_payment_mid 
ON welno.tb_partner_config USING GIN ((config->'payment'->>'mid'));

-- 7. 검증: 모든 파트너가 결제 키를 가지고 있는지 확인
SELECT 
    partner_id,
    CASE 
        WHEN config->'payment'->>'mid' IS NOT NULL THEN '✅'
        ELSE '❌'
    END as has_mid,
    CASE 
        WHEN config->'payment'->>'hash_key' IS NOT NULL THEN '✅'
        ELSE '❌'
    END as has_hash_key,
    CASE 
        WHEN config->'payment'->>'iniapi_key' IS NOT NULL THEN '✅'
        ELSE '❌'
    END as has_iniapi_key,
    config->'payment'->>'mid' as mid_value
FROM welno.tb_partner_config
ORDER BY partner_id;

COMMIT;

-- 마이그레이션 완료 메시지
SELECT '✅ 파트너 결제 키 설정 완료' as status,
       '모든 파트너에 MID/해시키/INIAPI 키 추가됨' as details;