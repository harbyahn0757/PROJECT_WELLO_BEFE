# Scripts 폴더 구조

이 문서는 scripts 폴더의 재구성 내용을 설명합니다.

## 📁 최종 폴더 구조

```
scripts/
├── managers/          (3 scripts + README)
│   ├── patient_manager.py
│   ├── delete_manager.py
│   ├── delete_all_users.py
│   └── README.md
│
├── checkup/           (8 scripts + README)
│   ├── execute_hospital_checkup_items.py
│   ├── insert_external_checkup_items.py
│   ├── list_all_external_checkup_table.py
│   ├── list_database_checkup_items.py
│   ├── list_hospital_checkup_items.py
│   ├── list_optional_checkup_items.py
│   ├── map_hospital_external_checkup.py
│   ├── verify_hospital_checkup_items.py
│   ├── README.md
│   └── sql/
│       ├── create_checkup_design_table.sql
│       ├── create_external_checkup_items_table.sql
│       └── enhance_external_checkup_table.sql
│
├── database/          (9 scripts + README)
│   ├── check_column_types.py
│   ├── check_current_db.py
│   ├── check_db_schema.py
│   ├── check_welno_schema.py
│   ├── generate_elama_cloud_dataset.py
│   ├── migrate_data_source.py
│   ├── rebuild_welno_vector_db_ai.py
│   ├── reset_patient_flags.py
│   ├── update_patient_height_weight.py
│   ├── README.md
│   └── sql/
│       └── check_hospital_table.sql
│
├── dev-tools/         (4 scripts + README)
│   ├── check_actual_function.py
│   ├── check_actual_query.py
│   ├── show_full_function.py
│   ├── verify_model_usage.py
│   └── README.md
│
├── archive/           (17 scripts + 3 docs + README)
│   ├── debug_actual_code.py
│   ├── debug_all_params.py
│   ├── debug_parameters.py
│   ├── debug_raw_data.py
│   ├── debug_service_call.py
│   ├── fix_checksum_final.py
│   ├── test_jsonb.py
│   ├── test_jsonb_direct.py
│   ├── test_raw_sql.py
│   ├── test_baseline_performance.py
│   ├── test_campaign_payment.py
│   ├── test_improved_performance.py
│   ├── test_prompt_quality.py
│   ├── test_rag_performance.py
│   ├── test_checkup_design_validation.md
│   ├── TEST_PLAN_약관_저장_수정.md
│   ├── TEST_RESULTS_약관_저장_수정.md
│   ├── README.md
│   └── 04_migration/
│       └── test_performance.py
│
└── README.md          (메인 문서)
```

## 📊 통계

- **총 파일 수**: 51개 (이전 49개 → 정리 후)
- **Python 스크립트**: 39개
- **SQL 파일**: 4개
- **문서**: 8개 (6 README + 2 구조문서)

### 폴더별 파일 수
- `managers/`: 4개 (3 scripts + 1 README)
- `checkup/`: 12개 (8 scripts + 3 SQL + 1 README)
- `database/`: 11개 (9 scripts + 1 SQL + 1 README)
- `dev-tools/`: 5개 (4 scripts + 1 README)
- `archive/`: 21개 (14 scripts + 4 docs + 1 README + 1 migration folder)

## 🎯 주요 변경 사항

### 1. 테마별 폴더링
- 기존: 루트에 38개 스크립트 산재
- 변경: 5개 테마 폴더로 분류

### 2. SQL 파일 정리
- 기능별 폴더의 `sql/` 서브폴더로 이동
- 관련 스크립트와 함께 관리

### 3. 중복 파일 제거 및 통합
삭제된 파일:
- `fix_checksum.py` (fix_checksum_final.py만 유지)
- `simple_insert_test.py` (임시 테스트)
- `direct_save_test.py` (임시 테스트)
- `final_test.py` (임시 테스트)

backend 루트에서 archive로 이동:
- `test_baseline_performance.py`
- `test_campaign_payment.py`
- `test_improved_performance.py`
- `test_prompt_quality.py`
- `test_rag_performance.py`
- `TEST_PLAN_약관_저장_수정.md`
- `TEST_RESULTS_약관_저장_수정.md`

### 4. 문서화 강화
- 각 폴더별 README.md 추가
- 메인 README.md 재작성
- 사용법 및 예시 추가

### 5. 레거시 스크립트 아카이브
- debug_*.py (5개) → archive/
- test_*.py (8개) → archive/
  - scripts 폴더 내: 3개
  - backend 루트에서 이동: 5개
- TEST_*.md (2개) → archive/
- 04_migration/ → archive/
- 06_complete_rebuild/ 제거 (파일은 database/로 이동)

## 🚀 사용 가이드

### 일반 사용자
1. **환자 조회/관리**: `managers/patient_manager.py` 사용
2. **데이터 삭제**: `managers/delete_manager.py` 사용
3. **검진 항목 관리**: `checkup/` 폴더의 스크립트 사용

### 개발자
1. **DB 확인**: `database/check_*.py` 스크립트 사용
2. **디버깅**: `dev-tools/` 폴더의 도구 사용
3. **참고용 코드**: `archive/` 폴더 참조

## 📝 경로 변경 안내

기존 경로에서 새 경로로 변경:

| 기존 경로 | 새 경로 |
|---------|---------|
| `scripts/patient_manager.py` | `scripts/managers/patient_manager.py` |
| `scripts/delete_manager.py` | `scripts/managers/delete_manager.py` |
| `scripts/delete_all_users.py` | `scripts/managers/delete_all_users.py` |
| `scripts/map_hospital_external_checkup.py` | `scripts/checkup/map_hospital_external_checkup.py` |
| `scripts/check_db_schema.py` | `scripts/database/check_db_schema.py` |
| `scripts/create_external_checkup_items_table.sql` | `scripts/checkup/sql/create_external_checkup_items_table.sql` |

## ✅ 체크리스트

- [x] 테마별 폴더 생성
- [x] 스크립트 분류 및 이동
- [x] SQL 파일 정리
- [x] 중복 파일 제거
- [x] 각 폴더별 README 작성
- [x] 메인 README 업데이트
- [x] 구조 문서 작성

## 🔄 향후 계획

1. **archive 폴더 정리**: 3개월 이상 미사용 스크립트 삭제 검토
2. **통합 매니저 확장**: 더 많은 기능을 통합 스크립트로 추가
3. **자동화**: CI/CD 파이프라인에 통합 고려

---

**정리 완료일**: 2026-01-31  
**담당**: AI Assistant  
**상태**: ✅ 완료
