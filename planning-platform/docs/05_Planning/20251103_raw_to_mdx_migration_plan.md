# raw_agr_list → mdx_agr_list 마이그레이션 계획

## 1. 테이블 구조 비교

### raw_agr_list 컬럼 (12개)
- hosnm (text, NOT NULL)
- hosaddr (text, nullable)
- name (text, NOT NULL)
- birthday (date, nullable)
- gender (char, nullable)
- phoneno (text, NOT NULL)
- regdate (date, NOT NULL)
- visitdate (date, nullable)
- rpt_mkt_ts (timestamp, nullable)
- mkt_idx (jsonb, nullable)
- sentto (jsonb, nullable)
- remarks (text, nullable)

### mdx_agr_list 컬럼 (50개)
- **공통 컬럼 (직접 매핑 가능):**
  - hosnm, hosaddr, name, birthday, gender, phoneno
  - regdate, visitdate, rpt_mkt_ts, mkt_idx, sentto, remarks

- **추가 필요 컬럼:**
  - uuid (uuid, nullable) → **생성 필요**
  - reg_year (integer, nullable) → **regdate에서 연도 추출**
  - hospitalid (integer, nullable) → **NULL 또는 매핑 로직 필요**

- **기타 컬럼 (기본값 처리):**
  - addr, height, weight, waist, bmi, bphigh, bplwst 등 검진 데이터 → NULL
  - cancerdata, etc, mdx_mkt, rpt_mkt, pln_mkt 등 → NULL
  - confirm_idx, contentsinfo, label_meta, label_tags 등 → NULL

## 2. 마이그레이션 대상 통계

**조건:**
- hosaddr LIKE '%충청%'
- regdate >= '2025-06-01'
- hosnm NOT LIKE '%천안우리병원%'
- sentto IS NULL

**결과:**
- 총 대상자: **688건** (DISTINCT phoneno 기준)
- mdx_agr_list에 이미 존재: **274건** (같은 전화번호)
- 새로 추가해야 할 레코드: **414건**

## 3. 마이그레이션 전략

### 3.1 중복 처리 방안

**옵션 A: 기존 레코드 무시하고 새로 추가** (권장하지 않음)
- 문제: 같은 전화번호가 여러 개 생성됨

**옵션 B: 기존 레코드 업데이트** (복잡함)
- 문제: 어떤 데이터를 기준으로 업데이트할지 불명확

**옵션 C: mdx_agr_list에 없는 레코드만 추가** (권장)
- 414건만 INSERT 수행
- 이미 존재하는 274건은 raw_agr_list에서만 삭제

### 3.2 UUID 생성 전략

**방법 1: PostgreSQL의 gen_random_uuid() 사용**
```sql
uuid = gen_random_uuid()
```

**방법 2: 기존 패턴 확인 후 동일하게 생성**
- mdx_agr_list의 UUID 패턴: 표준 UUID v4 형식

### 3.3 reg_year 생성

```sql
reg_year = EXTRACT(YEAR FROM regdate)::integer
```

### 3.4 hospitalid 처리

대부분 NULL이므로 NULL로 처리하거나, hosnm 기반 매핑 테이블이 있다면 사용

## 4. 마이그레이션 SQL (최종 안)

### Phase 1: 백업
```sql
-- raw_agr_list 백업
CREATE TABLE IF NOT EXISTS p9_mkt_biz.raw_agr_list_backup_20250102 AS
SELECT * FROM p9_mkt_biz.raw_agr_list
WHERE hosaddr LIKE '%충청%'
  AND regdate >= '2025-06-01'
  AND hosnm NOT LIKE '%천안우리병원%'
  AND sentto IS NULL;
```

### Phase 2: mdx_agr_list에 없는 레코드만 INSERT
```sql
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
  );
```

### Phase 3: 검증
```sql
-- INSERT된 레코드 수 확인
SELECT COUNT(*) AS inserted_count
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
```

### Phase 4: raw_agr_list에서 삭제
```sql
DELETE FROM p9_mkt_biz.raw_agr_list
WHERE hosaddr LIKE '%충청%'
  AND regdate >= '2025-06-01'
  AND hosnm NOT LIKE '%천안우리병원%'
  AND sentto IS NULL;
```

## 5. 주의사항

1. **트랜잭션 사용 필수**: 전체 작업을 하나의 트랜잭션으로 처리
2. **백업 필수**: 삭제 전 반드시 백업 테이블 생성
3. **검증 필수**: INSERT 후 데이터 정확성 확인
4. **DISTINCT ON 사용**: 같은 전화번호로 여러 레코드가 있을 경우 하나만 선택
5. **기존 레코드 확인**: mdx_agr_list에 이미 있는 경우 INSERT하지 않음

## 6. 실행 순서

1. 백업 테이블 생성 및 확인
2. INSERT 실행 및 결과 확인 (예상: 414건)
3. 검증 쿼리 실행
4. 검증 완료 후 raw_agr_list에서 삭제

