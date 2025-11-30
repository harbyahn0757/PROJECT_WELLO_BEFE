-- 외부 검사 종류 기준 테이블 생성
CREATE TABLE IF NOT EXISTS wello.wello_external_checkup_items (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL, -- 카테고리 (암 정밀, 뇌/신경, 심혈관 등)
    sub_category VARCHAR(100), -- 세부 분류 (소화기암, 다중암, 여성암 등)
    item_name VARCHAR(200) NOT NULL, -- 검사명/상품명
    item_name_en VARCHAR(200), -- 영문명
    difficulty_level VARCHAR(10) NOT NULL CHECK (difficulty_level IN ('Low', 'Mid', 'High')), -- 난이도/비용
    target_trigger TEXT, -- 추천 대상 (Trigger)
    gap_description TEXT, -- 결핍/한계 (Gap)
    solution_narrative TEXT, -- 설득 논리 (Solution/Narrative)
    description TEXT, -- 상세 설명
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(item_name) -- 검사명 중복 방지
);

-- 병원별 외부 검사 매핑 테이블
CREATE TABLE IF NOT EXISTS wello.wello_hospital_external_checkup_mapping (
    id SERIAL PRIMARY KEY,
    hospital_id VARCHAR(50) NOT NULL REFERENCES wello.wello_hospitals(hospital_id) ON DELETE CASCADE,
    external_checkup_item_id INTEGER NOT NULL REFERENCES wello.wello_external_checkup_items(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0, -- 표시 순서
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(hospital_id, external_checkup_item_id) -- 병원별 동일 검사 중복 방지
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_external_checkup_category ON wello.wello_external_checkup_items(category);
CREATE INDEX IF NOT EXISTS idx_external_checkup_sub_category ON wello.wello_external_checkup_items(sub_category);
CREATE INDEX IF NOT EXISTS idx_external_checkup_difficulty ON wello.wello_external_checkup_items(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_external_checkup_active ON wello.wello_external_checkup_items(is_active);

CREATE INDEX IF NOT EXISTS idx_hospital_mapping_hospital ON wello.wello_hospital_external_checkup_mapping(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_mapping_item ON wello.wello_hospital_external_checkup_mapping(external_checkup_item_id);
CREATE INDEX IF NOT EXISTS idx_hospital_mapping_active ON wello.wello_hospital_external_checkup_mapping(is_active);

-- 코멘트 추가
COMMENT ON TABLE wello.wello_external_checkup_items IS '외부 검사 종류 기준 테이블';
COMMENT ON TABLE wello.wello_hospital_external_checkup_mapping IS '병원별 외부 검사 매핑 테이블';
COMMENT ON COLUMN wello.wello_external_checkup_items.difficulty_level IS '난이도/비용: Low(부담없는), Mid(추천), High(프리미엄)';

