-- 파트너 유형별 분류 설정
-- hospital: 병원 (medilinx) — 만성질환/진료필요/경계걱정/생활습관
-- healthcare: 헬스케어 (welno, welno_internal) — 운동/다이어트/웰니스
-- commerce: 커머스 (kindhabit, test_partner) — 건기식/구매신호/상품추천

-- tb_partner_config.config JSONB에 partner_type 추가
UPDATE welno.tb_partner_config
SET config = config || '{"partner_type": "hospital"}'::jsonb
WHERE partner_id = 'medilinx'
  AND NOT (config ? 'partner_type');

UPDATE welno.tb_partner_config
SET config = config || '{"partner_type": "healthcare"}'::jsonb
WHERE partner_id IN ('welno', 'welno_internal')
  AND NOT (config ? 'partner_type');

UPDATE welno.tb_partner_config
SET config = config || '{"partner_type": "commerce"}'::jsonb
WHERE partner_id IN ('kindhabit', 'test_partner')
  AND NOT (config ? 'partner_type');
