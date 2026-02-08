# 데이터 저장 시점 및 스키마 분석

**생성일**: 미상  
**작업일자**: 미상  
**작업내용**: 데이터 저장 시점 및 스키마 분석

---

## 📊 저장 시점 요약

### 1. IndexedDB 저장 시점 (로컬)

#### 시점 1: Tilko WebSocket 인증 완료 시
- **파일**: `frontend/src/components/AuthForm.tsx` (line 117-142)
- **트리거**: `onAuthCompleted` 콜백
- **조건**: `data.health_data || data.prescription_data` 존재
- **저장 모드**: `'merge'`
- **데이터 구조**:
  ```typescript
  {
    uuid: data.patient_uuid,
    patientName: authFlow.state.userInfo.name || '사용자',
    hospitalId: data.hospital_id,
    healthData: data.health_data?.ResultList || [],  // ⚠️ 빈 배열 가능
    prescriptionData: data.prescription_data?.ResultList || [],  // ⚠️ 빈 배열 가능
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dataSource: 'tilko'
  }
  ```
- **문제점**: `data.health_data?.ResultList || []`가 빈 배열일 수 있음

#### 시점 2: 폴링으로 데이터 수집 완료 감지 시
- **파일**: `frontend/src/components/AuthForm.tsx` (line 213-238)
- **트리거**: 폴링 `onStatusUpdate`에서 `status === 'completed'`
- **저장 모드**: `'merge'`
- **데이터 구조**: 동일 (시점 1과 동일)

#### 시점 3: HealthDataViewer에서 API 응답 후
- **파일**: `frontend/src/components/health/HealthDataViewer/index.tsx` (line 367)
- **트리거**: API에서 건강 데이터 조회 성공 후
- **저장 모드**: `'overwrite'` (기본값)
- **조건**: `hasHealthData || hasPrescriptionData`가 true일 때만 저장
- **데이터 구조**:
  ```typescript
  {
    uuid: uuid!,
    patientName: state.patient?.name || '사용자',
    hospitalId: hospital!,
    healthData: healthDataFormatted?.ResultList || [],  // 변환된 Tilko 형식
    prescriptionData: prescriptionDataFormatted?.ResultList || [],
    dataSource: 'api'
  }
  ```

#### 시점 4: WelnoDataContext에서 환자 데이터 로드 시
- **파일**: `frontend/src/contexts/WelnoDataContext.tsx` (line 602)
- **트리거**: `loadPatientData` 함수에서 API 호출 성공 후
- **조건**: `healthData.length > 0 || prescriptionData.length > 0`
- **저장 모드**: `'overwrite'` (기본값)

### 2. 서버 DB 저장 시점

#### 시점 1: 비밀번호 설정 완료 후 (프론트엔드 → 서버 업로드)
- **파일**: `frontend/src/components/AuthForm.tsx` (line 54-75)
- **트리거**: `handlePasswordSetupSuccess` 함수
- **엔드포인트**: `POST /welno-api/v1/welno/upload-health-data`
- **조건**: `lastCollectedRecord && passwordSetupData?.uuid && passwordSetupData?.hospital`
- **데이터**: `lastCollectedRecord` (IndexedDB에 저장된 데이터)
- **백엔드 처리**: `backend/app/api/v1/endpoints/welno_data.py` (line 175-206)
  - `welno_data_service.save_patient_data()` - 환자 정보 저장
  - `welno_data_service.save_health_data()` - 건강검진 데이터 저장
  - `welno_data_service.save_prescription_data()` - 처방전 데이터 저장

#### 시점 2: Tilko 백그라운드 작업에서 파일 저장 후 DB 저장
- **파일**: `backend/app/api/v1/endpoints/tilko_auth.py` (line 1654-1680)
- **트리거**: `collect_health_data_background_task` 함수
- **플로우**: 
  1. 파일 저장 (`file_first_service.save_data_to_file_first`)
  2. 파일에서 DB로 저장 (`file_first_service.process_pending_files_to_db`)
- **서비스**: `backend/app/services/file_first_data_service.py`
  - `wello_service.save_health_data()` 호출
  - `wello_service.save_prescription_data()` 호출

## 📋 저장 스키마 비교

### IndexedDB 스키마 (로컬)

**인터페이스**: `frontend/src/services/WelnoIndexedDB.ts` (line 6-15)
```typescript
interface HealthDataRecord {
  uuid: string;           // Primary Key
  patientName: string;
  hospitalId: string;
  healthData: any[];      // 건강검진 데이터 배열 (Tilko 형식)
  prescriptionData: any[]; // 처방전 데이터 배열 (Tilko 형식)
  createdAt: string;
  updatedAt: string;
  dataSource: 'api' | 'tilko';
}
```

**저장 데이터 형식**:
- `healthData`: Tilko 원본 형식 배열 (각 항목은 `{ Year, CheckUpDate, Location, Code, Inspections, ... }`)
- `prescriptionData`: Tilko 원본 형식 배열 (각 항목은 `{ Idx, Page, ByungEuiwonYakGukMyung, ... }`)

### 서버 DB 스키마

**테이블**: `welno.welno_checkup_data`
```sql
CREATE TABLE welno.welno_checkup_data (
    id SERIAL PRIMARY KEY,
    patient_uuid VARCHAR(36) NOT NULL,  -- ⚠️ 실제 DB에는 patient_uuid 있음
    hospital_id VARCHAR(20) NOT NULL,
    raw_data JSONB NOT NULL,  -- Tilko 원본 전체
    year VARCHAR(10),
    checkup_date VARCHAR(20),
    location VARCHAR(100),
    code VARCHAR(20),
    description TEXT,
    height DECIMAL(5,2),
    weight DECIMAL(5,2),
    bmi DECIMAL(4,1),
    -- ... 기타 수치 필드
    collected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

**저장 데이터 형식**:
- `raw_data`: Tilko 원본 JSON 전체 (`json.dumps(item, ensure_ascii=False)`)
- 각 항목은 별도 row로 저장

**테이블**: `welno.welno_prescription_data`
```sql
CREATE TABLE welno.welno_prescription_data (
    id SERIAL PRIMARY KEY,
    patient_uuid VARCHAR(36) NOT NULL,  -- ⚠️ 실제 DB에는 patient_uuid 있음
    hospital_id VARCHAR(20) NOT NULL,
    raw_data JSONB NOT NULL,  -- Tilko 원본 전체
    idx VARCHAR(10),
    page VARCHAR(10),
    hospital_name VARCHAR(100),
    address VARCHAR(200),
    treatment_date DATE,
    treatment_type VARCHAR(50),
    -- ... 기타 필드
    collected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

## 🔍 문제점 분석

### 문제 1: IndexedDB에 빈 배열 저장
- **원인**: `data.health_data?.ResultList || []`가 빈 배열일 때도 저장됨
- **위치**: `AuthForm.tsx` line 126-127
- **영향**: `'merge'` 모드에서 기존 빈 배열과 새 빈 배열이 머지되어 빈 배열 유지

### 문제 2: 서버 업로드 실패 가능성
- **원인**: `lastCollectedRecord`가 빈 배열이면 서버에도 빈 배열 저장
- **위치**: `AuthForm.tsx` line 59-75
- **영향**: 서버 DB에도 데이터가 없음

### 문제 3: 데이터 구조 불일치
- **IndexedDB**: `healthData: any[]` (Tilko 원본 형식 배열)
- **서버 업로드 시**: `{"ResultList": health_record["healthData"]}` (한 번 더 감싸짐)
- **서버 저장 시**: `health_data.get('ResultList', [])` (다시 풀어서 저장)
- **결과**: 구조는 일치하지만 불필요한 래핑/언래핑

## 🔧 해결 방안

1. **IndexedDB 저장 시 빈 배열 체크 추가**
   - `healthData.length > 0 || prescriptionData.length > 0`일 때만 저장

2. **서버 업로드 시 빈 배열 체크 추가**
   - `lastCollectedRecord.healthData.length > 0 || lastCollectedRecord.prescriptionData.length > 0`일 때만 업로드

3. **데이터 구조 일관성 보장**
   - IndexedDB와 서버 모두 동일한 Tilko 원본 형식 사용
