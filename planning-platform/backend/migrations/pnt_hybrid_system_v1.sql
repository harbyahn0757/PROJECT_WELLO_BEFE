-- PNT 하이브리드 시스템 DB 마이그레이션 v1.0
-- 작성일: 2026-01-12
-- 설명: 벡터 DB에서 추출한 PNT 데이터를 PostgreSQL로 구조화

-- =============================================
-- 1. PNT 그룹 (12개)
-- =============================================
CREATE TABLE IF NOT EXISTS welno.welno_pnt_groups (
    group_id VARCHAR(10) PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL,
    group_name_en VARCHAR(100),
    target_symptoms TEXT[],
    description TEXT,
    display_order INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE welno.welno_pnt_groups IS 'PNT 문진 그룹 정의 (12개 카테고리)';
COMMENT ON COLUMN welno.welno_pnt_groups.group_id IS '그룹 ID (G1~G12)';
COMMENT ON COLUMN welno.welno_pnt_groups.target_symptoms IS '타겟 증상 리스트';

-- =============================================
-- 2. PNT 질문 (60~120개)
-- =============================================
CREATE TABLE IF NOT EXISTS welno.welno_pnt_questions (
    question_id VARCHAR(100) PRIMARY KEY,
    group_id VARCHAR(10) NOT NULL REFERENCES welno.welno_pnt_groups(group_id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_text_en TEXT,
    question_type VARCHAR(20) DEFAULT 'single' CHECK (question_type IN ('single', 'multiple', 'scale', 'text')),
    display_order INT DEFAULT 1,
    is_required BOOLEAN DEFAULT FALSE,
    helper_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE welno.welno_pnt_questions IS 'PNT 그룹별 문진 질문';
COMMENT ON COLUMN welno.welno_pnt_questions.question_type IS '질문 유형: single(단일선택), multiple(다중선택), scale(척도), text(텍스트)';

CREATE INDEX idx_pnt_questions_group ON welno.welno_pnt_questions(group_id);
CREATE INDEX idx_pnt_questions_order ON welno.welno_pnt_questions(display_order);

-- =============================================
-- 3. PNT 답변 옵션 (300~500개)
-- =============================================
CREATE TABLE IF NOT EXISTS welno.welno_pnt_answer_options (
    option_id SERIAL PRIMARY KEY,
    question_id VARCHAR(100) NOT NULL REFERENCES welno.welno_pnt_questions(question_id) ON DELETE CASCADE,
    option_value VARCHAR(50) NOT NULL,
    option_label TEXT NOT NULL,
    option_label_en TEXT,
    score INT DEFAULT 0,
    display_order INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_question_option UNIQUE (question_id, option_value)
);

COMMENT ON TABLE welno.welno_pnt_answer_options IS 'PNT 질문별 답변 옵션 및 점수';
COMMENT ON COLUMN welno.welno_pnt_answer_options.score IS '답변 점수 (0~10, 높을수록 위험)';

CREATE INDEX idx_pnt_options_question ON welno.welno_pnt_answer_options(question_id);

-- =============================================
-- 4. PNT 검사 항목 마스터 (100~200개)
-- =============================================
CREATE TABLE IF NOT EXISTS welno.welno_pnt_test_items (
    test_id SERIAL PRIMARY KEY,
    test_code VARCHAR(50) UNIQUE NOT NULL,
    test_name_ko VARCHAR(200) NOT NULL,
    test_name_en VARCHAR(200),
    test_category VARCHAR(50),
    specimen_type VARCHAR(50),
    brief_reason TEXT,
    is_advanced BOOLEAN DEFAULT FALSE,
    estimated_cost INT,
    turnaround_days INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE welno.welno_pnt_test_items IS 'PNT 검사 항목 마스터 (간단한 이유만, 상세는 RAG)';
COMMENT ON COLUMN welno.welno_pnt_test_items.brief_reason IS '간단한 추천 이유 (1~2문장, 상세 설명은 RAG 조회)';
COMMENT ON COLUMN welno.welno_pnt_test_items.is_advanced IS '고급 검사 여부 (⭐ 표시)';

CREATE INDEX idx_pnt_test_category ON welno.welno_pnt_test_items(test_category);
CREATE INDEX idx_pnt_test_specimen ON welno.welno_pnt_test_items(specimen_type);

-- =============================================
-- 5. PNT 건강기능식품 마스터 (50~100개)
-- =============================================
CREATE TABLE IF NOT EXISTS welno.welno_pnt_supplements (
    supplement_id SERIAL PRIMARY KEY,
    supplement_code VARCHAR(50) UNIQUE NOT NULL,
    supplement_name_ko VARCHAR(200) NOT NULL,
    supplement_name_en VARCHAR(200),
    category VARCHAR(50),
    main_ingredient TEXT,
    recommended_dosage TEXT,
    brief_reason TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE welno.welno_pnt_supplements IS 'PNT 건기식 마스터 (간단한 이유만, 상세는 RAG)';
COMMENT ON COLUMN welno.welno_pnt_supplements.brief_reason IS '간단한 추천 이유 (1~2문장, 상세 설명은 RAG 조회)';

CREATE INDEX idx_pnt_supplement_category ON welno.welno_pnt_supplements(category);

-- =============================================
-- 6. PNT 식품 마스터 (50~100개)
-- =============================================
CREATE TABLE IF NOT EXISTS welno.welno_pnt_foods (
    food_id SERIAL PRIMARY KEY,
    food_code VARCHAR(50) UNIQUE NOT NULL,
    food_name_ko VARCHAR(200) NOT NULL,
    food_name_en VARCHAR(200),
    food_category VARCHAR(50),
    key_nutrients JSONB,
    brief_reason TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE welno.welno_pnt_foods IS 'PNT 식품 마스터 (간단한 이유만, 상세는 RAG)';
COMMENT ON COLUMN welno.welno_pnt_foods.key_nutrients IS '주요 영양소 JSONB (예: {"칼륨": "485mg", "비타민B5": "1.4mg"})';
COMMENT ON COLUMN welno.welno_pnt_foods.brief_reason IS '간단한 추천 이유 (1~2문장, 상세 설명은 RAG 조회)';

CREATE INDEX idx_pnt_food_category ON welno.welno_pnt_foods(food_category);

-- =============================================
-- 7. PNT 추천 매트릭스 (핵심)
-- =============================================
CREATE TABLE IF NOT EXISTS welno.welno_pnt_recommendation_matrix (
    matrix_id SERIAL PRIMARY KEY,
    group_id VARCHAR(10) NOT NULL REFERENCES welno.welno_pnt_groups(group_id) ON DELETE CASCADE,
    question_id VARCHAR(100) NOT NULL REFERENCES welno.welno_pnt_questions(question_id) ON DELETE CASCADE,
    option_value VARCHAR(50) NOT NULL,
    score_threshold INT,
    recommended_tests INT[],
    recommended_supplements INT[],
    recommended_foods INT[],
    recommendation_priority INT DEFAULT 5 CHECK (recommendation_priority BETWEEN 1 AND 10),
    brief_rationale TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE welno.welno_pnt_recommendation_matrix IS 'PNT 답변별 추천 매트릭스 (검사/건기식/식품)';
COMMENT ON COLUMN welno.welno_pnt_recommendation_matrix.recommended_tests IS 'FK array to welno_pnt_test_items.test_id';
COMMENT ON COLUMN welno.welno_pnt_recommendation_matrix.recommended_supplements IS 'FK array to welno_pnt_supplements.supplement_id';
COMMENT ON COLUMN welno.welno_pnt_recommendation_matrix.recommended_foods IS 'FK array to welno_pnt_foods.food_id';
COMMENT ON COLUMN welno.welno_pnt_recommendation_matrix.brief_rationale IS '간단한 추천 이유 (1~2문장, 상세 설명은 RAG 조회)';

CREATE INDEX idx_pnt_matrix_group ON welno.welno_pnt_recommendation_matrix(group_id);
CREATE INDEX idx_pnt_matrix_question ON welno.welno_pnt_recommendation_matrix(question_id);
CREATE INDEX idx_pnt_matrix_option ON welno.welno_pnt_recommendation_matrix(option_value);
CREATE INDEX idx_pnt_matrix_priority ON welno.welno_pnt_recommendation_matrix(recommendation_priority);

-- =============================================
-- 8. PNT 사용자 응답
-- =============================================
CREATE TABLE IF NOT EXISTS welno.welno_pnt_user_responses (
    response_id SERIAL PRIMARY KEY,
    patient_uuid VARCHAR(100) NOT NULL,
    hospital_id VARCHAR(50) NOT NULL,
    session_id VARCHAR(200),
    question_id VARCHAR(100) NOT NULL REFERENCES welno.welno_pnt_questions(question_id) ON DELETE CASCADE,
    answer_value VARCHAR(50) NOT NULL,
    answer_score INT,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE welno.welno_pnt_user_responses IS 'PNT 사용자 문진 응답 기록';

CREATE INDEX idx_pnt_responses_patient ON welno.welno_pnt_user_responses(patient_uuid);
CREATE INDEX idx_pnt_responses_session ON welno.welno_pnt_user_responses(session_id);
CREATE INDEX idx_pnt_responses_question ON welno.welno_pnt_user_responses(question_id);

-- =============================================
-- 9. PNT 최종 추천 결과
-- =============================================
CREATE TABLE IF NOT EXISTS welno.welno_pnt_final_recommendations (
    recommendation_id SERIAL PRIMARY KEY,
    patient_uuid VARCHAR(100) NOT NULL,
    hospital_id VARCHAR(50) NOT NULL,
    session_id VARCHAR(200),
    checkup_design_request_id INT,
    recommended_tests JSONB,
    recommended_supplements JSONB,
    recommended_foods JSONB,
    total_pnt_score INT,
    group_scores JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE welno.welno_pnt_final_recommendations IS 'PNT 최종 추천 결과 (검사/건기식/식품)';
COMMENT ON COLUMN welno.welno_pnt_final_recommendations.recommended_tests IS 'JSONB: [{test_id, name, reason, priority, is_selected}]';
COMMENT ON COLUMN welno.welno_pnt_final_recommendations.recommended_supplements IS 'JSONB: [{supplement_id, name, dosage, reason, priority, is_selected}]';
COMMENT ON COLUMN welno.welno_pnt_final_recommendations.recommended_foods IS 'JSONB: [{food_id, name, portion, reason, priority, is_selected}]';
COMMENT ON COLUMN welno.welno_pnt_final_recommendations.group_scores IS 'JSONB: {G1: 25, G2: 48, ...}';

CREATE INDEX idx_pnt_final_patient ON welno.welno_pnt_final_recommendations(patient_uuid);
CREATE INDEX idx_pnt_final_checkup ON welno.welno_pnt_final_recommendations(checkup_design_request_id);
CREATE INDEX idx_pnt_final_session ON welno.welno_pnt_final_recommendations(session_id);

-- =============================================
-- 완료 메시지
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '✅ PNT 하이브리드 시스템 마이그레이션 완료!';
    RAISE NOTICE '📊 생성된 테이블: 9개';
    RAISE NOTICE '📋 다음 단계: 초기 데이터 INSERT 실행';
END $$;
