# 통합 관리 스크립트

환자 정보 조회 및 데이터 삭제를 위한 통합 관리 도구입니다.

## 📋 스크립트 목록

### 1. patient_manager.py - 환자 조회/관리

환자 정보 조회 및 관리를 위한 통합 스크립트입니다.

**주요 기능:**
- 환자 정보 조회 (UUID, 병원 ID)
- 전체 환자 목록 조회 (웰노/파트너 필터)
- 약관 동의 데이터 확인
- 건강데이터 확인
- 검진 설계 데이터 확인
- 파트너 상태 확인

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

# 약관 동의 확인
python scripts/managers/patient_manager.py terms ea2dce7e-c599-4b8f-8725-98d7dda7611b KIM_HW_CLINIC

# 파트너 상태 확인
python scripts/managers/patient_manager.py status bbfba40ee649d172c1cee9471249a535 --api-key 5a9bb40b5108ecd8ef864658d5a2d5ab --data "암호화된데이터"
```

---

### 2. delete_manager.py - 삭제 작업

데이터 삭제 작업을 위한 통합 스크립트입니다.

**주요 기능:**
- 모든 유저 삭제
- 테스트 데이터 삭제
- 특정 환자 삭제
- 건강데이터만 삭제

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

**예시:**
```bash
# 테스트 데이터 삭제
python scripts/managers/delete_manager.py test

# 특정 환자 삭제
python scripts/managers/delete_manager.py patient ea2dce7e-c599-4b8f-8725-98d7dda7611b KIM_HW_CLINIC

# 건강데이터만 삭제
python scripts/managers/delete_manager.py health ea2dce7e-c599-4b8f-8725-98d7dda7611b KIM_HW_CLINIC
```

**⚠️ 주의사항:**
- 삭제 작업은 되돌릴 수 없습니다.
- 실행 전에 반드시 백업을 권장합니다.
- 프로덕션 환경에서는 특히 신중하게 사용하세요.

---

### 3. delete_all_users.py - 모든 유저 삭제

모든 웰노/파트너사 유저를 삭제하는 스크립트입니다.

**사용법:**
```bash
python scripts/managers/delete_all_users.py
```

**⚠️ 경고:**
- 모든 유저 데이터를 삭제합니다.
- 되돌릴 수 없습니다.
- 삭제 전에 반드시 백업하세요.

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
