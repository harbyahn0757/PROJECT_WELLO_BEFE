# raw_agr_list vs mdx_agr_list 필드 비교 및 매핑 요약

**생성일**: 2026-01-10  
**작업일자**: 2026-01-10  
**작업내용**: raw_agr_list와 mdx_agr_list 필드 비교 및 매핑 요약

---

## 필드 매핑 테이블

| raw_agr_list | mdx_agr_list | 매핑 방식 | 비고 |
|-------------|--------------|-----------|------|
| hosnm | hosnm | 직접 복사 | text |
| hosaddr | hosaddr | 직접 복사 | text |
| name | name | 직접 복사 | text |
| birthday | birthday | 직접 복사 | date |
| gender | gender | 직접 복사 | char(1) |
| phoneno | phoneno | 직접 복사 | text (매칭 키) |
| regdate | regdate | 직접 복사 | date |
| visitdate | visitdate | 직접 복사 | date |
| rpt_mkt_ts | rpt_mkt_ts | 직접 복사 | timestamp |
| mkt_idx | mkt_idx | 직접 복사 | jsonb |
| sentto | sentto | 직접 복사 | jsonb |
| remarks | remarks | 직접 복사 | text |
| **없음** | uuid | **생성 필요** | gen_random_uuid() |
| **없음** | reg_year | **생성 필요** | EXTRACT(YEAR FROM regdate) |
| **없음** | hospitalid | **NULL 처리** | NULL |

## 매핑 불가능한 mdx_agr_list 필드들

다음 필드들은 NULL로 처리됩니다:
- addr, height, weight, waist, bmi, bphigh, bplwst 등 (검진 데이터)
- sgotast, sgptalt, gammagtp, totchole, hdlchole, ldlchole 등 (검진 수치)
- triglyceride, blds, creatinine, gfr, hmg (검진 수치)
- cancerdata, etc (jsonb) - NULL
- mdx_mkt, rpt_mkt, pln_mkt 등 (마케팅 관련) - NULL
- oa, ao, va, ha, tcd, opa, ma (기타 필드) - NULL
- confirm_idx, contentsinfo, label_meta, label_tags - NULL

## 중복 처리 전략

- **같은 전화번호가 여러 레코드인 경우:**
  - DISTINCT ON (phoneno) 사용
  - 정렬 기준: regdate DESC, rpt_mkt_ts DESC NULLS LAST
  - 가장 최신 레코드만 선택

## 마이그레이션 대상 통계

- 총 대상: 688건 (DISTINCT phoneno 기준)
- 이미 mdx_agr_list에 존재: 274건
- **실제 INSERT 대상: 414건**
- 중복 전화번호 (2건 이상): 2건 (총 4개 레코드)

## 주요 차이점 요약

1. **uuid 필드**: raw_agr_list에는 없음 → UUID 생성 필요
2. **reg_year 필드**: raw_agr_list에는 없음 → regdate에서 추출
3. **hospitalid 필드**: raw_agr_list에는 없음 → NULL 처리
4. **검진 데이터**: raw_agr_list에는 없음 → NULL 처리
5. **추가 마케팅 필드**: raw_agr_list에는 없음 → NULL 처리

## 안전 장치

1. **백업 필수**: raw_agr_list_backup_migration_YYYYMMDD 테이블 생성
2. **중복 체크**: mdx_agr_list에 이미 있는 전화번호는 INSERT하지 않음
3. **트랜잭션**: 전체 작업을 BEGIN/COMMIT으로 묶어서 롤백 가능
4. **검증 단계**: INSERT 후 반드시 검증 쿼리 실행
5. **단계별 실행**: 백업 → INSERT → 검증 → 삭제 순서로 진행

