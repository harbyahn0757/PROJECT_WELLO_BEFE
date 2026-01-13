# 메인 페이지 데이터 로드 흐름 분석

## URL: `/wello?uuid=e3471a9a-2d67-4a23-8599-849963397d1c&hospital=KIM_HW_CLINIC`

### 1. 라우팅 (App.tsx)
- `basename="/wello"` 설정
- 메인 페이지는 `path="/"` (실제 URL: `/wello/`)

### 2. URL 파라미터 감지 (App.tsx:438-496)
```typescript
useEffect(() => {
  const urlParams = new URLSearchParams(location.search);
  const uuid = urlParams.get('uuid');
  const hospital = urlParams.get('hospital');
  
  if (uuid && hospital) {
    actions.loadPatientData(uuid, hospital);
  }
}, [location.search]);
```

### 3. 환자 데이터 로드 (WelloDataContext.tsx:273-658)
- **API 호출:**
  - `API_ENDPOINTS.PATIENT(uuid)` → `/wello-api/v1/wello/patients/{uuid}`
  - `API_ENDPOINTS.HOSPITAL(hospital)` → `/wello-api/v1/wello/hospitals/{hospital}`

### 4. 백엔드 API 엔드포인트 (patients.py:51-100)
- **경로:** `/wello-api/v1/wello/patients/{patient_uuid}`
- **함수:** `get_patient(patient_uuid: UUID)`
- **서비스:** `PatientService.get_patient_by_uuid(patient_uuid)`

### 5. Repository 조회 (implementations.py:125-236)
- **1순위:** `wello.wello_patients` 테이블 조회
  ```sql
  SELECT uuid, hospital_id, name, phone_number, birth_date, gender, created_at
  FROM wello.wello_patients 
  WHERE uuid = $1
  ```
  
- **보완 로직:** `phone_number` 또는 `birth_date`가 null이면 `mdx_agr_list`에서 보완
  - UUID로 조회 시도
  - 없으면 전화번호+이름+병원으로 조회 시도

- **2순위:** `p9_mkt_biz.mdx_agr_list` 테이블 조회 (wello_patients에 없을 때)

### 6. 데이터 변환 (WelloDataContext.tsx:400-435)
- `phone_number` → `phone`
- `birth_date` → `birthday`
- `gender`: 'M'/'F' → 'male'/'female'

### 7. 현재 상태 확인
- ✅ API 응답: 전화번호 `01056180757`, 생년월일 `1981-09-27` 정상 반환
- ✅ 백엔드 보완 로직: `PatientRepository.get_by_uuid`에 mdx_agr_list 보완 로직 추가됨
- ✅ 프론트엔드 변환: `WelloDataContext`에서 데이터 변환 로직 있음

## 테이블 스키마

### wello.wello_patients
- `phone_number` (varchar, nullable)
- `birth_date` (date, nullable)
- `name` (varchar, NOT NULL)
- `hospital_id` (varchar, NOT NULL)

### p9_mkt_biz.mdx_agr_list
- `phoneno` (text, nullable)
- `birthday` (date, nullable)
- `name` (text, nullable)
- `hosnm` (text, nullable)

## 문제점 및 해결

### 문제 1: conn.close() 위치
- **문제:** 146번 줄에서 `conn.close()`를 호출한 후 167번 줄에서 다시 쿼리 실행 시도
- **해결:** `conn.close()`를 보완 로직 완료 후(204번 줄)로 이동

### 문제 2: 이름 매칭
- **현재:** `wello_patients`의 `name`이 "[이름 삭제됨]"인데 `mdx_agr_list`에는 "[이름 삭제됨]-김현우"도 있음
- **해결:** 이름 매칭을 더 유연하게 처리 (부분 매칭 또는 LIKE 사용)


