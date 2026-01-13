# wello.wello_patients 테이블 점검 결과

## 현재 상태

### 데이터베이스 현황
- **총 레코드 수**: 16개
- **전화번호 있는 레코드**: 9개 (56%)
- **생년월일 있는 레코드**: 2개 (12.5%)

### 현재 조회 대상 UUID
```
UUID: e3471a9a-2d67-4a23-8599-849963397d1c
- name: 안광수 ✅
- phone_number: NULL ❌
- birth_date: NULL ❌
- gender: M ✅
- hospital_id: KIM_HW_CLINIC ✅
```

## 테이블 스키마

### wello.wello_patients
```sql
- phone_number: VARCHAR(20), nullable ✅
- birth_date: DATE, nullable ✅
- name: VARCHAR(50), NOT NULL ✅
- gender: VARCHAR(1), nullable ✅
- hospital_id: VARCHAR(20), NOT NULL ✅
```

## 저장 시점

### 1. Tilko 인증 후 데이터 수집 시
- `save_patient_data()` 함수 호출
- `user_info`에서 `phone_number`, `birth_date` 받아서 저장
- UPSERT 쿼리로 저장/업데이트

### 2. 현재 문제점
- **대부분의 레코드에 전화번호/생년월일이 없음**
- Tilko 인증 전에 레코드가 생성되는 경우가 있음
- 인증 후에도 값이 저장되지 않는 경우가 있을 수 있음

## 프론트엔드 활용

### 1. 데이터 변환 (WelloDataContext.tsx)
```typescript
phone: rawPatientData.phone_number || rawPatientData.phone || ''
birthday: rawPatientData.birth_date || rawPatientData.birthday || ''
```
- null이면 빈 문자열로 변환
- 프론트엔드에서는 빈 문자열로 처리

### 2. AuthForm에서 사용
- `patient.phone`: 전화번호 입력 필드에 사용
- `patient.birthday`: 생년월일 입력 필드에 사용
- 값이 없으면 사용자가 직접 입력해야 함

### 3. 문제점
- **전화번호/생년월일이 없으면 사용자가 매번 입력해야 함**
- 입력한 값이 저장되지 않으면 다음 접속 시 다시 입력 필요
- 현재는 wello_patients만 조회하므로 null 값이 반환됨

## 해결 방안

### 옵션 1: 사용자 입력 값 저장
- AuthForm에서 입력한 전화번호/생년월일을 wello_patients에 저장
- 다음 접속 시 저장된 값 사용

### 옵션 2: 별도 API로 mdx_agr_list 조회
- wello_patients에 없으면 별도 API로 mdx_agr_list 조회
- 조회한 값을 wello_patients에 저장

### 옵션 3: 현재 상태 유지
- 사용자가 매번 입력하도록 유도
- 입력한 값은 세션/로컬스토리지에만 저장

## 권장 사항

1. **즉시 해결**: AuthForm에서 입력한 값을 wello_patients에 저장하는 로직 추가
2. **장기 해결**: Tilko 인증 시 전화번호/생년월일이 확실히 저장되도록 보장
3. **데이터 보완**: 기존 레코드의 전화번호/생년월일을 mdx_agr_list에서 가져와서 보완


