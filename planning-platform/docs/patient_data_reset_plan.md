# 환자 데이터 초기화 계획서

## 📋 개요

김영상, 안광수님의 검진/처방전 데이터를 삭제하여 Tilko부터 단계별로 테스트할 수 있도록 초기화하는 계획입니다.

**목적**: 환자 정보는 유지하고, 검진/처방전 데이터만 삭제하여 Tilko 인증부터 데이터 수집까지 전체 플로우를 테스트

---

## 📊 현재 데이터 현황

### 김영상님
- **UUID**: `3a96200c-c61a-47b1-8539-27b73ef2f483`
- **병원 ID**: `KHW001`
- **건강검진 데이터**: 4건 (2016년 ~ 2025년)
- **처방전 데이터**: 115건 (2020-11-28 ~ 2025-09-11)
- **환자 정보**: 유지 (삭제 안 함)

### 안광수님
- **UUID**: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- **병원 ID**: `KHW001`
- **건강검진 데이터**: 1건 (2021년)
- **처방전 데이터**: 9건 (2022-01-21 ~ 2023-06-20)
- **환자 정보**: 유지 (삭제 안 함)

---

## ⚠️ 삭제 시 영향도 분석

### 삭제되는 데이터
- **김영상님**: 건강검진 4건 + 처방전 115건 = **총 119건**
- **안광수님**: 건강검진 1건 + 처방전 9건 = **총 10건**
- **합계**: **129건 삭제**

### 유지되는 데이터
- ✅ 환자 기본 정보 (`wello_patients` 테이블)
  - UUID, 이름, 병원 ID, 전화번호, 생년월일, 성별 등
  - 인증 관련 정보 (tilko_session_id, last_auth_at 등)
  - 비밀번호 정보 (있는 경우)

### 변경되는 정보
- `has_health_data`: `TRUE` → `FALSE`
- `has_prescription_data`: `TRUE` → `FALSE`
- `last_data_update`: 날짜 → `NULL`

---

## 📝 삭제 SQL 스크립트

```sql
-- ============================================================
-- 김영상, 안광수님의 검진/처방전 데이터만 삭제
-- 환자 정보는 유지하여 Tilko부터 단계별 테스트 가능
-- ============================================================
-- 주의: 실제 실행 전 데이터베이스 백업 필수!

BEGIN;

-- 1. 김영상님 데이터 삭제
DELETE FROM wello.wello_checkup_data 
WHERE patient_uuid = '3a96200c-c61a-47b1-8539-27b73ef2f483' 
  AND hospital_id = 'KHW001';

DELETE FROM wello.wello_prescription_data 
WHERE patient_uuid = '3a96200c-c61a-47b1-8539-27b73ef2f483' 
  AND hospital_id = 'KHW001';

-- 2. 안광수님 데이터 삭제
DELETE FROM wello.wello_checkup_data 
WHERE patient_uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' 
  AND hospital_id = 'KHW001';

DELETE FROM wello.wello_prescription_data 
WHERE patient_uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' 
  AND hospital_id = 'KHW001';

-- 3. 환자 정보 플래그 업데이트
UPDATE wello.wello_patients 
SET 
    has_health_data = FALSE, 
    has_prescription_data = FALSE, 
    last_data_update = NULL 
WHERE uuid = '3a96200c-c61a-47b1-8539-27b73ef2f483' 
  AND hospital_id = 'KHW001';

UPDATE wello.wello_patients 
SET 
    has_health_data = FALSE, 
    has_prescription_data = FALSE, 
    last_data_update = NULL 
WHERE uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' 
  AND hospital_id = 'KHW001';

COMMIT;
```

---

## 🔄 삭제 후 테스트 플로우

### 1단계: Tilko 인증 테스트
- 환자 정보는 유지되어 있으므로 바로 Tilko 인증 가능
- 인증 후 세션 정보 저장 확인

### 2단계: 건강검진 데이터 수집 테스트
- Tilko API 호출하여 건강검진 데이터 수집
- `wello_checkup_data` 테이블에 데이터 저장 확인

### 3단계: 처방전 데이터 수집 테스트
- Tilko API 호출하여 처방전 데이터 수집
- `wello_prescription_data` 테이블에 데이터 저장 확인

### 4단계: 프론트엔드 표시 테스트
- 수집된 데이터가 프론트엔드에 정상 표시되는지 확인

---

## ✅ 확인 사항

- [x] 현재 데이터 현황 확인 완료
- [x] 삭제 시 영향도 분석 완료
- [x] 삭제 SQL 스크립트 생성 완료
- [ ] 데이터베이스 백업 완료 (실행 전 필수)
- [ ] 삭제 SQL 실행
- [ ] 삭제 후 데이터 확인
- [ ] Tilko 인증 테스트
- [ ] 데이터 수집 테스트

---

## ⚠️ 주의사항

1. **데이터베이스 백업 필수**: 삭제 전 반드시 백업 수행
2. **트랜잭션 사용**: BEGIN/COMMIT으로 원자성 보장
3. **환자 정보 유지**: `wello_patients` 테이블은 삭제하지 않음
4. **플래그 업데이트**: 삭제 후 플래그도 함께 업데이트 필요
5. **테스트 완료 후**: 필요시 데이터 재수집 또는 복구

---

## 📅 업데이트 이력

- **2025-01-XX**: 데이터 초기화 계획 수립
- **2025-01-XX**: 현재 데이터 현황 확인 완료
- **2025-01-XX**: 삭제 SQL 스크립트 생성 완료

