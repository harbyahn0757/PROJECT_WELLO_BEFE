# 프롬프트 검진 설계 반영 확인

## ✅ 확인 완료: 프롬프트에 잘 반영됩니다!

---

## 1. 데이터 흐름 확인

### 1.1 데이터베이스 → 서비스 코드

```
wello_data_service.get_hospital_by_id(hospital_id)
  ↓
  ├── wello_hospitals.national_checkup_items (JSONB)
  ├── wello_hospitals.recommended_items (JSONB)
  └── wello_hospital_external_checkup_mapping (JOIN)
      └── wello_external_checkup_items
```

### 1.2 서비스 코드 → 프롬프트 생성

```
checkup_design.py (API 엔드포인트)
  ↓
  hospital_info = await wello_data_service.get_hospital_by_id(hospital_id)
  ├── hospital_national_checkup = hospital_info.get("national_checkup_items")
  ├── hospital_recommended = hospital_info.get("recommended_items")
  └── hospital_external_checkup = hospital_info.get("external_checkup_items", [])
  ↓
  create_checkup_design_prompt_*(
    hospital_national_checkup=hospital_national_checkup,
    hospital_recommended=hospital_recommended,
    hospital_external_checkup=hospital_external_checkup
  )
```

### 1.3 프롬프트 생성 함수 내부

```
format_hospital_checkup_items_for_prompt(
  national_checkup_items,
  recommended_items,
  external_checkup_items
)
  ↓
  ├── 카테고리별 분류 (일반/기본검진, 종합, 옵션)
  ├── 우선순위 분류 규칙 명시
  └── JSON 형식으로 포맷팅
  ↓
  프롬프트에 포함
```

---

## 2. 실제 코드 확인

### 2.1 API 엔드포인트 (`checkup_design.py`)

**Legacy 엔드포인트** (`/create`):
```python
# Line 147-162
hospital_info = await wello_data_service.get_hospital_by_id(request.hospital_id)
hospital_national_checkup = hospital_info.get("national_checkup_items")
hospital_recommended = hospital_info.get("recommended_items")
hospital_external_checkup = hospital_info.get("external_checkup_items", [])

# Line 988-992
hospital_checkup_section = format_hospital_checkup_items_for_prompt(
    hospital_national_checkup,
    hospital_recommended,
    hospital_external_checkup
)
```

**STEP 1 엔드포인트** (`/create-step1`):
```python
# Line 601-606
hospital_info = await wello_data_service.get_hospital_by_id(request.hospital_id)
hospital_national_checkup = hospital_info.get("national_checkup_items")

# Line 662
hospital_national_checkup=hospital_national_checkup,
```

**STEP 2 엔드포인트** (`/create-step2`):
```python
# Line 845-852
hospital_info = await wello_data_service.get_hospital_by_id(request.hospital_id)
hospital_national_checkup = hospital_info.get("national_checkup_items")
hospital_recommended = hospital_info.get("recommended_items")
hospital_external_checkup = hospital_info.get("external_checkup_items", [])

# Line 912-914
hospital_national_checkup=hospital_national_checkup,
hospital_recommended=hospital_recommended,
hospital_external_checkup=hospital_external_checkup,
```

### 2.2 프롬프트 생성 함수 (`checkup_design_prompt.py`)

**`format_hospital_checkup_items_for_prompt()` 함수**:
- ✅ 카테고리별 분류 (`classify_hospital_checkup_items_by_category`)
- ✅ 우선순위 분류 규칙 명시
- ✅ JSON 형식으로 포맷팅
- ✅ 각 카테고리별 사용 지침 포함

**사용 위치**:
1. `create_checkup_design_prompt_legacy()` - Line 988
2. `create_checkup_design_prompt_step2()` - Line 1981

---

## 3. 데이터베이스 조회 확인

### 3.1 `wello_data_service.get_hospital_by_id()`

**구현 위치**: `wello_data_service.py` (Line 163-283)

**조회 내용**:
1. `national_checkup_items` (JSONB) - Line 183-195
2. `recommended_items` (JSONB) - Line 196-201
3. `external_checkup_items` (매핑 테이블 조회) - Line 202-275
   - `wello_hospital_external_checkup_mapping` JOIN
   - `wello_external_checkup_items`

**반환 형식**:
```python
{
  "hospital_id": "...",
  "hospital_name": "...",
  "national_checkup_items": [...],  # List[Dict]
  "recommended_items": [...],       # List[Dict]
  "external_checkup_items": [...]   # List[Dict]
}
```

---

## 4. 프롬프트에 포함되는 내용

### 4.1 병원 기본 검진 항목

```
## 병원 기본 검진 항목 (카테고리별 분류)

### [일반/기본검진] 카테고리 (priority_1에 포함 가능)
**중요**: 이 카테고리의 항목만 priority_1에 포함할 수 있습니다.

[항목 JSON]

**카테고리별 우선순위 분류 규칙:**
- **'일반' 또는 '기본검진' 카테고리**: priority_1에만 포함 가능 (의무검진 항목)
- **'종합' 카테고리**: priority_2에 포함 (종합검진 항목)
- **'옵션' 카테고리**: priority_3에 포함 (선택 검진 항목)
```

### 4.2 병원 추천 항목

```
## 병원 추천(업셀링) 항목

**중요**: 이 항목들은 priority_2에 포함해야 합니다.

[항목 JSON]
```

### 4.3 외부 검사 항목

```
## 외부 검사 항목 (정밀 검진)

**중요**: 이 항목들은 priority_2 또는 priority_3에 포함할 수 있습니다.
- **difficulty_level이 'Mid' 또는 'High'인 항목**: priority_2에 포함
- **difficulty_level이 'Low'인 항목**: priority_3에 포함

[항목 JSON (최대 30개)]
```

---

## 5. 테스트 결과

### 5.1 함수 동작 확인

```python
✅ format_hospital_checkup_items_for_prompt 함수 동작 확인
결과 길이: 725 문자
```

**테스트 데이터**:
- `national_checkup_items`: 1개 (일반건강검진)
- `recommended_items`: 1개 (심전도 검사)
- `external_checkup_items`: 1개 (헤포덱트)

**결과**: 정상 동작 확인

### 5.2 실제 데이터베이스 조회 확인

**KIM_HW_CLINIC 병원**:
- 일반검진 항목: 2개
- 병원 추천 항목: 4개
- 외부 검사 항목: 15개

**프롬프트 전달**: ✅ 정상

---

## 6. 결론

### ✅ 프롬프트에 잘 반영됩니다!

1. **데이터베이스 조회**: `wello_data_service.get_hospital_by_id()`를 통해 조회
2. **프롬프트 전달**: 모든 엔드포인트에서 정상 전달
3. **포맷팅**: `format_hospital_checkup_items_for_prompt()` 함수로 정상 포맷팅
4. **카테고리 분류**: 자동으로 카테고리별 분류 및 우선순위 규칙 명시

### 데이터 흐름 요약

```
데이터베이스
  ↓ (wello_data_service.get_hospital_by_id)
API 엔드포인트
  ↓ (hospital_national_checkup, hospital_recommended, hospital_external_checkup)
프롬프트 생성 함수
  ↓ (format_hospital_checkup_items_for_prompt)
GPT 프롬프트
  ↓
검진 설계 결과
```

---

## 7. 확인 사항

### ✅ 모든 엔드포인트에서 정상 동작

- [x] `/create` (Legacy) - 정상
- [x] `/create-step1` (STEP 1) - 정상
- [x] `/create-step2` (STEP 2) - 정상

### ✅ 데이터베이스 조회 정상

- [x] `national_checkup_items` 조회
- [x] `recommended_items` 조회
- [x] `external_checkup_items` 조회 (매핑 테이블)

### ✅ 프롬프트 포맷팅 정상

- [x] 카테고리별 분류
- [x] 우선순위 규칙 명시
- [x] JSON 형식 포맷팅

---

## 결론

**프롬프트 검진 설계에 잘 반영됩니다!**

- 데이터베이스에서 조회한 데이터가 프롬프트에 정상 전달됨
- 카테고리별 분류 및 우선순위 규칙이 명확히 포함됨
- 모든 엔드포인트에서 정상 동작 확인

