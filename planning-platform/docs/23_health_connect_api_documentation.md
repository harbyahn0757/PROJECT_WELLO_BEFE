# Health Connect API 문서

## 개요

Health Connect API는 Tilko를 통해 국민건강보험공단의 건강검진 및 처방전 데이터를 안전하게 연동하는 서비스입니다.

## 기술 스택

### 백엔드
- **Framework**: FastAPI 0.104.1
- **암호화**: cryptography 41.0.7
- **HTTP 클라이언트**: aiohttp 3.9.1
- **데이터 검증**: pydantic 2.5.0

### 프론트엔드
- **Framework**: React 19.1.1
- **HTTP 클라이언트**: axios
- **타입스크립트**: TypeScript 5.x
- **스타일링**: SCSS

## API 엔드포인트

### 1. 사용자 인증

#### POST /health-connect/auth
Tilko를 통한 사용자 인증

**요청**
```json
{
  "userName": "홍길동",
  "phoneNumber": "01012345678",
  "birthDate": "19901231",
  "gender": "M"
}
```

**응답**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "인증 성공",
  "expiresAt": "2024-01-01T23:59:59Z"
}
```

**에러 응답**
```json
{
  "success": false,
  "message": "인증 실패: 입력된 정보가 올바르지 않습니다",
  "errorCode": "AUTH_FAILED"
}
```

### 2. 건강검진 데이터 조회

#### POST /health-connect/checkup
건강검진 데이터 조회

**요청**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "startDate": "20230101",
  "endDate": "20231231"
}
```

**응답**
```json
{
  "success": true,
  "data": [
    {
      "id": "checkup_001",
      "date": "2023-06-15",
      "hospitalName": "김현우내과의원",
      "doctorName": "김현우",
      "categories": [
        {
          "name": "기본 검진",
          "items": [
            {
              "name": "키",
              "value": "175",
              "unit": "cm",
              "normalRange": "160-180",
              "isNormal": true
            }
          ]
        }
      ],
      "overallStatus": "정상",
      "recommendations": ["규칙적인 운동을 권장합니다"]
    }
  ],
  "message": "조회 성공"
}
```

### 3. 처방전 데이터 조회

#### POST /health-connect/prescription
처방전 데이터 조회

**요청**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "startDate": "20230101",
  "endDate": "20231231"
}
```

**응답**
```json
{
  "success": true,
  "data": [
    {
      "id": "prescription_001",
      "date": "2023-07-20",
      "hospitalName": "김현우내과의원",
      "doctorName": "김현우",
      "department": "내과",
      "diagnosis": "고혈압",
      "medications": [
        {
          "name": "혈압약",
          "dosage": "10mg",
          "frequency": "1일 1회",
          "duration": "30일",
          "instructions": "식후 복용",
          "totalAmount": 30
        }
      ],
      "totalCost": 15000,
      "insuranceCoverage": 12000
    }
  ],
  "message": "조회 성공"
}
```

### 4. 통합 건강 데이터 조회

#### GET /health-connect/data
건강검진과 처방전 데이터를 통합하여 조회

**요청 파라미터**
- `token` (required): 인증 토큰
- `startDate` (optional): 조회 시작일 (YYYYMMDD)
- `endDate` (optional): 조회 종료일 (YYYYMMDD)

**응답**
```json
{
  "success": true,
  "data": {
    "checkupResults": [...],
    "prescriptions": [...],
    "lastUpdated": "2024-01-01T12:00:00Z"
  },
  "message": "데이터 조회 성공"
}
```

### 5. 서비스 상태 확인

#### GET /health-connect/status
서비스 상태 및 설정 확인

**응답**
```json
{
  "service": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "apiHost": "https://api.tilko.net",
  "hasApiKey": true,
  "hasEncryptionKey": true
}
```

## 에러 코드

| 코드 | 설명 | HTTP 상태 |
|------|------|-----------|
| AUTH_ERROR | 인증 실패 | 401 |
| API_ERROR | Tilko API 오류 | 400 |
| SERVICE_ERROR | 내부 서비스 오류 | 500 |
| NETWORK_ERROR | 네트워크 연결 오류 | 503 |
| TIMEOUT_ERROR | 요청 시간 초과 | 408 |
| VALIDATION_ERROR | 입력 데이터 검증 실패 | 422 |

## 보안

### 암호화
- **AES-256-CBC**: 요청/응답 데이터 암호화
- **RSA-2048**: 초기 인증 데이터 암호화
- **TLS 1.3**: 전송 계층 암호화

### 인증
- **JWT 토큰**: 24시간 유효
- **API 키**: Tilko API 접근 인증
- **CSRF 보호**: 프론트엔드 요청 검증

## 프론트엔드 통합

### React 컴포넌트

#### HealthDataViewer
```typescript
import { HealthDataViewer } from './components/health';

function App() {
  return (
    <HealthDataViewer
      onBack={() => navigate(-1)}
      onError={(error) => console.error(error)}
    />
  );
}
```

#### 커스텀 훅 사용
```typescript
import { useHealthData } from './hooks/health/useHealthData';

function MyComponent() {
  const {
    data,
    loading,
    error,
    authenticate,
    fetchHealthData,
    refresh
  } = useHealthData();

  // 인증
  const handleAuth = async () => {
    await authenticate({
      userName: '홍길동',
      phoneNumber: '01012345678',
      birthDate: '19901231',
      gender: 'M'
    });
  };

  // 데이터 조회
  const handleFetch = async () => {
    await fetchHealthData();
  };

  return (
    <div>
      {loading && <p>로딩 중...</p>}
      {error && <p>에러: {error.message}</p>}
      {data && <p>데이터 로드됨</p>}
    </div>
  );
}
```

### 서비스 사용
```typescript
import { healthConnectService } from './services/health/HealthConnectService';

// 직접 API 호출
const authenticate = async () => {
  try {
    const response = await healthConnectService.authenticate({
      userName: '홍길동',
      phoneNumber: '01012345678',
      birthDate: '19901231',
      gender: 'M'
    });
    
    if (response.success) {
      console.log('인증 성공:', response.token);
    }
  } catch (error) {
    console.error('인증 실패:', error);
  }
};

// 통합 데이터 조회
const fetchData = async (token: string) => {
  try {
    const response = await healthConnectService.getHealthData(token);
    
    if (response.success) {
      console.log('검진 결과:', response.data?.checkupResults);
      console.log('처방전:', response.data?.prescriptions);
    }
  } catch (error) {
    console.error('데이터 조회 실패:', error);
  }
};
```

## 환경 설정

### 백엔드 (.env)
```env
TILKO_API_HOST=https://api.tilko.net
TILKO_API_KEY=your_tilko_api_key
TILKO_ENCRYPTION_KEY=your_encryption_key
```

### 프론트엔드 (.env)
```env
REACT_APP_TILKO_API_HOST=http://localhost:8001
REACT_APP_BACKEND_URL=http://localhost:8001
```

## 배포 고려사항

### 백엔드
1. **환경변수 보안**: 실제 API 키는 환경변수로 관리
2. **로깅**: 민감한 정보는 로그에서 제외
3. **Rate Limiting**: API 호출 빈도 제한
4. **모니터링**: 서비스 상태 및 성능 모니터링

### 프론트엔드
1. **API 키 보안**: 민감한 키는 백엔드에서만 관리
2. **에러 처리**: 사용자 친화적인 에러 메시지
3. **로딩 상태**: 적절한 로딩 인디케이터
4. **캐싱**: API 응답 캐싱으로 성능 최적화

## 테스트

### 단위 테스트
```typescript
// TilkoService 테스트
describe('TilkoService', () => {
  it('should authenticate user successfully', async () => {
    const service = new TilkoService();
    const response = await service.authenticate({
      userName: '테스트',
      phoneNumber: '01012345678',
      birthDate: '19901231',
      gender: 'M'
    });
    
    expect(response.success).toBe(true);
    expect(response.token).toBeDefined();
  });
});
```

### 통합 테스트
```typescript
// API 엔드포인트 테스트
describe('Health Connect API', () => {
  it('should return health data', async () => {
    const response = await request(app)
      .get('/health-connect/data')
      .query({ token: 'test_token' })
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });
});
```

## 문제 해결

### 일반적인 문제

1. **인증 실패**
   - 입력 정보 확인
   - API 키 유효성 검증
   - 네트워크 연결 상태 확인

2. **데이터 조회 실패**
   - 토큰 만료 여부 확인
   - 날짜 범위 유효성 검증
   - Tilko 서비스 상태 확인

3. **암호화 오류**
   - 암호화 키 설정 확인
   - 데이터 포맷 검증
   - 버전 호환성 확인

### 디버깅

```typescript
// 디버그 모드 활성화
const service = new HealthConnectService({
  apiHost: 'http://localhost:8001',
  timeout: 30000,
  retryAttempts: 1  // 디버깅 시 재시도 줄이기
});

// 상세 로그 확인
console.log('Service status:', await service.getStatus());
```

## 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다.

## 연락처

기술 지원: [기술팀 이메일]
API 문의: [API팀 이메일]
