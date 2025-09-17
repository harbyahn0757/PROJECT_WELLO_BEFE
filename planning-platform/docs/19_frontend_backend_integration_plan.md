게 ㅗ정ㅎ# 프론트엔드-백엔드 연동 계획

## 개요
완성된 FastAPI 백엔드와 React 프론트엔드 간의 연동을 체계적으로 진행합니다.

## 현재 상태
- **백엔드**: 완전히 구현 및 정책 준수 완료
- **프론트엔드**: UI 컴포넌트 완성, API 연동 필요
- **연동 대상**: 파일 관리, PDF 처리, 관계 설정 API

## 연동 단계

### 1단계: API 서비스 레이어 구현
**목표**: 백엔드 API와 통신하는 서비스 클래스들 구현

**구현 대상**:
- `FileService`: 파일 업로드, 목록 조회, 삭제
- `ExtractionService`: PDF 테이블 추출, 라이브러리 비교
- `RelationshipService`: 관계 설정 생성, 저장, 적용

**작업 내용**:
```javascript
// frontend/src/shared/services/api/
├── BaseApiService.js     // 공통 API 클래스
├── FileApiService.js     // 파일 관련 API
├── ExtractionApiService.js  // PDF 추출 API
└── RelationshipApiService.js // 관계 설정 API
```

### 2단계: 상태 관리 구현
**목표**: React 훅을 활용한 상태 관리 시스템

**구현 대상**:
- `useFileManagement`: 파일 업로드/관리 상태
- `usePdfExtraction`: PDF 처리 상태 및 결과
- `useRelationshipSettings`: 관계 설정 상태
- `useTableData`: 테이블 데이터 표시 상태

**작업 내용**:
```javascript
// frontend/src/shared/hooks/
├── useFileManagement.js
├── usePdfExtraction.js
├── useRelationshipSettings.js
└── useTableData.js
```

### 3단계: 기능별 컴포넌트 연동
**목표**: UI 컴포넌트들과 API 서비스 연결

**연동 순서**:
1. **파일 업로드 기능**: 드롭존, 파일 선택, 샘플 파일 목록
2. **PDF 처리 기능**: 라이브러리 선택, 추출 실행, 진행률 표시
3. **테이블 표시 기능**: 그리드 렌더링, 셀 선택, 페이지 네비게이션
4. **관계 설정 기능**: 앵커/값 셀 설정, 키 관리, 관계 저장

### 4단계: 에러 처리 및 로딩 상태
**목표**: 사용자 경험 개선을 위한 피드백 시스템

**구현 내용**:
- 로딩 스피너 및 진행률 표시
- API 에러 처리 및 사용자 친화적 메시지
- 네트워크 상태 확인 및 재시도 로직
- 타임아웃 처리

### 5단계: 성능 최적화
**목표**: 대용량 PDF 처리 및 테이블 데이터 렌더링 최적화

**최적화 항목**:
- 테이블 가상화 (대용량 데이터)
- API 응답 캐싱
- 파일 업로드 청크 처리
- 컴포넌트 메모이제이션

## API 엔드포인트 매핑

### 파일 관리 API
```javascript
GET    /api/v1/files/list         → 업로드된 파일 목록 (수정됨)
GET    /api/v1/files/samples      → 샘플 파일 목록
POST   /api/v1/files/upload       → 파일 업로드
GET    /api/v1/files/{file_id}    → 파일 정보 조회
DELETE /api/v1/files/{file_id}    → 파일 삭제
POST   /api/v1/files/batch-delete → 일괄 삭제
```

### PDF 처리 API
```javascript
POST   /api/v1/extraction/tables            → 테이블 추출
POST   /api/v1/extraction/tables/page       → 페이지별 추출
POST   /api/v1/extraction/tables/compare    → 라이브러리 비교
GET    /api/v1/extraction/libraries         → 지원 라이브러리 목록
```

### 관계 설정 API
```javascript
POST   /api/v1/relationships/create         → 관계 생성
GET    /api/v1/relationships/{id}           → 관계 조회
PUT    /api/v1/relationships/{id}           → 관계 수정
DELETE /api/v1/relationships/{id}           → 관계 삭제
POST   /api/v1/relationships/{id}/apply     → 관계 적용
POST   /api/v1/relationships/import         → 관계 설정 가져오기
GET    /api/v1/relationships/{id}/export    → 관계 설정 내보내기
```

## 구현 우선순위

### 높음 (1단계)
1. **BaseApiService**: 공통 HTTP 클라이언트
2. **FileApiService**: 파일 업로드 및 목록 조회
3. **useFileManagement**: 파일 상태 관리
4. **파일 업로드 UI 연동**: 기본 업로드 기능

### 중간 (2단계)  
1. **ExtractionApiService**: PDF 추출 API
2. **usePdfExtraction**: 추출 상태 관리
3. **PDF 처리 UI 연동**: 라이브러리 선택 및 실행

### 보통 (3단계)
1. **테이블 그리드 연동**: 추출 결과 표시
2. **useTableData**: 테이블 상태 관리
3. **RelationshipApiService**: 관계 설정 API

### 낮음 (4단계)
1. **관계 설정 UI 연동**: 앵커/값 설정 기능
2. **에러 처리 개선**: 사용자 피드백 강화
3. **성능 최적화**: 가상화 및 캐싱

## 기술 스택 확인

### 현재 설치된 패키지
- **axios**: HTTP 클라이언트 (v1.11.0)
- **react**: 프론트엔드 프레임워크 (v19.1.1)
- **styled-components**: CSS-in-JS (v6.1.19)

### 추가 필요 패키지
```bash
# 상태 관리 개선
npm install react-query @tanstack/react-query

# 테이블 가상화
npm install react-window react-window-infinite-loader

# 파일 업로드 개선
npm install react-dropzone

# 유틸리티
npm install lodash date-fns
```

## 다음 작업
1. **BaseApiService 구현**: HTTP 클라이언트 기반 클래스
2. **환경 설정**: API 베이스 URL 및 설정 관리
3. **FileApiService 구현**: 파일 관리 API 연동
4. **파일 업로드 컴포넌트 연동**: 실제 API 호출 구현
