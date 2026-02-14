-- 파트너오피스 로그인을 위한 비밀번호 컬럼 추가
ALTER TABLE welno.tb_partner_config
  ADD COLUMN IF NOT EXISTS backoffice_password VARCHAR(255);
