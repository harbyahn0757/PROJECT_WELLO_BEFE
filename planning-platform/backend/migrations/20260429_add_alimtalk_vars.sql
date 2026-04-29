-- 2026-04-29 — 병원별 알림톡 템플릿 변수 저장
-- welno.tb_hospital_rag_config 에 alimtalk_vars JSONB 컬럼 추가
-- 구조: { template_code: { var_name: var_value, ... }, ... }
-- 예: {
--   "welno_2605_inform": {
--     "진료안내": "월~금 08:30~18:00",
--     "휴진일정": "5/5 어린이날 휴진",
--     "병원주소": "서울 동대문구 전농로 126",
--     "sub_button_0": "https://map.naver.com/...",
--     "sub_button_1": "https://welno.kindhabit.com/..."
--   }
-- }
-- 비고: #{병원명} = hospital_name 컬럼, #{병원연락처} = contact_phone 컬럼 그대로 매핑
--       (alimtalk_vars 에는 템플릿별 추가 변수만 저장)

ALTER TABLE welno.tb_hospital_rag_config
    ADD COLUMN IF NOT EXISTS alimtalk_vars JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN welno.tb_hospital_rag_config.alimtalk_vars IS
    '병원별 알림톡 템플릿 변수값. 구조: {template_code: {var_name: var_value, ...}}';

-- 변수 조회 가속용 GIN 인덱스 (특정 변수 누락 병원 찾기 등)
CREATE INDEX IF NOT EXISTS idx_htrc_alimtalk_vars
    ON welno.tb_hospital_rag_config USING GIN (alimtalk_vars);
