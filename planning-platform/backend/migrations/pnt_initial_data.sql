-- PNT 초기 데이터 INSERT
-- 작성일: 2026-01-12
-- 설명: 벡터 DB에서 추출한 PNT 데이터를 PostgreSQL에 삽입

-- =============================================
-- 1. PNT 그룹 데이터 (12개)
-- =============================================
INSERT INTO welno.welno_pnt_groups (group_id, group_name, target_symptoms, description, display_order) VALUES
('G1', '일반/기초', ARRAY['전체 스크리닝'], '혈액 화학 검사의 기능적 범위를 분석하여 질병 전 위험 요소를 선별하고 기초 건강을 평가합니다.', 1),
('G2', '부신 기능', ARRAY['만성 피로', '번아웃', '스트레스'], '타액 코티솔 및 DHEA 호르몬 검사를 통해 부신의 스트레스 대응 단계를 파악합니다.', 2),
('G3', '독성/해독', ARRAY['간 해독', '독소 축적', '화학물질 민감성'], '간의 해독 1, 2단계 기능을 평가하여 독소 배출 능력을 최적화합니다.', 3),
('G4', '갑상샘 기능', ARRAY['대사 저하', '체중 변화', '에너지 부족'], '세포 에너지 대사를 조절하는 갑상샘 호르몬의 활성도를 평가합니다.', 4),
('G5', '영양 균형', ARRAY['식습관 불량', '영양 결핍', '인지 저하'], '개인별 필요 영양소의 요구량을 분석하여 최적의 섭취 용량을 결정합니다.', 5),
('G6', '통증/염증', ARRAY['원인 모를 통증', '만성 염증'], '체내 염증 수치와 통증 유발 인자를 조절하는 항염 영양 요법을 적용합니다.', 6),
('G7', '삶의 질', ARRAY['중증도 관리', '136문항 심화'], '신체/정서/사회적 지지 체계를 포괄적으로 평가하여 삶의 만족도를 높입니다.', 7),
('G8', '장 건강', ARRAY['소화불량', '복부 팽만', '장 누수'], '위산 분비, 소화 효소, 장내 미생물 균형을 평가하여 장 기능을 개선합니다.', 8),
('G9', '미토콘드리아/산화', ARRAY['세포 에너지 저하', '노화'], '미토콘드리아의 효율성과 항산화 능력을 측정하여 세포 손상을 방지합니다.', 9),
('G10', '호르몬 균형', ARRAY['갱년기', '호르몬 불균형'], '코티솔, DHEA, 프레그네놀론 등 주요 호르몬의 상호작용을 분석합니다.', 10),
('G11', '대사 종합', ARRAY['체중 증가/감소', '대사 증후군'], '혈당 조절 및 심혈관 질환 위험도를 평가하여 합병증을 예방합니다.', 11),
('G12', '면역/알레르기', ARRAY['피부염', '알레르기', '자가면역'], '외부 유해 물질에 대한 방어 체계와 과민 반응도를 평가합니다.', 12)
ON CONFLICT (group_id) DO NOTHING;

-- =============================================
-- 2. PNT 질문 데이터 (샘플: 기존 4문항 + 부신 기능 8문항)
-- =============================================

-- 기존 PNT 4문항 (유지)
INSERT INTO welno.welno_pnt_questions (question_id, group_id, question_text, question_type, display_order, is_required) VALUES
('pnt_fatigue', 'G2', '충분히 쉬어도 풀리지 않는 만성 피로가 있나요?', 'single', 1, TRUE),
('pnt_skin_condition', 'G12', '피부가 건조하거나 염증이 자주 생기나요?', 'single', 2, TRUE),
('pnt_digestive_issue', 'G8', '가스가 자주 차거나 소화가 잘 안 되나요?', 'single', 3, TRUE),
('pnt_chemical_sensitivity', 'G3', '강한 향수나 담배 연기에 민감하게 반응하나요?', 'single', 4, TRUE)
ON CONFLICT (question_id) DO NOTHING;

-- 부신 기능 상세 문진 (8문항)
INSERT INTO welno.welno_pnt_questions (question_id, group_id, question_text, question_type, display_order, is_required) VALUES
('pnt_adrenal_morning_fatigue', 'G2', '충분히 잠을 잤음에도 아침에 일어나기가 매우 힘들고 개운하지 않습니까?', 'scale', 5, TRUE),
('pnt_adrenal_afternoon_crash', 'G2', '오후 3~4시경 급격히 피로감이 몰려오고 업무 효율이 떨어집니까?', 'scale', 6, TRUE),
('pnt_adrenal_salt_sugar_craving', 'G2', '평소보다 짜거나 달콤한 음식이 유독 강하게 당기는 증상이 있습니까?', 'scale', 7, TRUE),
('pnt_adrenal_orthostatic_dizziness', 'G2', '앉아 있거나 누워 있다가 갑자기 일어날 때 순간적으로 눈앞이 캄캄하거나 어지럽습니까?', 'scale', 8, TRUE),
('pnt_adrenal_stress_tolerance', 'G2', '예전보다 스트레스를 견디기 힘들고 사소한 일에도 쉽게 짜증이 나거나 예민해집니까?', 'scale', 9, TRUE),
('pnt_adrenal_night_awakening', 'G2', '저녁 식사 이후나 밤늦은 시간에 오히려 정신이 맑아지며 에너지가 생겨 잠들기 어렵습니까?', 'scale', 10, TRUE),
('pnt_adrenal_immune_recovery', 'G2', '감기에 걸리면 평소보다 오래 가거나 몸의 상처나 염증이 잘 낫지 않습니까?', 'scale', 11, TRUE),
('pnt_adrenal_caffeine_dependence', 'G2', '커피나 고카페인 음료 없이는 일상적인 생활을 유지하기가 힘듭니까?', 'scale', 12, TRUE)
ON CONFLICT (question_id) DO NOTHING;

-- =============================================
-- 3. PNT 답변 옵션 (샘플)
-- =============================================

-- 기존 4문항 옵션
INSERT INTO welno.welno_pnt_answer_options (question_id, option_value, option_label, score, display_order) VALUES
('pnt_fatigue', 'daily', '매일 느낀다', 10, 1),
('pnt_fatigue', 'often', '자주 느낀다', 7, 2),
('pnt_fatigue', 'sometimes', '가끔 느낀다', 4, 3),
('pnt_fatigue', 'none', '거의 없다', 0, 4),

('pnt_skin_condition', 'severe', '네, 심한 편입니다', 10, 1),
('pnt_skin_condition', 'mild', '약간 그런 편입니다', 5, 2),
('pnt_skin_condition', 'good', '아니요, 괜찮습니다', 0, 3),

('pnt_digestive_issue', 'always', '항상 그렇다', 10, 1),
('pnt_digestive_issue', 'after_meal', '식후에 자주 그렇다', 7, 2),
('pnt_digestive_issue', 'none', '거의 없다', 0, 3),

('pnt_chemical_sensitivity', 'very_sensitive', '매우 민감하다 (어지러움 등)', 10, 1),
('pnt_chemical_sensitivity', 'mild_sensitive', '약간 민감하다', 5, 2),
('pnt_chemical_sensitivity', 'normal', '보통이다', 0, 3)
ON CONFLICT (question_id, option_value) DO NOTHING;

-- 부신 기능 8문항 옵션 (척도형: 0~4점)
INSERT INTO welno.welno_pnt_answer_options (question_id, option_value, option_label, score, display_order) VALUES
('pnt_adrenal_morning_fatigue', 'score_0', '경험한 적이 없거나 거의 일어나지 않음', 0, 1),
('pnt_adrenal_morning_fatigue', 'score_1', '때때로 경험하지만 심하지 않음', 1, 2),
('pnt_adrenal_morning_fatigue', 'score_2', '때때로 경험하며 그 정도가 심함', 2, 3),
('pnt_adrenal_morning_fatigue', 'score_3', '자주 일어나지만 정도는 심하지 않음', 3, 4),
('pnt_adrenal_morning_fatigue', 'score_4', '자주 일어나며 그 증상도 매우 심함', 4, 5)
ON CONFLICT (question_id, option_value) DO NOTHING;

-- (나머지 7개 질문도 동일한 0~4점 옵션, 생략)

-- =============================================
-- 4. PNT 검사 항목 (샘플 10개)
-- =============================================
INSERT INTO welno.welno_pnt_test_items (test_code, test_name_ko, test_category, specimen_type, brief_reason, is_advanced, estimated_cost, turnaround_days) VALUES
('CORTISOL_SALIVA', '타액 코티솔 일주기 검사', '호르몬', '타액', '하루 4회 측정하여 부신 피로 단계 평가', TRUE, 150000, 7),
('DHEA', 'DHEA 검사', '호르몬', '혈액', '스트레스 호르몬 균형 확인', FALSE, 50000, 3),
('TSH', '갑상샘 자극 호르몬', '호르몬', '혈액', '갑상샘 기능 기본 평가', FALSE, 15000, 1),
('FT4', '유리 타이록신', '호르몬', '혈액', '활성 갑상샘 호르몬 측정', FALSE, 20000, 1),
('CBC', '전혈구 검사', '일반', '혈액', '기본 건강 스크리닝', FALSE, 10000, 1),
('CRP_HS', '고감도 CRP', '염증', '혈액', '미세 만성 염증 조기 발견', TRUE, 35000, 3),
('VIT_D', '비타민 D', '영양소', '혈액', '면역/골다공증 예방', FALSE, 25000, 3),
('B12', '비타민 B12', '영양소', '혈액', '에너지 대사 및 신경 건강', FALSE, 20000, 3),
('FERRITIN', '페리틴', '영양소', '혈액', '철 저장량 평가 (빈혈 예방)', FALSE, 18000, 2),
('HBA1C', '당화혈색소', '대사', '혈액', '최근 3개월 혈당 조절 상태', FALSE, 15000, 1)
ON CONFLICT (test_code) DO NOTHING;

-- =============================================
-- 5. PNT 건기식 (샘플 5개)
-- =============================================
INSERT INTO welno.welno_pnt_supplements (supplement_code, supplement_name_ko, category, main_ingredient, recommended_dosage, brief_reason) VALUES
('LICORICE', '감초(Licorice)', '허브', '글리시리진산', '1일 1~2g', '부신 기능 지원, 코티솔 조절'),
('VIT_C', '비타민 C', '비타민', '아스코르브산', '1일 1,000~2,000mg', '부신 호르몬 합성 필수, 항산화'),
('VIT_B_COMPLEX', '비타민 B 복합체', '비타민', 'B1/B2/B3/B5/B6/B12', '1일 1회 고함량', '에너지 대사 촉진, 부신 지원'),
('MAGNESIUM', '마그네슘', '미네랄', '마그네슘 글리시네이트', '1일 200~400mg', '신경 안정, 수면 개선, 근육 이완'),
('OMEGA3', '오메가3', '지방산', 'EPA/DHA', '1일 1,000~2,000mg', '항염, 심혈관 건강, 뇌 기능')
ON CONFLICT (supplement_code) DO NOTHING;

-- =============================================
-- 6. PNT 식품 (샘플 5개)
-- =============================================
INSERT INTO welno.welno_pnt_foods (food_code, food_name_ko, food_category, key_nutrients, brief_reason) VALUES
('AVOCADO', '아보카도', '과일', '{"칼륨": "485mg", "비타민B5": "1.4mg", "비타민E": "2.1mg"}'::jsonb, '부신 건강 지원, 스트레스 완화'),
('BROCCOLI', '브로콜리', '채소', '{"비타민C": "89mg", "설포라판": "풍부"}'::jsonb, '항산화, 간 해독 지원'),
('SALMON', '연어', '단백질', '{"오메가3": "2,260mg", "비타민D": "526IU"}'::jsonb, '항염, 뇌 기능, 심혈관 건강'),
('SPINACH', '시금치', '채소', '{"철분": "2.7mg", "마그네슘": "79mg", "엽산": "194mcg"}'::jsonb, '빈혈 예방, 에너지 생성'),
('WALNUTS', '호두', '견과류', '{"오메가3": "2,570mg", "마그네슘": "158mg"}'::jsonb, '뇌 건강, 항염, 호르몬 균형')
ON CONFLICT (food_code) DO NOTHING;

-- =============================================
-- 7. PNT 추천 매트릭스 (샘플 3개)
-- =============================================
INSERT INTO welno.welno_pnt_recommendation_matrix (
    group_id, question_id, option_value, score_threshold,
    recommended_tests, recommended_supplements, recommended_foods,
    recommendation_priority, brief_rationale
) VALUES
-- 부신 피로 "매일" 선택 시
('G2', 'pnt_fatigue', 'daily', 7,
 ARRAY[1, 2]::int[], -- CORTISOL_SALIVA, DHEA
 ARRAY[1, 2, 3, 4]::int[], -- LICORICE, VIT_C, VIT_B_COMPLEX, MAGNESIUM
 ARRAY[1]::int[], -- AVOCADO
 10, '매일 만성 피로 → 부신 기능 정밀 평가 필수'),

-- 피부염 "심함" 선택 시
('G12', 'pnt_skin_condition', 'severe', 10,
 ARRAY[6, 7]::int[], -- CRP_HS, VIT_D
 ARRAY[5]::int[], -- OMEGA3
 ARRAY[2]::int[], -- BROCCOLI
 9, '심한 피부염 → 염증 마커 확인 + 항염 영양 요법'),

-- 소화불량 "항상" 선택 시
('G8', 'pnt_digestive_issue', 'always', 10,
 ARRAY[5]::int[], -- CBC
 ARRAY[]::int[], -- (건기식 없음)
 ARRAY[4]::int[], -- SPINACH
 8, '만성 소화불량 → 기본 검사 + 소화 효소 보충 고려')
ON CONFLICT DO NOTHING;

-- =============================================
-- 완료 메시지
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '✅ PNT 초기 데이터 INSERT 완료!';
    RAISE NOTICE '📊 그룹: 12개';
    RAISE NOTICE '📊 질문: 12개 (기존 4 + 부신 8)';
    RAISE NOTICE '📊 검사: 10개';
    RAISE NOTICE '📊 건기식: 5개';
    RAISE NOTICE '📊 식품: 5개';
    RAISE NOTICE '📊 매트릭스: 3개';
    RAISE NOTICE '📋 다음 단계: PNT 서비스 구현';
END $$;
