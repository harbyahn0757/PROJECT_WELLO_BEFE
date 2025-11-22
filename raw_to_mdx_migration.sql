-- ============================================================
-- raw_agr_list → mdx_agr_list 마이그레이션 스크립트
-- ============================================================
-- 조건: 충청 지역, 2025-06-01 이후, 천안우리병원 제외, sentto IS NULL
-- 예상 대상: 414건 (mdx_agr_list에 없는 레코드)
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
-- 같은 전화번호로 여러 레코드가 있는 경우:
-- - regdate DESC, rpt_mkt_ts DESC 순으로 가장 최신 레코드 선택
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
SELECT DISTINCT ON (r.phoneno)
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
  )
ORDER BY r.phoneno, r.regdate DESC, r.rpt_mkt_ts DESC NULLS LAST;

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
    );
    RAISE NOTICE 'INSERT 완료: % 건', inserted_count;
END $$;

-- ============================================================
-- Phase 3: 검증 쿼리
-- ============================================================

-- 1. 매칭 여부 확인
SELECT 
    '매칭 검증' AS check_type,
    COUNT(*) AS total_in_mdx,
    COUNT(*) FILTER (WHERE regdate >= '2025-06-01') AS after_2025_06
FROM p9_mkt_biz.mdx_agr_list m
WHERE EXISTS (
    SELECT 1 
    FROM p9_mkt_biz.raw_agr_list r
    WHERE r.hosaddr LIKE '%충청%'
      AND r.regdate >= '2025-06-01'
      AND r.hosnm NOT LIKE '%천안우리병원%'
      AND r.sentto IS NULL
      AND m.phoneno = r.phoneno
);

-- 2. 필수 필드 확인
SELECT 
    '필수 필드 검증' AS check_type,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE uuid IS NULL) AS null_uuid,
    COUNT(*) FILTER (WHERE phoneno IS NULL) AS null_phoneno,
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
);

-- ============================================================
-- Phase 4: raw_agr_list에서 삭제 (검증 완료 후)
-- ============================================================
-- 주의: 검증이 완료된 후에만 실행하세요!
-- ============================================================

-- DELETE FROM p9_mkt_biz.raw_agr_list
-- WHERE hosaddr LIKE '%충청%'
--   AND regdate >= '2025-06-01'
--   AND hosnm NOT LIKE '%천안우리병원%'
--   AND sentto IS NULL;

-- 삭제 전 확인 (실제 삭제는 위 주석 해제 후 실행)
SELECT 
    '삭제 대상' AS check_type,
    COUNT(*) AS records_to_delete
FROM p9_mkt_biz.raw_agr_list
WHERE hosaddr LIKE '%충청%'
  AND regdate >= '2025-06-01'
  AND hosnm NOT LIKE '%천안우리병원%'
  AND sentto IS NULL;

-- ============================================================
-- 롤백: 문제 발생 시
-- ============================================================
-- ROLLBACK;

-- 커밋: 모든 검증 완료 후
-- COMMIT;

