-- 병원 테이블에 검진 항목 필드 추가
ALTER TABLE wello.wello_hospitals 
ADD COLUMN IF NOT EXISTS checkup_items JSONB, -- 병원별 검진 항목 상세 정보
ADD COLUMN IF NOT EXISTS national_checkup_items JSONB, -- 일반검진(의무검진) 항목
ADD COLUMN IF NOT EXISTS recommended_items JSONB; -- 병원 추천(업셀링) 항목

-- 김현우 내과 검진 항목 세팅
UPDATE wello.wello_hospitals 
SET 
  national_checkup_items = '[
    {
      "name": "일반건강검진",
      "category": "기본검진",
      "description": "국가에서 시행하는 의무 건강검진",
      "age_range": "40-64",
      "gender": "all",
      "frequency": "2년마다",
      "items": ["신체계측", "혈압측정", "혈액검사", "소변검사", "흉부X선", "시력검사", "청력검사"]
    },
    {
      "name": "암검진",
      "category": "암검진",
      "description": "국가 암검진 프로그램",
      "age_range": "40-74",
      "gender": "all",
      "frequency": "1-2년마다",
      "items": ["위암검진", "대장암검진", "간암검진", "유방암검진", "자궁경부암검진"]
    }
  ]'::jsonb,
  recommended_items = '[
    {
      "name": "심전도 검사",
      "category": "심혈관검진",
      "description": "심장의 전기적 활동을 측정하는 검사",
      "types": ["12유도 심전도", "운동부하 심전도", "24시간 홀터 심전도"],
      "target_conditions": ["고혈압", "당뇨", "심장질환 가족력"],
      "upselling_priority": 1,
      "meaning": "심장 질환 조기 발견 및 모니터링"
    },
    {
      "name": "유전자 검사",
      "category": "유전자검진",
      "description": "유전적 질환 위험도 평가",
      "types": ["암 유전자 검사", "심혈관 질환 유전자 검사", "대사질환 유전자 검사"],
      "target_conditions": ["가족력 있는 질환", "조기 발병 질환"],
      "upselling_priority": 2,
      "meaning": "개인 맞춤형 예방 의학"
    },
    {
      "name": "여성 검진",
      "category": "여성검진",
      "description": "여성 특화 검진 항목",
      "age_range": "20-65",
      "gender": "F",
      "items": ["골밀도 검사", "갑상선 초음파", "유방 초음파", "부인과 검진"],
      "upselling_priority": 2,
      "meaning": "여성 건강 특화 검진"
    },
    {
      "name": "정밀 검진",
      "category": "특화검진",
      "description": "별도 회사에서 시행하는 정밀 검진",
      "types": ["PET-CT", "MRI 전신 스캔", "초음파 전신 검사"],
      "upselling_priority": 3,
      "meaning": "전신 정밀 건강 상태 평가"
    }
  ]'::jsonb
WHERE hospital_id = 'KIM_HW_CLINIC';

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_hospitals_checkup_items ON wello.wello_hospitals USING GIN (checkup_items);
CREATE INDEX IF NOT EXISTS idx_hospitals_national_checkup ON wello.wello_hospitals USING GIN (national_checkup_items);
CREATE INDEX IF NOT EXISTS idx_hospitals_recommended_items ON wello.wello_hospitals USING GIN (recommended_items);

