# 데이터베이스 관리 스크립트

DB 스키마 확인, 마이그레이션, 데이터 관리를 위한 스크립트 모음입니다.

## 📋 스크립트 목록

### DB 스키마 확인

#### check_current_db.py
현재 DB 상태를 확인합니다.

```bash
python scripts/database/check_current_db.py
```

#### check_db_schema.py
DB 스키마를 상세히 확인합니다.

```bash
python scripts/database/check_db_schema.py
```

#### check_welno_schema.py
웰노 관련 테이블 스키마를 확인합니다.

```bash
python scripts/database/check_welno_schema.py
```

#### check_column_types.py
테이블 컬럼 타입을 확인합니다.

```bash
python scripts/database/check_column_types.py
```

---

### 데이터 마이그레이션 및 관리

#### migrate_data_source.py
데이터 출처를 마이그레이션합니다.

```bash
python scripts/database/migrate_data_source.py
```

#### update_patient_height_weight.py
환자의 키와 몸무게 데이터를 업데이트합니다.

```bash
python scripts/database/update_patient_height_weight.py
```

#### reset_patient_flags.py
환자 플래그를 초기화합니다.

```bash
python scripts/database/reset_patient_flags.py
```

#### rebuild_welno_vector_db_ai.py
웰노 벡터 DB AI를 재구축합니다.

```bash
python scripts/database/rebuild_welno_vector_db_ai.py
```

#### generate_elama_cloud_dataset.py
Elama Cloud용 데이터셋을 생성합니다.

```bash
python scripts/database/generate_elama_cloud_dataset.py
```

---

### SQL 스크립트

#### sql/check_hospital_table.sql
병원 테이블을 확인하는 SQL 쿼리입니다.

```bash
psql -h 10.0.1.10 -U peernine -d p9_mkt_biz -f scripts/database/sql/check_hospital_table.sql
```

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

1. **백업**: 데이터 마이그레이션이나 업데이트 전에 반드시 백업하세요.
2. **테스트**: 프로덕션 환경 적용 전 테스트 환경에서 먼저 확인하세요.
3. **권한**: DB 접근 권한이 있는지 확인하세요.
