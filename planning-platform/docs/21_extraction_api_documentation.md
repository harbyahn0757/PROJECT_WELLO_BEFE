# 추출 API 서비스 문서

## 📋 개요
건강검진 데이터 추출을 위한 API 서비스 사용법 및 예제 문서

## 🏗️ 아키텍처

### 백엔드 구조
```
backend/
├── services/
│   └── extraction_service.py      # 추출 서비스 핵심 로직
├── api/v1/endpoints/
│   └── extraction.py              # REST API 엔드포인트
└── models/
    └── relationship_models.py     # 데이터 모델
```

### 프론트엔드 구조
```
frontend/src/shared/services/api/
└── extractionService.js           # API 클라이언트 서비스
```

## 🔧 API 엔드포인트

### 1. 데이터 추출
**POST** `/api/v1/extraction/extract`

PDF 파일에서 설정된 매핑에 따라 건강검진 데이터를 추출합니다.

#### 요청 파라미터
- `file` (File): PDF 파일
- `mappings` (string): JSON 문자열로 인코딩된 키-값 매핑 설정
- `processor_type` (string): PDF 처리기 타입 (기본값: "pdfplumber")

#### 응답 예시
```json
{
  "success": true,
  "file_name": "건강검진_홍길동.pdf",
  "extracted_count": 5,
  "extracted_data": [
    {
      "key": "name",
      "label": "이름",
      "value": "홍길동",
      "confidence": 0.95,
      "position": {
        "anchor": {"row": 2, "col": 1},
        "value": {"row": 2, "col": 2}
      }
    }
  ],
  "processing_time": 2.5,
  "extracted_at": "2025-01-27T10:30:00Z"
}
```

### 2. 빠른 추출 테스트
**POST** `/api/v1/extraction/quick-test`

설정된 매핑으로 간단한 추출 테스트를 수행합니다.

#### 요청 파라미터
- `file` (File): PDF 파일
- `template_name` (string): 템플릿 이름
- `mappings` (string): JSON 문자열로 인코딩된 키-값 매핑 설정

#### 응답 예시
```json
{
  "success": true,
  "template_name": "건강검진 기본 템플릿",
  "file_name": "건강검진_홍길동.pdf",
  "extracted_count": 5,
  "extracted_data": [...],
  "extracted_at": "2025-01-27T10:30:00Z",
  "processing_time": 2.5
}
```

### 3. 매핑 설정 검증
**POST** `/api/v1/extraction/validate-mappings`

추출 매핑 설정의 유효성을 검증합니다.

#### 요청 파라미터
- `mappings` (Array): 검증할 매핑 설정 목록

#### 응답 예시
```json
{
  "valid": true,
  "errors": [],
  "warnings": [],
  "mapping_count": 5
}
```

### 4. 템플릿 저장
**POST** `/api/v1/extraction/templates`

추출 설정을 템플릿으로 저장합니다.

#### 요청 파라미터
- `template_name` (string): 템플릿 이름
- `mappings` (string): JSON 문자열로 인코딩된 키-값 매핑 설정
- `file_info` (string, 선택사항): JSON 문자열로 인코딩된 파일 정보

#### 응답 예시
```json
{
  "success": true,
  "template_id": "template_20250127_103000",
  "template_name": "건강검진 기본 템플릿",
  "mapping_count": 5,
  "saved_at": "2025-01-27T10:30:00Z"
}
```

### 5. 템플릿 목록 조회
**GET** `/api/v1/extraction/templates`

저장된 템플릿 목록을 조회합니다.

#### 응답 예시
```json
{
  "success": true,
  "templates": [
    {
      "id": "template_20250127_103000",
      "name": "건강검진 기본 템플릿",
      "mapping_count": 5,
      "created_at": "2025-01-27T10:30:00Z"
    }
  ],
  "count": 1
}
```

### 6. 템플릿 조회
**GET** `/api/v1/extraction/templates/{template_id}`

특정 템플릿의 상세 정보를 조회합니다.

#### 응답 예시
```json
{
  "success": true,
  "template": {
    "id": "template_20250127_103000",
    "name": "건강검진 기본 템플릿",
    "mappings": [...],
    "file_info": {...},
    "created_at": "2025-01-27T10:30:00Z"
  }
}
```

### 7. 서비스 상태 확인
**GET** `/api/v1/extraction/health`

추출 서비스의 상태를 확인합니다.

#### 응답 예시
```json
{
  "status": "healthy",
  "service": "extraction",
  "version": "1.0.0",
  "timestamp": "2025-01-27T00:00:00Z"
}
```

## 💻 프론트엔드 사용법

### 1. 서비스 임포트
```javascript
import { 
  extractHealthData, 
  quickExtractionTest, 
  saveExtractionTemplate,
  listExtractionTemplates 
} from '../shared/services/api/extractionService';
```

### 2. 데이터 추출 예제
```javascript
const handleExtractData = async (file, mappings) => {
  try {
    const result = await extractHealthData(file, mappings, 'pdfplumber');
    
    if (result.success) {
      console.log('추출 완료:', result.data);
      // 추출된 데이터 처리
      setExtractedData(result.data.extracted_data);
    } else {
      console.error('추출 실패:', result.error);
      showError(result.error);
    }
  } catch (error) {
    console.error('API 호출 실패:', error);
  }
};
```

### 3. 빠른 테스트 예제
```javascript
const handleQuickTest = async (file, templateName, mappings) => {
  try {
    const result = await quickExtractionTest(file, templateName, mappings);
    
    if (result.success) {
      console.log('테스트 완료:', result.data);
      setTestResults(result.data);
    } else {
      console.error('테스트 실패:', result.error);
    }
  } catch (error) {
    console.error('API 호출 실패:', error);
  }
};
```

### 4. 템플릿 저장 예제
```javascript
const handleSaveTemplate = async (templateName, mappings, fileInfo) => {
  try {
    const result = await saveExtractionTemplate(templateName, mappings, fileInfo);
    
    if (result.success) {
      console.log('템플릿 저장 완료:', result.data);
      showSuccess(`"${templateName}" 템플릿이 저장되었습니다`);
    } else {
      console.error('템플릿 저장 실패:', result.error);
      showError(result.error);
    }
  } catch (error) {
    console.error('API 호출 실패:', error);
  }
};
```

### 5. 템플릿 목록 조회 예제
```javascript
const loadTemplates = async () => {
  try {
    const result = await listExtractionTemplates();
    
    if (result.success) {
      console.log('템플릿 목록:', result.data.templates);
      setTemplates(result.data.templates);
    } else {
      console.error('템플릿 목록 조회 실패:', result.error);
    }
  } catch (error) {
    console.error('API 호출 실패:', error);
  }
};
```

## 📊 매핑 설정 형식

### 매핑 객체 구조
```javascript
const mapping = {
  id: "unique_id",
  key: "name",                    // 추출할 키
  keyLabel: "이름",               // 키의 한글 라벨
  anchorCell: {                   // 앵커 셀 정보
    row: 2,
    col: 1,
    value: "이름"
  },
  valueCell: {                    // 값 셀 정보
    row: 2,
    col: 2,
    value: "홍길동"
  },
  relativePosition: {             // 상대 위치
    row: 0,
    col: 1
  },
  createdAt: "2025-01-27T10:30:00Z"
};
```

### 매핑 설정 예제
```javascript
const mappings = [
  {
    key: "name",
    keyLabel: "이름",
    anchorCell: { row: 2, col: 1, value: "이름" },
    valueCell: { row: 2, col: 2, value: "홍길동" },
    relativePosition: { row: 0, col: 1 }
  },
  {
    key: "age",
    keyLabel: "나이",
    anchorCell: { row: 3, col: 1, value: "나이" },
    valueCell: { row: 3, col: 2, value: "35" },
    relativePosition: { row: 0, col: 1 }
  }
];
```

## 🔍 에러 처리

### 공통 에러 응답 형식
```json
{
  "success": false,
  "error": "에러 메시지",
  "details": "상세 에러 정보 (선택사항)"
}
```

### 주요 에러 코드
- `400`: 잘못된 요청 (파라미터 오류, 형식 오류)
- `404`: 리소스를 찾을 수 없음 (템플릿, 파일 등)
- `500`: 서버 내부 오류 (처리 실패, 시스템 오류)
- `503`: 서비스 사용 불가 (서비스 다운, 과부하)

## 🚀 성능 최적화

### 1. 파일 크기 제한
- PDF 파일: 최대 50MB
- 처리 시간: 일반적으로 2-5초

### 2. 매핑 수 제한
- 권장 매핑 수: 50개 이하
- 최대 매핑 수: 100개

### 3. 동시 요청 제한
- 사용자당 동시 요청: 3개
- 서버 전체 동시 요청: 100개

## 📝 사용 시 주의사항

### 1. 파일 형식
- 지원 형식: PDF만 지원
- 권장 해상도: 300 DPI 이상
- 텍스트 기반 PDF 권장 (이미지 스캔 PDF는 OCR 필요)

### 2. 매핑 설정
- 앵커와 값 셀의 위치 관계가 일관되어야 함
- 상대 위치는 앵커를 기준으로 한 오프셋
- 매핑 설정은 템플릿별로 저장됨

### 3. 보안
- 모든 API는 인증 필요
- 업로드된 파일은 처리 후 자동 삭제
- 개인정보가 포함된 파일은 암호화 처리

## 🔄 버전 관리

### 현재 버전: v1.0.0
- 기본 추출 기능
- 템플릿 관리
- 빠른 테스트

### 향후 계획
- v1.1.0: OCR 지원
- v1.2.0: 배치 처리
- v2.0.0: AI 기반 자동 매핑

## 📞 지원

### 기술 지원
- 이메일: support@example.com
- 문서: [API 문서 링크]
- 이슈 트래커: [GitHub Issues 링크]

### 업데이트 알림
- API 변경사항은 30일 전 사전 공지
- 하위 호환성 유지 (v1.x 범위 내)
- 주요 변경사항은 별도 마이그레이션 가이드 제공
