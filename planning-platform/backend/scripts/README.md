# Backend Scripts 사용 가이드

이 디렉토리는 백엔드 개발 및 운영을 위한 유틸리티 스크립트들을 포함합니다.

## 📁 폴더 구조

```
scripts/
├── managers/          # 통합 관리 스크립트 (환자 조회, 삭제 등)
├── checkup/          # 검진 항목 관리 (외부 검진 포함)
├── database/         # DB 스키마, 마이그레이션, 데이터 관리
├── dev-tools/        # 개발/디버그용 확인 도구
└── archive/          # 일회성/폐기 대상 스크립트
```

---

## 🚀 주요 스크립트

### 1. 환자 관리 (`managers/`)

#### patient_manager.py - 환자 조회/관리

환자 정보 조회 및 관리를 위한 통합 스크립트입니다.

**사용법:**
```bash
# UUID로 환자 정보 조회
python scripts/managers/patient_manager.py check <uuid> [hospital_id]

# 전체 환자 목록 조회
python scripts/managers/patient_manager.py list [--welno|--partner]

# 약관 동의 데이터 확인
python scripts/managers/patient_manager.py terms <uuid> [hospital_id]

# 건강데이터 확인
python scripts/managers/patient_manager.py health <uuid> [hospital_id]

# 검진 설계 데이터 확인
python scripts/managers/patient_manager.py design <uuid> [hospital_id]

# 파트너 상태 확인
python scripts/managers/patient_manager.py status <uuid> [--api-key KEY] [--data DATA]
```

**예시:**
```bash
# 환자 정보 조회
python scripts/managers/patient_manager.py check ea2dce7e-c599-4b8f-8725-98d7dda7611b KIM_HW_CLINIC

# 웰노 유저만 조회
python scripts/managers/patient_manager.py list --welno
```

---

#### delete_manager.py - 삭제 작업

데이터 삭제 작업을 위한 통합 스크립트입니다.

**사용법:**
```bash
# 모든 유저 삭제 (주의: 되돌릴 수 없음)
python scripts/managers/delete_manager.py all

# 테스트 데이터 삭제
python scripts/managers/delete_manager.py test

# 특정 환자 삭제
python scripts/managers/delete_manager.py patient <uuid> [hospital_id]

# 건강데이터만 삭제 (환자 정보는 유지)
python scripts/managers/delete_manager.py health <uuid> [hospital_id]
```

**주의사항:**
- 삭제 작업은 되돌릴 수 없습니다. 실행 전에 백업을 권장합니다.

---

#### delete_all_users.py - 모든 유저 삭제

모든 웰노/파트너사 유저를 삭제하는 스크립트입니다.

```bash
python scripts/managers/delete_all_users.py
```

---

### 2. 검진 항목 관리 (`checkup/`)

외부 검진 항목을 기준 테이블로 관리하고 병원별로 매핑하는 시스템입니다.

자세한 사용법은 `checkup/README.md`를 참고하세요.

**주요 스크립트:**
- `insert_external_checkup_items.py` - 외부 검진 항목 초기 데이터 삽입
- `map_hospital_external_checkup.py` - 병원별 검진 항목 매핑
- `list_hospital_checkup_items.py` - 병원 검진 항목 목록 조회
- `verify_hospital_checkup_items.py` - 병원 검진 항목 검증

**SQL 스크립트:**
- `sql/create_external_checkup_items_table.sql` - 외부 검진 항목 테이블 생성
- `sql/create_checkup_design_table.sql` - 검진 설계 테이블 생성
- `sql/enhance_external_checkup_table.sql` - 외부 검진 테이블 개선

---

### 3. 데이터베이스 관리 (`database/`)

DB 스키마 확인, 마이그레이션, 데이터 관리 스크립트입니다.

**스키마 확인:**
- `check_current_db.py` - 현재 DB 상태 확인
- `check_db_schema.py` - DB 스키마 상세 확인
- `check_welno_schema.py` - 웰노 스키마 확인
- `check_column_types.py` - 컬럼 타입 확인

**데이터 관리:**
- `migrate_data_source.py` - 데이터 출처 마이그레이션
- `update_patient_height_weight.py` - 환자 키/몸무게 업데이트
- `reset_patient_flags.py` - 환자 플래그 리셋
- `rebuild_welno_vector_db_ai.py` - 웰노 벡터 DB AI 재구축
- `generate_elama_cloud_dataset.py` - Elama Cloud 데이터셋 생성

**SQL 스크립트:**
- `sql/check_hospital_table.sql` - 병원 테이블 확인 쿼리

---

### 4. 개발 도구 (`dev-tools/`)

개발 및 디버깅용 확인 도구입니다.

- `check_actual_function.py` - 실제 실행 함수 코드 확인
- `check_actual_query.py` - 실제 실행 쿼리 확인
- `show_full_function.py` - 전체 함수 코드 표시
- `verify_model_usage.py` - 모델 사용량 검증

---

### 5. 아카이브 (`archive/`)

일회성 디버그/테스트 스크립트 및 폐기 대상 스크립트입니다.

**포함 내용:**
- 디버그 스크립트 (debug_*.py)
- 테스트 스크립트 (test_*.py)
- 임시 수정 스크립트 (fix_*.py)
- 레거시 마이그레이션 폴더 (04_migration/)

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
