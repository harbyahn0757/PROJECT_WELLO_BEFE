# 검사 항목 하드코딩 데이터 정리 요약

## 작업 완료

### ✅ 완료된 작업

1. **데이터베이스와 코드 동기화 확인**
   - 데이터베이스에 외부 검사 항목 15개 저장 확인
   - 코드에 하드코딩된 36개 항목 중 일부만 입력된 상태 확인

2. **하드코딩 데이터 정리**
   - 초기 입력용 스크립트에만 하드코딩 데이터 유지
   - 실제 서비스 코드에서는 데이터베이스 조회 방식 사용
   - 스크립트에 주석 추가하여 초기 입력용임을 명시

3. **목록 출력 스크립트 변경**
   - `list_code_checkup_items.py` 삭제 (하드코딩 데이터 기반)
   - `list_database_checkup_items.py` 생성 (데이터베이스 조회 기반)

---

## 변경 사항

### 1. 삭제된 파일
- `planning-platform/backend/scripts/list_code_checkup_items.py`
  - 하드코딩된 데이터를 import하여 사용하던 스크립트
  - 데이터베이스와 싱크가 맞지 않음

### 2. 새로 생성된 파일
- `planning-platform/backend/scripts/list_database_checkup_items.py`
  - 데이터베이스에서 직접 조회하는 스크립트
  - `wello_external_checkup_items` 테이블 조회
  - `wello_hospitals.recommended_items` (JSONB) 조회

### 3. 수정된 파일

#### `insert_external_checkup_items.py`
- 주석 추가: 초기 데이터 입력용임을 명시
- 실제 서비스 코드에서는 사용하지 않음을 명시

#### `execute_hospital_checkup_items.py`
- 주석 추가: 초기 데이터 입력용임을 명시
- 실제 서비스 코드에서는 사용하지 않음을 명시

---

## 현재 구조

### 데이터 흐름

```
초기 데이터 입력 (1회 실행)
├── insert_external_checkup_items.py
│   └── EXTERNAL_CHECKUP_ITEMS (하드코딩) → wello_external_checkup_items 테이블
└── execute_hospital_checkup_items.py
    └── recommended_items (하드코딩) → wello_hospitals.recommended_items (JSONB)

실제 서비스 코드 (매번 실행)
└── wello_data_service.py
    └── get_hospital_by_id()
        ├── wello_external_checkup_items 테이블 조회
        ├── wello_hospital_external_checkup_mapping 테이블 조회 (병원별 매핑)
        └── wello_hospitals.recommended_items (JSONB) 조회
```

### 데이터베이스 구조

1. **wello_external_checkup_items** (기준 테이블)
   - 외부 검사 항목의 마스터 데이터
   - 현재 15개 항목 저장됨

2. **wello_hospital_external_checkup_mapping** (매핑 테이블)
   - 병원별로 외부 검사 항목 매핑
   - `hospital_id` + `external_checkup_item_id` 조합

3. **wello_hospitals.recommended_items** (JSONB)
   - 병원별 추천 항목
   - JSONB 형식으로 저장

---

## 확인 사항

### ✅ 데이터베이스 상태
- 외부 검사 항목: 15개 (Low: 2개, Mid: 5개, High: 8개)
- 병원 추천 항목: KIM_HW_CLINIC에 4개 저장됨

### ✅ 코드 상태
- 실제 서비스 코드(`app/`)에서는 하드코딩 데이터 사용 안 함
- 모든 데이터는 `wello_data_service.get_hospital_by_id()`를 통해 조회
- 초기 입력용 스크립트에만 하드코딩 데이터 유지

---

## 사용 방법

### 데이터베이스 목록 확인
```bash
# 데이터베이스에 저장된 검사 항목 목록 출력
python backend/scripts/list_database_checkup_items.py
```

### 초기 데이터 입력 (필요 시)
```bash
# 외부 검사 항목 입력 (중복 체크 포함)
python backend/scripts/insert_external_checkup_items.py

# 병원 추천 항목 입력
python backend/scripts/execute_hospital_checkup_items.py
```

### 병원별 검사 항목 확인
```bash
# 특정 병원의 검사 항목 목록 출력
python backend/scripts/list_hospital_checkup_items.py KIM_HW_CLINIC
```

---

## 결론

1. ✅ **하드코딩 데이터 정리 완료**
   - 초기 입력용 스크립트에만 유지
   - 실제 서비스 코드에서는 사용하지 않음

2. ✅ **데이터베이스 기반 동작**
   - 모든 서비스 코드는 데이터베이스에서 조회
   - 병원별 매핑 테이블을 통해 관리

3. ✅ **확장성 확보**
   - 새로운 검사 항목 추가 시 데이터베이스에만 추가
   - 코드 수정 없이 데이터베이스만 업데이트하면 됨

---

## 참고

- 초기 입력용 스크립트는 유지하되, 실제 서비스에서는 사용하지 않음
- 데이터베이스가 "단일 진실의 원천(Single Source of Truth)" 역할
- 병원별 매핑은 `wello_hospital_external_checkup_mapping` 테이블로 관리


