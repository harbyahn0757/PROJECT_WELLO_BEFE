-- 병원 테이블 구조 확인
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'wello' 
  AND table_name = 'wello_hospitals' 
ORDER BY ordinal_position;

-- KIM_HW_CLINIC 데이터 확인
SELECT * FROM wello.wello_hospitals WHERE hospital_id = 'KIM_HW_CLINIC';

