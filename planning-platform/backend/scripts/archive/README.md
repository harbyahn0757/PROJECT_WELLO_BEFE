# 아카이브

일회성 디버그/테스트 스크립트 및 폐기 대상 스크립트 모음입니다.

## 📁 포함 내용

### 디버그 스크립트 (debug_*.py)
- `debug_actual_code.py` - 실제 코드 디버깅
- `debug_all_params.py` - 모든 파라미터 디버깅
- `debug_parameters.py` - 파라미터 단계별 디버깅
- `debug_raw_data.py` - 원시 데이터 디버깅
- `debug_service_call.py` - 서비스 호출 디버깅

### 테스트 스크립트 (test_*.py)
- `test_jsonb.py` - JSONB 타입 처리 테스트
- `test_jsonb_direct.py` - JSONB 직접 처리 테스트
- `test_raw_sql.py` - Raw SQL 테스트
- `test_baseline_performance.py` - 기본 성능 측정 테스트
- `test_campaign_payment.py` - 캠페인 결제 테스트
- `test_improved_performance.py` - 개선 성능 측정 테스트
- `test_prompt_quality.py` - 프롬프트 품질 테스트
- `test_rag_performance.py` - RAG 성능 테스트

### 테스트 문서
- `test_checkup_design_validation.md` - 검진 설계 검증 문서
- `TEST_PLAN_약관_저장_수정.md` - 약관 저장 수정 테스트 계획
- `TEST_RESULTS_약관_저장_수정.md` - 약관 저장 수정 테스트 결과

### 임시 수정 스크립트
- `fix_checksum.py` - 체크섬 수정
- `fix_checksum_final.py` - 체크섬 최종 수정
- `simple_insert_test.py` - 간단한 삽입 테스트
- `direct_save_test.py` - 직접 저장 테스트
- `final_test.py` - 최종 테스트

### 레거시 폴더
- `04_migration/` - 이전 마이그레이션 관련 스크립트

---

## ⚠️ 주의사항

- 이 폴더의 스크립트들은 **사용하지 않는 것을 권장**합니다.
- 대부분 일회성 디버깅 목적으로 작성되었습니다.
- 삭제 예정이거나 더 이상 유지보수되지 않습니다.
- 필요한 경우 참고용으로만 사용하세요.

---

## 삭제 기준

다음 조건에 해당하는 스크립트는 삭제할 수 있습니다:

1. ✅ 3개월 이상 사용되지 않은 스크립트
2. ✅ 동일 기능의 통합 스크립트가 존재하는 경우
3. ✅ 프로젝트 코드에서 참조되지 않는 스크립트
4. ✅ 문서화되지 않은 일회성 테스트 스크립트

---

## 정리 권장 사항

이 폴더를 정기적으로 검토하고 불필요한 스크립트를 삭제하는 것을 권장합니다.

```bash
# 파일 수 확인
find scripts/archive -type f | wc -l

# 최근 수정 시간 확인
find scripts/archive -type f -mtime +90  # 90일 이상 수정 안된 파일
```
