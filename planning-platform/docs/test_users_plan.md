# 테스트 인원 생성 계획서

## 📋 개요

기존 환자(성정옥님)의 전화번호를 기준으로 테스트 인원 5명을 생성하는 계획입니다.

**생성일**: 2025-01-XX  
**기준 환자**: 성정옥 (전화번호: 010-1234-5678)  
**병원 ID**: KHW001

---

## 📊 테스트 인원 생성 계획표

| 번호 | 이름 | 전화번호 | 생년월일 | 성별 | 병원ID | UUID | 전화번호 사용가능 |
|------|------|----------|----------|------|--------|------|------------------|
| 1 | 테스트1 | 010-1234-5679 | 1962-04-20 | F | KHW001 | `5ab43885-1ef1-4b82-bf9f-ffce252e6296` | ✅ 가능 |
| 2 | 테스트2 | 010-1234-5680 | 1962-04-20 | F | KHW001 | `e1ffbc0a-e5bb-4e56-b756-819f1c394ef2` | ✅ 가능 |
| 3 | 테스트3 | 010-1234-5681 | 1962-04-20 | F | KHW001 | `5b96dd2d-4f2a-4119-a6b1-af66aadcedd5` | ✅ 가능 |
| 4 | 테스트4 | 010-1234-5682 | 1962-04-20 | F | KHW001 | `4fe93cb3-c7ad-4f1e-8df2-79d420ce0932` | ✅ 가능 |
| 5 | 테스트5 | 010-1234-5683 | 1962-04-20 | F | KHW001 | `1bb0d72e-dc01-46dd-aafb-a51ef59cbb13` | ✅ 가능 |

---

## 🌐 접속 정보 (개발 서버)

| 번호 | 이름 | 접속 URL |
|------|------|----------|
| 1 | 테스트1 | `http://127.0.0.1:9283/wello?uuid=5ab43885-1ef1-4b82-bf9f-ffce252e6296&hospital=KHW001` |
| 2 | 테스트2 | `http://127.0.0.1:9283/wello?uuid=e1ffbc0a-e5bb-4e56-b756-819f1c394ef2&hospital=KHW001` |
| 3 | 테스트3 | `http://127.0.0.1:9283/wello?uuid=5b96dd2d-4f2a-4119-a6b1-af66aadcedd5&hospital=KHW001` |
| 4 | 테스트4 | `http://127.0.0.1:9283/wello?uuid=4fe93cb3-c7ad-4f1e-8df2-79d420ce0932&hospital=KHW001` |
| 5 | 테스트5 | `http://127.0.0.1:9283/wello?uuid=1bb0d72e-dc01-46dd-aafb-a51ef59cbb13&hospital=KHW001` |

---

## 🌐 접속 정보 (실서버)

| 번호 | 이름 | 접속 URL |
|------|------|----------|
| 1 | 테스트1 | `https://xogxog.com/wello?uuid=5ab43885-1ef1-4b82-bf9f-ffce252e6296&hospital=KHW001` |
| 2 | 테스트2 | `https://xogxog.com/wello?uuid=e1ffbc0a-e5bb-4e56-b756-819f1c394ef2&hospital=KHW001` |
| 3 | 테스트3 | `https://xogxog.com/wello?uuid=5b96dd2d-4f2a-4119-a6b1-af66aadcedd5&hospital=KHW001` |
| 4 | 테스트4 | `https://xogxog.com/wello?uuid=4fe93cb3-c7ad-4f1e-8df2-79d420ce0932&hospital=KHW001` |
| 5 | 테스트5 | `https://xogxog.com/wello?uuid=1bb0d72e-dc01-46dd-aafb-a51ef59cbb13&hospital=KHW001` |

---

## 📝 SQL 생성 스크립트

```sql
-- 테스트 인원 생성 SQL
-- 실행 전 데이터베이스 백업 권장

-- 테스트1 생성
INSERT INTO wello.wello_patients (uuid, hospital_id, name, phone_number, birth_date, gender)
VALUES (
    '5ab43885-1ef1-4b82-bf9f-ffce252e6296',
    'KHW001',
    '테스트1',
    '01012345679',
    '1962-04-20',
    'F'
);

-- 테스트2 생성
INSERT INTO wello.wello_patients (uuid, hospital_id, name, phone_number, birth_date, gender)
VALUES (
    'e1ffbc0a-e5bb-4e56-b756-819f1c394ef2',
    'KHW001',
    '테스트2',
    '01012345680',
    '1962-04-20',
    'F'
);

-- 테스트3 생성
INSERT INTO wello.wello_patients (uuid, hospital_id, name, phone_number, birth_date, gender)
VALUES (
    '5b96dd2d-4f2a-4119-a6b1-af66aadcedd5',
    'KHW001',
    '테스트3',
    '01012345681',
    '1962-04-20',
    'F'
);

-- 테스트4 생성
INSERT INTO wello.wello_patients (uuid, hospital_id, name, phone_number, birth_date, gender)
VALUES (
    '4fe93cb3-c7ad-4f1e-8df2-79d420ce0932',
    'KHW001',
    '테스트4',
    '01012345682',
    '1962-04-20',
    'F'
);

-- 테스트5 생성
INSERT INTO wello.wello_patients (uuid, hospital_id, name, phone_number, birth_date, gender)
VALUES (
    '1bb0d72e-dc01-46dd-aafb-a51ef59cbb13',
    'KHW001',
    '테스트5',
    '01012345683',
    '1962-04-20',
    'F'
);
```

---

## 📋 생성 방법

1. **전화번호 생성**: 기준 전화번호(010-1234-5678)의 마지막 4자리를 순차적으로 증가
   - 테스트1: 010-1234-5679
   - 테스트2: 010-1234-5680
   - 테스트3: 010-1234-5681
   - 테스트4: 010-1234-5682
   - 테스트5: 010-1234-5683

2. **UUID**: 각 테스트 인원마다 고유한 UUID v4 생성 (위 표 참조)

3. **병원 ID**: 기존과 동일하게 `KHW001` 사용

4. **생년월일/성별**: 기준 환자(성정옥님)와 동일하게 사용
   - 생년월일: 1962-04-20
   - 성별: F (여성)

5. **전화번호 저장**: 데이터베이스에는 하이픈 없이 숫자만 저장 (예: `01012345679`)

---

## ✅ 확인 사항

- [x] 기존 환자 전화번호 기준으로 생성 가능 여부 확인 완료
- [x] 모든 테스트 전화번호 중복 확인 완료 (모두 사용 가능)
- [x] UUID 생성 완료
- [x] 접속 URL 생성 완료 (개발/실서버)
- [x] SQL 스크립트 생성 완료

---

## ⚠️ 주의사항

1. **UUID**: 실제 생성 후 URL에 입력해야 함 (위 표의 UUID 사용)
2. **전화번호 중복**: 모든 전화번호 사용 가능 확인 완료
3. **데이터베이스 백업**: 실제 생성 전 데이터베이스 백업 권장
4. **테스트 완료 후**: 테스트 완료 후 삭제 계획 수립 필요
5. **전화번호 저장 형식**: 데이터베이스에는 하이픈 없이 숫자만 저장됨

---

## 🔄 삭제 스크립트 (테스트 완료 후)

```sql
-- 테스트 인원 삭제 SQL
-- 주의: 실제 삭제 전 데이터 확인 필수

DELETE FROM wello.wello_patients 
WHERE name IN ('테스트1', '테스트2', '테스트3', '테스트4', '테스트5')
  AND hospital_id = 'KHW001';
```

---

## 📅 업데이트 이력

- **2025-01-XX**: 테스트 인원 생성 계획 수립
- **2025-01-XX**: 전화번호 중복 확인 완료
- **2025-01-XX**: 접속 URL 생성 완료


