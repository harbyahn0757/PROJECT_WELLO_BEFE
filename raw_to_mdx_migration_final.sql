-- ============================================================
-- raw_agr_list → mdx_agr_list 마이그레이션 스크립트 (최종)
-- ============================================================
-- 조건: 충청 지역, 2025-06-01 이후, 천안우리병원 제외, sentto IS NULL
-- UNIQUE 제약조건: (phoneno, name, hosnm, reg_year)
-- 예상 INSERT 대상: 584건
-- ============================================================

BEGIN;

-- ============================================================
-- Phase 1: 백업 테이블 생성
-- ============================================================
CREATE TABLE IF NOT EXISTS p9_mkt_biz.raw_agr_list_backup_migration_20250102 AS
SELECT * 
FROM p9_mkt_biz.raw_agr_list
WHERE hosaddr LIKE '%충청%'
  AND regdate >= '2025-06-01'
  AND hosnm NOT LIKE '%천안우리병원%'
  AND sentto IS NULL;

-- 백업 레코드 수 확인
DO $$
DECLARE
    backup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO backup_count 
    FROM p9_mkt_biz.raw_agr_list_backup_migration_20250102;
    RAISE NOTICE '백업 완료: % 건', backup_count;
END $$;

-- ============================================================
-- Phase 2: mdx_agr_list에 없는 레코드만 INSERT
-- ============================================================
-- UNIQUE 제약조건: (phoneno, name, hosnm, reg_year)
-- 같은 조합이 이미 있으면 INSERT하지 않음
-- ============================================================

INSERT INTO p9_mkt_biz.mdx_agr_list (
    uuid,
    reg_year,
    hosnm,
    hosaddr,
    name,
    birthday,
    gender,
    phoneno,
    regdate,
    visitdate,
    rpt_mkt_ts,
    mkt_idx,
    sentto,
    remarks
)
SELECT DISTINCT ON (r.phoneno, r.name, r.hosnm, EXTRACT(YEAR FROM r.regdate)::integer)
    gen_random_uuid() AS uuid,
    EXTRACT(YEAR FROM r.regdate)::integer AS reg_year,
    r.hosnm,
    r.hosaddr,
    r.name,
    r.birthday,
    r.gender,
    r.phoneno,
    r.regdate,
    r.visitdate,
    r.rpt_mkt_ts,
    r.mkt_idx,
    r.sentto,
    r.remarks
FROM p9_mkt_biz.raw_agr_list r
WHERE r.hosaddr LIKE '%충청%'
  AND r.regdate >= '2025-06-01'
  AND r.hosnm NOT LIKE '%천안우리병원%'
  AND r.sentto IS NULL
  AND NOT EXISTS (
      SELECT 1 
      FROM p9_mkt_biz.mdx_agr_list m 
      WHERE m.phoneno = r.phoneno
        AND m.name = r.name
        AND m.hosnm = r.hosnm
        AND m.reg_year = EXTRACT(YEAR FROM r.regdate)::integer
  )
ORDER BY r.phoneno, r.name, r.hosnm, EXTRACT(YEAR FROM r.regdate)::integer, 
         r.regdate DESC, r.rpt_mkt_ts DESC NULLS LAST;

-- INSERT 결과 확인
DO $$
DECLARE
    inserted_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO inserted_count
    FROM p9_mkt_biz.mdx_agr_list m
    WHERE EXISTS (
        SELECT 1 
        FROM p9_mkt_biz.raw_agr_list r
        WHERE r.hosaddr LIKE '%충청%'
          AND r.regdate >= '2025-06-01'
          AND r.hosnm NOT LIKE '%천안우리병원%'
          AND r.sentto IS NULL
          AND m.phoneno = r.phoneno
          AND m.name = r.name
          AND m.hosnm = r.hosnm
          AND m.reg_year = EXTRACT(YEAR FROM r.regdate)::integer
    );
    RAISE NOTICE 'INSERT 완료: % 건', inserted_count;
END $$;

-- ============================================================
-- Phase 3: 검증 쿼리
-- ============================================================

-- 3-1. 매칭 여부 확인
SELECT 
    '매칭 검증' AS check_type,
    COUNT(*) AS total_in_mdx,
    COUNT(*) FILTER (WHERE regdate >= '2025-06-01') AS after_2025_06,
    COUNT(*) FILTER (WHERE hosaddr LIKE '%충청%') AS chungcheong_region
FROM p9_mkt_biz.mdx_agr_list m
WHERE EXISTS (
    SELECT 1 
    FROM p9_mkt_biz.raw_agr_list r
    WHERE r.hosaddr LIKE '%충청%'
      AND r.regdate >= '2025-06-01'
      AND r.hosnm NOT LIKE '%천안우리병원%'
      AND r.sentto IS NULL
      AND m.phoneno = r.phoneno
      AND m.name = r.name
      AND m.hosnm = r.hosnm
      AND m.reg_year = EXTRACT(YEAR FROM r.regdate)::integer
);

-- 3-2. 필수 필드 확인
SELECT 
    '필수 필드 검증' AS check_type,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE uuid IS NULL) AS null_uuid,
    COUNT(*) FILTER (WHERE phoneno IS NULL) AS null_phoneno,
    COUNT(*) FILTER (WHERE name IS NULL) AS null_name,
    COUNT(*) FILTER (WHERE regdate IS NULL) AS null_regdate
FROM p9_mkt_biz.mdx_agr_list m
WHERE EXISTS (
    SELECT 1 
    FROM p9_mkt_biz.raw_agr_list r
    WHERE r.hosaddr LIKE '%충청%'
      AND r.regdate >= '2025-06-01'
      AND r.hosnm NOT LIKE '%천안우리병원%'
      AND r.sentto IS NULL
      AND m.phoneno = r.phoneno
      AND m.name = r.name
      AND m.hosnm = r.hosnm
      AND m.reg_year = EXTRACT(YEAR FROM r.regdate)::integer
);

-- 3-3. UNIQUE 제약조건 확인 (중복 검증)
SELECT 
    'UNIQUE 제약조건 검증' AS check_type,
    phoneno,
    name,
    hosnm,
    reg_year,
    COUNT(*) AS duplicate_count
FROM p9_mkt_biz.mdx_agr_list
WHERE EXISTS (
    SELECT 1 
    FROM p9_mkt_biz.raw_agr_list r
    WHERE r.hosaddr LIKE '%충청%'
      AND r.regdate >= '2025-06-01'
      AND r.hosnm NOT LIKE '%천안우리병원%'
      AND r.sentto IS NULL
      AND mdx_agr_list.phoneno = r.phoneno
      AND mdx_agr_list.name = r.name
      AND mdx_agr_list.hosnm = r.hosnm
      AND mdx_agr_list.reg_year = EXTRACT(YEAR FROM r.regdate)::integer
)
GROUP BY phoneno, name, hosnm, reg_year
HAVING COUNT(*) > 1;

-- ============================================================
-- Phase 4: raw_agr_list에서 삭제 (검증 완료 후 실행)
-- ============================================================
-- 주의: 모든 검증이 완료되고 문제가 없을 때만 주석 해제하고 실행하세요!
-- ============================================================

-- 삭제 전 확인
SELECT 
    '삭제 대상 확인' AS check_type,
    COUNT(*) AS records_to_delete
FROM p9_mkt_biz.raw_agr_list
WHERE hosaddr LIKE '%충청%'
  AND regdate >= '2025-06-01'
  AND hosnm NOT LIKE '%천안우리병원%'
  AND sentto IS NULL;

-- 실제 삭제 실행 (검증 완료 후 주석 해제)
-- DELETE FROM p9_mkt_biz.raw_agr_list
-- WHERE hosaddr LIKE '%충청%'
--   AND regdate >= '2025-06-01'
--   AND hosnm NOT LIKE '%천안우리병원%'
--   AND sentto IS NULL;

-- ============================================================
-- 롤백: 문제 발생 시
-- ============================================================
-- ROLLBACK;

-- 커밋: 모든 검증 완료 후
-- COMMIT;

