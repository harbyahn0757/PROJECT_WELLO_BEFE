# 검진 설계 API 검증 체크리스트

**작성일**: 2025-01-02  
**목적**: 프리미엄 항목(외부 검사) 조회 및 프롬프트 통합 검증

---

## 1. 데이터베이스 쿼리 검증

### ✅ 완료 항목
- [x] `wello_external_checkup_items` 테이블 구조 확인
- [x] `wello_hospital_external_checkup_mapping` 테이블 구조 확인
- [x] 병원별 매핑 데이터 확인 (KIM_HW_CLINIC: 15개 항목)
- [x] 쿼리 실행 테스트 성공
- [x] 모든 필드 정상 조회 확인 (manufacturer, target, input_sample, algorithm_class 포함)

### 확인 사항
- [ ] 프리미엄 항목이 없는 병원 케이스 테스트
- [ ] NULL 필드 처리 확인 (manufacturer, target 등이 NULL일 수 있음)

---

## 2. 코드 검증

### ✅ 완료 항목
- [x] `wello_data_service.py` 쿼리에 새 필드 추가
- [x] 반환 딕셔너리에 새 필드 포함
- [x] 프롬프트에 algorithm_class 정보 추가
- [x] 프롬프트에 target, input_sample, manufacturer 정보 추가
- [x] 로깅에 새 필드 정보 포함
- [x] 옵셔널 처리 확인 (빈 배열 기본값)

### 확인 사항
- [ ] NULL 필드 처리 (item.get() 사용 확인)
- [ ] 프롬프트 JSON 직렬화 시 NULL 필드 처리

---

## 3. API 엔드포인트 검증

### 확인 사항
- [ ] `hospital_id` 파라미터 정상 전달
- [ ] `get_hospital_by_id` 정상 호출
- [ ] `external_checkup_items` 정상 조회
- [ ] 프롬프트 생성 시 `hospital_external_checkup` 정상 전달
- [ ] 프리미엄 항목이 없을 때 정상 처리

---

## 4. 프롬프트 검증

### 확인 사항
- [ ] algorithm_class 정보가 프롬프트에 포함되는지
- [ ] target, input_sample, manufacturer 정보가 프롬프트에 포함되는지
- [ ] 추천 우선순위 지시사항이 프롬프트에 포함되는지
- [ ] 프리미엄 항목이 없을 때 프롬프트에 해당 섹션이 없는지

---

## 5. 테스트 시나리오

### 시나리오 1: 프리미엄 항목이 있는 병원 (KIM_HW_CLINIC)
```bash
# 테스트 명령어
cd planning-platform/backend
python3 scripts/test_checkup_design_api.py
```

**확인 사항**:
- [ ] API 응답 성공 (200)
- [ ] 로그에 프리미엄 항목 정보 출력
- [ ] 프롬프트에 algorithm_class 정보 포함
- [ ] AI 응답에 프리미엄 항목 추천 포함

### 시나리오 2: 프리미엄 항목이 없는 병원 (가상)
**확인 사항**:
- [ ] API 응답 성공 (200)
- [ ] 로그에 "프리미엄 항목 0개" 출력
- [ ] 프롬프트에 외부 검사 항목 섹션 없음
- [ ] AI 응답 정상 생성

### 시나리오 3: NULL 필드 처리
**확인 사항**:
- [ ] manufacturer가 NULL인 항목 처리
- [ ] target이 NULL인 항목 처리
- [ ] input_sample이 NULL인 항목 처리
- [ ] algorithm_class가 NULL인 항목 처리

---

## 6. 로그 확인 포인트

### 성공 케이스 로그 예시
```
🏥 [검진설계] 병원 정보 조회 시작 - hospital_id: KIM_HW_CLINIC
🔍 [병원별 프리미엄 항목] 조회 시작 - hospital_id: KIM_HW_CLINIC
✅ [병원별 프리미엄 항목] 조회 성공 - 15개 항목 발견
📊 [병원별 프리미엄 항목] 난이도별 통계: {'Mid': 5, 'High': 9, 'Low': 1}
  [1] 헤포덱트(HEPOtect) (Mid) [1. 현재 암 유무 확인(Screening)] - 간암 - 암 정밀
✅ [검진설계] 병원 정보 조회 완료 - 김현우내과의원
📊 [검진설계] 검진 항목 통계:
  - 기본 검진 항목: 10개
  - 병원 추천 항목: 5개
  - 프리미엄 항목 (외부 검사): 15개
```

### 실패 케이스 로그 예시
```
⚠️ [병원별 프리미엄 항목] 매핑된 항목 없음 - hospital_id: OTHER_HOSPITAL
📊 [검진설계] 검진 항목 통계:
  - 프리미엄 항목 (외부 검사): 0개
```

---

## 7. 테스트 실행 방법

### 1. 단위 테스트 (쿼리 검증)
```bash
cd /home/workspace/PROJECT_WELLO_BEFE
python3 -c "
import asyncio
import asyncpg
# (위의 테스트 코드 실행)
"
```

### 2. 통합 테스트 (API 호출)
```bash
cd planning-platform/backend
python3 scripts/test_checkup_design_api.py
```

### 3. 수동 테스트 (브라우저/Postman)
- URL: `http://localhost:9282/wello-api/v1/checkup-design/create`
- Method: POST
- Body: (test_checkup_design_api.py 참고)

---

## 8. 예상 문제점 및 대응

### 문제 1: NULL 필드로 인한 KeyError
**대응**: `item.get('field_name')` 사용 확인 ✅

### 문제 2: 프리미엄 항목이 없을 때 프롬프트 오류
**대응**: `if hospital_external_checkup:` 체크 확인 ✅

### 문제 3: algorithm_class가 NULL인 경우
**대응**: 프롬프트에서 조건부 처리 확인 필요

---

## 9. 검증 완료 체크리스트

- [x] 데이터베이스 쿼리 정상 실행
- [x] 코드 필드 매핑 완료
- [x] 프롬프트에 새 필드 정보 추가
- [x] 로깅 추가
- [ ] 실제 API 호출 테스트
- [ ] 프롬프트 생성 결과 확인
- [ ] AI 응답에 프리미엄 항목 포함 여부 확인

---

**다음 단계**: 실제 API 호출 테스트 실행


