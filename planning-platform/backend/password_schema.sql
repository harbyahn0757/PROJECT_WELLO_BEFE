-- 비밀번호 시스템을 위한 welno_patients 테이블 확장
-- 생성일: 2025-01-25
-- 목적: 8자리 비밀번호 보안 시스템 구현

-- welno_patients 테이블에 비밀번호 관련 필드 추가
ALTER TABLE welno.welno_patients 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),           -- bcrypt 해시 (8자리 숫자)
ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ,          -- 비밀번호 설정 시간
ADD COLUMN IF NOT EXISTS last_password_prompt TIMESTAMPTZ,     -- 마지막 비밀번호 설정 권유 시간
ADD COLUMN IF NOT EXISTS password_attempts INTEGER DEFAULT 0,  -- 연속 실패 횟수
ADD COLUMN IF NOT EXISTS password_locked_until TIMESTAMPTZ,    -- 잠금 해제 시간
ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ;           -- 마지막 접근 시간 (30일 체크용)

-- 비밀번호 관련 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_patients_password_set ON welno.welno_patients(password_set_at) WHERE password_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_last_access ON welno.welno_patients(last_access_at);
CREATE INDEX IF NOT EXISTS idx_patients_locked ON welno.welno_patients(password_locked_until) WHERE password_locked_until IS NOT NULL;

-- 비밀번호 정책 상수 (애플리케이션에서 사용)
-- PASSWORD_LENGTH: 8 (정확히 8자리)
-- MAX_ATTEMPTS: 5 (최대 시도 횟수)
-- LOCKOUT_DURATION: 1800 (30분, 초 단위)
-- PROMPT_INTERVAL: 2592000 (30일, 초 단위)
-- HASH_ROUNDS: 12 (bcrypt 라운드)

-- 샘플 데이터 업데이트 (테스트용)
UPDATE welno.welno_patients 
SET last_access_at = NOW() - INTERVAL '35 days'  -- 35일 전 접근으로 설정 (권유 테스트용)
WHERE uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- 비밀번호 관련 함수들

-- 1. 비밀번호 설정 여부 확인
CREATE OR REPLACE FUNCTION check_password_exists(p_uuid VARCHAR(36), p_hospital_id VARCHAR(20))
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM welno.welno_patients 
        WHERE uuid = p_uuid 
        AND hospital_id = p_hospital_id 
        AND password_hash IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql;

-- 2. 비밀번호 설정 권유 필요 여부 확인
CREATE OR REPLACE FUNCTION should_prompt_password(p_uuid VARCHAR(36), p_hospital_id VARCHAR(20))
RETURNS BOOLEAN AS $$
DECLARE
    patient_record RECORD;
    days_since_access INTEGER;
    days_since_prompt INTEGER;
BEGIN
    SELECT * INTO patient_record 
    FROM welno.welno_patients 
    WHERE uuid = p_uuid AND hospital_id = p_hospital_id;
    
    -- 환자 정보가 없으면 false
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- 이미 비밀번호가 설정되어 있으면 false
    IF patient_record.password_hash IS NOT NULL THEN
        RETURN FALSE;
    END IF;
    
    -- 마지막 접근일이 30일 이상 지났는지 확인
    IF patient_record.last_access_at IS NOT NULL THEN
        days_since_access := EXTRACT(EPOCH FROM (NOW() - patient_record.last_access_at)) / 86400;
        IF days_since_access < 30 THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- 마지막 권유일이 7일 이내면 false (너무 자주 묻지 않기)
    IF patient_record.last_password_prompt IS NOT NULL THEN
        days_since_prompt := EXTRACT(EPOCH FROM (NOW() - patient_record.last_password_prompt)) / 86400;
        IF days_since_prompt < 7 THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 3. 비밀번호 시도 횟수 증가
CREATE OR REPLACE FUNCTION increment_password_attempts(p_uuid VARCHAR(36), p_hospital_id VARCHAR(20))
RETURNS INTEGER AS $$
DECLARE
    new_attempts INTEGER;
BEGIN
    UPDATE welno.welno_patients 
    SET password_attempts = password_attempts + 1,
        password_locked_until = CASE 
            WHEN password_attempts + 1 >= 5 THEN NOW() + INTERVAL '30 minutes'
            ELSE password_locked_until
        END,
        updated_at = NOW()
    WHERE uuid = p_uuid AND hospital_id = p_hospital_id
    RETURNING password_attempts INTO new_attempts;
    
    RETURN COALESCE(new_attempts, 0);
END;
$$ LANGUAGE plpgsql;

-- 4. 비밀번호 시도 횟수 초기화
CREATE OR REPLACE FUNCTION reset_password_attempts(p_uuid VARCHAR(36), p_hospital_id VARCHAR(20))
RETURNS VOID AS $$
BEGIN
    UPDATE welno.welno_patients 
    SET password_attempts = 0,
        password_locked_until = NULL,
        updated_at = NOW()
    WHERE uuid = p_uuid AND hospital_id = p_hospital_id;
END;
$$ LANGUAGE plpgsql;

-- 5. 마지막 접근 시간 업데이트
CREATE OR REPLACE FUNCTION update_last_access(p_uuid VARCHAR(36), p_hospital_id VARCHAR(20))
RETURNS VOID AS $$
BEGIN
    UPDATE welno.welno_patients 
    SET last_access_at = NOW(),
        updated_at = NOW()
    WHERE uuid = p_uuid AND hospital_id = p_hospital_id;
END;
$$ LANGUAGE plpgsql;

-- 6. 비밀번호 권유 시간 업데이트
CREATE OR REPLACE FUNCTION update_password_prompt(p_uuid VARCHAR(36), p_hospital_id VARCHAR(20))
RETURNS VOID AS $$
BEGIN
    UPDATE welno.welno_patients 
    SET last_password_prompt = NOW(),
        updated_at = NOW()
    WHERE uuid = p_uuid AND hospital_id = p_hospital_id;
END;
$$ LANGUAGE plpgsql;
