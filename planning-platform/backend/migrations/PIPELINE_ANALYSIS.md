# 백엔드-프론트엔드 파이프라인 분석 보고서

## 전체 파이프라인 구조

```
프론트엔드 (React)
    ↓
API 호출 (/welno-api/v1/welno/*)
    ↓
백엔드 라우터 (welno_data.router)
    ↓
서비스 레이어 (welno_data_service)
    ↓
데이터베이스 (welno 스키마)
```

## 1. 프론트엔드 → 백엔드 API 호출

### 프론트엔드 API 엔드포인트 (config/api.ts)
- **경로**: 모두 `/welno-api/v1/welno/` 사용 ✅
- **주요 엔드포인트**:
  - `PATIENT`: `/welno-api/v1/welno/patients/{uuid}`
  - `HOSPITAL`: `/welno-api/v1/welno/hospitals/{hospitalId}`
  - `HEALTH_DATA`: `/welno-api/v1/welno/patient-health-data`
  - `CHECK_EXISTING_DATA`: `/welno-api/v1/welno/check-existing-data`
  - `FIND_PATIENT`: `/welno-api/v1/welno/find-patient`
  - `DELETE_HEALTH_DATA`: `/welno-api/v1/welno/patient-health-data`
  - `SAVE_TERMS_AGREEMENT`: `/welno-api/v1/welno/terms-agreement`
  - `DRUG_DETAIL`: `/welno-api/v1/welno/drug-detail/{drugCode}`

### 프론트엔드에서 API 호출하는 컴포넌트
- `WelnoDataContext.tsx`: 환자 데이터 로드
- `UserContext.tsx`: 사용자 정보 로드
- `healthDataLoader.ts`: 건강 데이터 로드
- `checkupDesignService.ts`: 검진 설계 관련
- `AIAnalysisSection`: AI 분석 요청

**결론**: 프론트엔드는 모두 `welno` 경로 사용 ✅

## 2. 백엔드 라우터 등록 상태

### main.py 라우터 등록
```python
# welno_data.router 등록됨 ✅
app.include_router(welno_data.router, prefix="/api/v1/welno", tags=["welno"])
app.include_router(welno_data.router, prefix="/welno-api/v1/welno", tags=["welno-welno"])

# wello_data.router 등록 안됨 ⚠️ (파일만 존재)
```

### 엔드포인트 파일 상태
- `welno_data.py`: ✅ 사용 중 (welno_data_service 사용)
- `wello_data.py`: ⚠️ 파일 존재하지만 등록 안됨 (wello_data_service 사용)

**결론**: 
- 실제 사용: `welno_data.py` → `welno_data_service` → `welno` 스키마 ✅
- 미사용: `wello_data.py` → `wello_data_service` (등록 안됨) ⚠️

## 3. 서비스 레이어

### welno_data_service
- **파일**: `app/services/welno_data_service.py`
- **스키마**: `welno.welno_*` 사용 ✅
- **사용 위치**:
  - `welno_data.py` 엔드포인트
  - `checkup_design.py` 엔드포인트
  - `tilko_auth.py` 엔드포인트

### wello_data_service
- **파일**: `app/services/wello_data_service.py`
- **스키마**: `welno.welno_*` 사용 (수정 완료) ✅
- **사용 위치**:
  - `wello_data.py` 엔드포인트 (등록 안됨, 사용 안함)

**결론**: 두 서비스 모두 `welno` 스키마 사용 ✅

## 4. 데이터베이스 스키마

### welno 스키마 (사용 중)
- `welno_patients`: 16명
- `welno_checkup_data`: 18건
- `welno_prescription_data`: 653건
- `welno_checkup_design_requests`: 2건
- `welno_hospitals`: 2개
- `welno_external_checkup_items`: 51개
- `welno_hospital_external_checkup_mapping`: 15개
- `welno_password_sessions`: 0건

### wello 스키마 (미사용)
- 설문 템플릿 관련 테이블 12개
- 현재 코드에서 참조 안함

## 5. 발견된 문제점

### ⚠️ 문제 1: wello_data.py 파일 존재
- **위치**: `app/api/v1/endpoints/wello_data.py`
- **상태**: 파일은 존재하지만 main.py에 등록 안됨
- **영향**: 없음 (사용 안함)
- **조치**: 삭제 또는 주석 처리 권장

### ⚠️ 문제 2: wello_data_service 중복
- **위치**: `app/services/wello_data_service.py`
- **상태**: welno 스키마로 수정 완료, 하지만 사용 안함
- **영향**: 없음 (welno_data_service 사용 중)
- **조치**: welno_data_service와 통합 또는 삭제 검토

## 6. 실제 데이터 흐름

### 예시: 환자 정보 조회
```
1. 프론트엔드: API_ENDPOINTS.PATIENT(uuid)
   → GET /welno-api/v1/welno/patients/{uuid}

2. 백엔드: welno_data.router
   → @router.get("/patients/{uuid}")

3. 서비스: welno_data_service.get_patient_by_uuid()
   → SELECT * FROM welno.welno_patients WHERE uuid = $1

4. 데이터베이스: welno.welno_patients 테이블 조회
   → 결과 반환
```

## 7. 최종 확인 사항

### ✅ 정상 동작
- 프론트엔드 → 백엔드 API: welno 경로 사용
- 백엔드 라우터: welno_data.router 등록됨
- 서비스 레이어: welno 스키마 사용
- 데이터베이스: welno 스키마 정상

### ⚠️ 정리 필요
- `wello_data.py` 파일 삭제 또는 주석 처리
- `wello_data_service.py` 통합 검토 (선택사항)

## 8. 권장 조치사항

1. **즉시 조치**: 없음 (모두 정상 동작)
2. **정리 작업**: wello_data.py 파일 삭제 또는 주석 처리
3. **문서화**: 이 파이프라인 문서 유지
