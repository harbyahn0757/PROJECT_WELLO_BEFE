# Backend Scripts 사용 가이드

이 디렉토리는 백엔드 개발 및 운영을 위한 유틸리티 스크립트들을 포함합니다.

## 통합 스크립트

### 1. patient_manager.py - 환자 조회/관리

환자 정보 조회 및 관리를 위한 통합 스크립트입니다.

**사용법:**
```bash
# UUID로 환자 정보 조회
python scripts/patient_manager.py check <uuid> [hospital_id]

# 전체 환자 목록 조회
python scripts/patient_manager.py list [--welno|--partner]

# 약관 동의 데이터 확인
python scripts/patient_manager.py terms <uuid> [hospital_id]

# 건강데이터 확인
python scripts/patient_manager.py health <uuid> [hospital_id]

# 검진 설계 데이터 확인
python scripts/patient_manager.py design <uuid> [hospital_id]

# 파트너 상태 확인 (어떤 화면으로 가야 하는지)
python scripts/patient_manager.py status <uuid> [--api-key KEY] [--data DATA]
```

**예시:**
```bash
# 환자 정보 조회
python scripts/patient_manager.py check ea2dce7e-c599-4b8f-8725-98d7dda7611b KIM_HW_CLINIC

# 웰노 유저만 조회
python scripts/patient_manager.py list --welno

# 약관 동의 확인
python scripts/patient_manager.py terms ea2dce7e-c599-4b8f-8725-98d7dda7611b KIM_HW_CLINIC

# 파트너 상태 확인
python scripts/patient_manager.py status bbfba40ee649d172c1cee9471249a535 --api-key 5a9bb40b5108ecd8ef864658d5a2d5ab --data "암호화된데이터"
```

---

### 2. delete_manager.py - 삭제 작업

데이터 삭제 작업을 위한 통합 스크립트입니다.

**사용법:**
```bash
# 모든 유저 삭제 (주의: 되돌릴 수 없음)
python scripts/delete_manager.py all

# 테스트 데이터 삭제
python scripts/delete_manager.py test

# 특정 환자 삭제
python scripts/delete_manager.py patient <uuid> [hospital_id]

# 건강데이터만 삭제 (환자 정보는 유지)
python scripts/delete_manager.py health <uuid> [hospital_id]
```

**예시:**
```bash
# 테스트 데이터 삭제
python scripts/delete_manager.py test

# 특정 환자 삭제
python scripts/delete_manager.py patient ea2dce7e-c599-4b8f-8725-98d7dda7611b KIM_HW_CLINIC

# 건강데이터만 삭제
python scripts/delete_manager.py health ea2dce7e-c599-4b8f-8725-98d7dda7611b KIM_HW_CLINIC
```

**주의사항:**
- `all` 명령은 모든 유저 데이터를 삭제합니다. 되돌릴 수 없으므로 신중하게 사용하세요.
- 삭제 전에 백업을 권장합니다.

---

### 3. test_rag.py - RAG 테스트

RAG 시스템 테스트를 위한 통합 스크립트입니다.

**사용법:**
```bash
# 간단한 RAG 테스트
python scripts/test_rag.py simple [--limit N]

# 빠른 RAG 테스트 (복잡한 로직은 test_rag_quick.py 참고)
python scripts/test_rag.py quick [--limit N]

# 실제 데이터로 RAG 테스트 (복잡한 로직은 test_rag_with_real_data.py 참고)
python scripts/test_rag.py real [--limit N]

# 실제 환자 데이터로 RAG 테스트 (복잡한 로직은 test_rag_with_real_patients.py 참고)
python scripts/test_rag.py patients [--limit N]
```

**참고:**
- `quick`, `real`, `patients` 명령은 복잡한 로직이 필요하므로 기존 개별 스크립트를 직접 사용하는 것을 권장합니다.

---

### 4. test_terms_agreement_pipeline.py - 약관 저장 통합 테스트

약관 저장 수정 관련 모든 Phase 테스트를 통합한 스크립트입니다.

**사용법:**
```bash
python scripts/test_terms_agreement_pipeline.py
```

**테스트 내용:**
- Phase 0: verify_terms_agreement 함수 테스트
- Phase 2+3: register-patient API 통합 테스트
- Phase 3-1: save_patient_data 함수 필드 저장 테스트

---

### 5. check_terms_agreement.py - 약관 동의 데이터 확인

특정 UUID의 약관 동의 데이터를 상세히 조회하는 스크립트입니다.

**사용법:**
```bash
python scripts/check_terms_agreement.py <uuid> [hospital_id]
```

**예시:**
```bash
python scripts/check_terms_agreement.py ea2dce7e-c599-4b8f-8725-98d7dda7611b KIM_HW_CLINIC
```

**출력 내용:**
- 환자 기본 정보
- 약관 동의 정보 (terms_agreement, terms_agreement_detail)
- 약관 동의 시각
- verify_terms_agreement 함수 검증 결과
- 파트너 결제 정보 (파트너사 유저인 경우)

---

### 6. delete_all_users.py - 모든 유저 삭제

모든 웰노/파트너사 유저를 삭제하는 스크립트입니다.

**사용법:**
```bash
python scripts/delete_all_users.py
```

**주의사항:**
- 모든 유저 데이터를 삭제합니다. 되돌릴 수 없습니다.
- 삭제 전에 백업을 권장합니다.

---

## 카테고리별 스크립트 목록

### 환자 조회 관련
- `patient_manager.py` - 통합 환자 조회/관리 스크립트
- `check_terms_agreement.py` - 약관 동의 데이터 확인

### 삭제 관련
- `delete_manager.py` - 통합 삭제 스크립트
- `delete_all_users.py` - 모든 유저 삭제

### 테스트 관련
- `test_terms_agreement_pipeline.py` - 약관 저장 통합 테스트
- `test_rag.py` - RAG 테스트 통합 스크립트
- `test_rag_quick.py` - RAG 빠른 테스트 (복잡한 로직)
- `test_rag_with_real_data.py` - RAG 실제 데이터 테스트 (복잡한 로직)
- `test_rag_with_real_patients.py` - RAG 실제 환자 테스트 (복잡한 로직)
- `test_checkup_design_api.py` - 검진 설계 API 테스트
- `test_get_patient_health_data.py` - 환자 건강데이터 조회 테스트
- `test_mediarc_fields.py` - Mediarc 필드 테스트
- `test_password_verify.py` - 비밀번호 검증 테스트
- `test_questionnaire_mapping.py` - 설문지 매핑 테스트

### 확인 스크립트
- `check_db_structure.py` - DB 구조 확인
- `check_categories.py` - 카테고리 확인
- `check_design_result.py` - 설계 결과 확인
- `check_hospital_table.py` - 병원 테이블 확인
- `check_password_and_birthday.py` - 비밀번호/생년월일 확인
- `check_prescription_data.py` - 처방전 데이터 확인
- `check_raw_data_structure.py` - 원시 데이터 구조 확인
- `check_session_data.py` - 세션 데이터 확인
- `check_tilko_data_simple.py` - Tilko 데이터 간단 확인
- `check_tilko_save_time.py` - Tilko 저장 시간 확인
- `check_unused_files.py` - 미사용 파일 확인

### 데이터 관리
- `reset_patient_flags.py` - 환자 플래그 리셋
- `update_patient_height_weight.py` - 환자 키/몸무게 업데이트
- `migrate_data_source.py` - 데이터 출처 마이그레이션

### 검진 설계 관련
- `verify_hospital_checkup_items.py` - 병원 검진 항목 검증
- `list_hospital_checkup_items.py` - 병원 검진 항목 목록
- `list_database_checkup_items.py` - DB 검진 항목 목록
- `list_optional_checkup_items.py` - 선택 검진 항목 목록
- `list_all_external_checkup_table.py` - 외부 검진 테이블 목록
- `insert_external_checkup_items.py` - 외부 검진 항목 삽입
- `execute_hospital_checkup_items.py` - 병원 검진 항목 실행
- `map_hospital_external_checkup.py` - 병원-외부 검진 매핑

### 기타
- `show_completed_prompt.py` - 완료 프롬프트 표시
- `verify_model_usage.py` - 모델 사용량 검증
- `generate_elama_cloud_dataset.py` - Elama Cloud 데이터셋 생성

---

## 환경 설정

스크립트들은 `.env.local` 파일에서 DB 연결 정보를 읽습니다.

**필수 환경 변수:**
- `DB_HOST` - 데이터베이스 호스트 (기본값: 10.0.1.10)
- `DB_PORT` - 데이터베이스 포트 (기본값: 5432)
- `DB_NAME` - 데이터베이스 이름 (기본값: p9_mkt_biz)
- `DB_USER` - 데이터베이스 사용자 (기본값: peernine)
- `DB_PASSWORD` - 데이터베이스 비밀번호

**설정 파일 위치:**
```
planning-platform/backend/.env.local
```

---

## 주의사항

1. **삭제 작업**: 삭제 스크립트는 되돌릴 수 없습니다. 실행 전에 백업을 권장합니다.
2. **테스트 환경**: 프로덕션 환경에서 스크립트를 실행하기 전에 테스트 환경에서 먼저 확인하세요.
3. **권한 확인**: DB 접근 권한이 있는지 확인하세요.

---

## 문제 해결

### DB 연결 오류
- `.env.local` 파일이 올바른 위치에 있는지 확인
- DB 연결 정보가 올바른지 확인
- DB 서버가 실행 중인지 확인

### 모듈 import 오류
- Python 경로가 올바르게 설정되어 있는지 확인
- 필요한 패키지가 설치되어 있는지 확인 (`asyncpg`, `python-dotenv` 등)

---

## 추가 정보

더 자세한 정보는 각 스크립트의 docstring을 참고하세요.
