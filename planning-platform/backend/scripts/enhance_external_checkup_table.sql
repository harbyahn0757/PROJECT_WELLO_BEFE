-- 외부 검사 항목 테이블 보강 (벡터 DB용 확장 필드 추가)
-- 제공된 정보에 따라 성능 지표, 임상 연구 정보, 참고 자료 등을 추가

-- 1. 성능 지표 관련 컬럼 추가
ALTER TABLE welno.welno_external_checkup_items
ADD COLUMN IF NOT EXISTS sensitivity DECIMAL(5,2), -- 민감도 (%)
ADD COLUMN IF NOT EXISTS specificity DECIMAL(5,2), -- 특이도 (%)
ADD COLUMN IF NOT EXISTS auc_score DECIMAL(4,3), -- AUC 점수
ADD COLUMN IF NOT EXISTS ppv DECIMAL(5,2), -- 양성 예측도 (PPV)
ADD COLUMN IF NOT EXISTS npv DECIMAL(5,2), -- 음성 예측도 (NPV)
ADD COLUMN IF NOT EXISTS early_stage_sensitivity DECIMAL(5,2), -- 조기암 단계 민감도
ADD COLUMN IF NOT EXISTS early_stage_specificity DECIMAL(5,2); -- 조기암 단계 특이도

-- 2. 임상 연구 정보 컬럼 추가
ALTER TABLE welno.welno_external_checkup_items
ADD COLUMN IF NOT EXISTS study_design VARCHAR(50), -- 전향/후향, 단일/다기관
ADD COLUMN IF NOT EXISTS sample_size INTEGER, -- 주요 임상연구 샘플 수 (N)
ADD COLUMN IF NOT EXISTS study_type VARCHAR(50), -- 한국 단독 vs 다국가
ADD COLUMN IF NOT EXISTS publication_year INTEGER, -- 출판 연도
ADD COLUMN IF NOT EXISTS publication_refs JSONB; -- 논문 참고 자료 (DOI, PMID, 학술지명 등)

-- 3. 규제/실무 정보 컬럼 추가
ALTER TABLE welno.welno_external_checkup_items
ADD COLUMN IF NOT EXISTS mfds_approval BOOLEAN DEFAULT false, -- MFDS 허가 여부
ADD COLUMN IF NOT EXISTS mfds_approval_number VARCHAR(100), -- MFDS 허가번호
ADD COLUMN IF NOT EXISTS mfds_approval_year INTEGER, -- MFDS 허가 연도
ADD COLUMN IF NOT EXISTS reimbursement_status VARCHAR(50), -- 급여/선별급여/비급여
ADD COLUMN IF NOT EXISTS clinical_setting TEXT[]; -- 대학병원, 검진센터, 개원가, 연구용 등

-- 4. 기술/검체 상세 정보 컬럼 추가
ALTER TABLE welno.welno_external_checkup_items
ADD COLUMN IF NOT EXISTS biomarker_type VARCHAR(100), -- DNA 변이, DNA 메틸화, RNA 발현/융합, 단백질, ctDNA 등
ADD COLUMN IF NOT EXISTS platform_detail VARCHAR(200), -- NGS, 실시간 PCR, 메틸화 PCR, 단백질 패널, RNA 패널, AI-영상분석 등
ADD COLUMN IF NOT EXISTS panel_scope JSONB, -- NGS 패널일 경우: 유전자 수, 커버하는 변이 타입(SNV, Indel, CNV, MSI, TMB 등)
ADD COLUMN IF NOT EXISTS icd_codes TEXT[]; -- 대표 ICD/KCD 코드 (예: C18, C34 등)

-- 5. 참고 자료 URL 컬럼 추가
ALTER TABLE welno.welno_external_checkup_items
ADD COLUMN IF NOT EXISTS reference_urls JSONB; -- 참고 자료 URL 리스트 (공공 데이터, 논문, 제품 사이트 등)

-- 6. 벡터 DB용 텍스트 필드 추가
ALTER TABLE welno.welno_external_checkup_items
ADD COLUMN IF NOT EXISTS short_description_ko TEXT, -- 2-3문장 요약 (검사의 목적·기술·특징)
ADD COLUMN IF NOT EXISTS short_description_en TEXT, -- 영문 요약
ADD COLUMN IF NOT EXISTS clinical_summary TEXT, -- 주요 임상연구 결과를 5-10줄 정도 마크다운/텍스트로 요약
ADD COLUMN IF NOT EXISTS guideline_context TEXT; -- 국내외 가이드라인·암빅데이터/정밀의료 사업과의 연결 포인트 설명

-- 7. 추가 메타데이터
ALTER TABLE welno.welno_external_checkup_items
ADD COLUMN IF NOT EXISTS brand_family VARCHAR(100), -- 브랜드/플랫폼 계열 (예: EarlyTect, OncoAccuPanel, PNAClamp)
ADD COLUMN IF NOT EXISTS secondary_cancer_types TEXT[], -- 다중암 검사일 경우 커버하는 암 리스트
ADD COLUMN IF NOT EXISTS target_population TEXT, -- 일반인, 고위험군(흡연자, B형간염, 혈뇨 환자 등), 특정 연령/성별
ADD COLUMN IF NOT EXISTS clinical_use_cases TEXT[]; -- 스크리닝, 진단 보조, 동반진단, 재발 모니터링, 치료 반응 평가 등

-- 코멘트 추가
COMMENT ON COLUMN welno.welno_external_checkup_items.sensitivity IS '민감도 (%)';
COMMENT ON COLUMN welno.welno_external_checkup_items.specificity IS '특이도 (%)';
COMMENT ON COLUMN welno.welno_external_checkup_items.auc_score IS 'AUC 점수 (0-1)';
COMMENT ON COLUMN welno.welno_external_checkup_items.study_design IS '연구 설계: 전향/후향, 단일/다기관';
COMMENT ON COLUMN welno.welno_external_checkup_items.sample_size IS '주요 임상연구 샘플 수 (N)';
COMMENT ON COLUMN welno.welno_external_checkup_items.mfds_approval IS 'MFDS 허가 여부';
COMMENT ON COLUMN welno.welno_external_checkup_items.reimbursement_status IS '급여 상태: 급여/선별급여/비급여';
COMMENT ON COLUMN welno.welno_external_checkup_items.reference_urls IS '참고 자료 URL 리스트 (JSONB)';
COMMENT ON COLUMN welno.welno_external_checkup_items.clinical_summary IS '주요 임상연구 결과 요약 (벡터 DB 임베딩용)';


