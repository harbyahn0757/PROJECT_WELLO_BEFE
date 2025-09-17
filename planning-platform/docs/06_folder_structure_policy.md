# 폴더 구조 및 아키텍처 정책

## 📂 전체 프로젝트 구조 개요

```
pdf-table-analyzer/
├── 📚 documents/              # 프로젝트 문서
├── 🐍 backend/               # Python FastAPI 백엔드
├── ⚛️ frontend/              # React 프론트엔드
├── 📄 samples/               # 테스트용 PDF 파일
├── ⚙️ relationships/         # 저장된 관계 설정 파일
├── 🗂️ cache/                # 처리 결과 캐시
└── 📋 README.md             # 프로젝트 메인 문서
```

## 🐍 백엔드 폴더 구조 정책

### 핵심 설계 원칙
1. **기능별 모듈화**: 각 기능을 독립된 모듈로 분리
2. **계층 분리**: 라우터 → 서비스 → 저장소 계층 구분
3. **공통 코드 중앙화**: 재사용 가능한 코드는 shared 폴더에 집중
4. **설정 분리**: 환경별 설정을 별도 관리

### 상세 폴더 구조

```
backend/
├── 🚀 main.py                    # FastAPI 애플리케이션 진입점
├── 📋 requirements.txt           # Python 의존성
├── 🔧 core/                     # 핵심 애플리케이션 설정
│   ├── __init__.py
│   ├── config.py                # 환경 설정
│   ├── dependencies.py          # 의존성 주입
│   ├── middleware.py            # 미들웨어 설정
│   └── exceptions.py            # 전역 예외 처리
├── 🎯 features/                 # 기능별 모듈
│   ├── pdf_processing/          # PDF 처리 기능
│   │   ├── __init__.py
│   │   ├── 🛣️ router.py          # PDF 관련 API 엔드포인트
│   │   ├── ⚙️ service.py         # PDF 처리 비즈니스 로직
│   │   ├── 📊 models.py          # PDF 관련 데이터 모델
│   │   ├── 🔧 extractors.py      # PDF 추출 엔진들
│   │   └── 📁 schemas.py         # 요청/응답 스키마
│   ├── file_management/         # 파일 관리 기능
│   │   ├── __init__.py
│   │   ├── 🛣️ router.py          # 파일 관련 API
│   │   ├── ⚙️ service.py         # 파일 관리 로직
│   │   ├── 📊 models.py          # 파일 메타데이터 모델
│   │   └── 📁 schemas.py         # 파일 관련 스키마
│   └── relationship_management/ # 관계 설정 기능
│       ├── __init__.py
│       ├── 🛣️ router.py          # 관계 설정 API
│       ├── ⚙️ service.py         # 관계 설정 로직
│       ├── 📊 models.py          # 관계 설정 모델
│       ├── 📁 schemas.py         # 관계 설정 스키마
│       ├── 💾 repository.py      # 데이터 저장/로드
│       └── 🔍 validator.py       # 관계 설정 검증
├── 🤝 shared/                   # 공통 모듈
│   ├── models/                  # 공통 데이터 모델
│   │   ├── __init__.py
│   │   ├── base.py              # 베이스 모델
│   │   └── common.py            # 공통 모델
│   ├── utils/                   # 유틸리티 함수
│   │   ├── __init__.py
│   │   ├── file_utils.py        # 파일 관련 유틸
│   │   ├── cache_utils.py       # 캐시 관련 유틸
│   │   ├── validation_utils.py  # 검증 유틸
│   │   └── response_utils.py    # 응답 포맷팅 유틸
│   └── constants/               # 상수 정의
│       ├── __init__.py
│       ├── pdf_constants.py     # PDF 관련 상수
│       └── api_constants.py     # API 관련 상수
└── 🧪 tests/                    # 테스트 코드
    ├── __init__.py
    ├── conftest.py              # pytest 설정
    ├── test_pdf_processing/     # PDF 처리 테스트
    ├── test_file_management/    # 파일 관리 테스트
    └── test_relationship/       # 관계 설정 테스트
```

### 백엔드 명명 규칙

#### 파일 명명
- **라우터**: `router.py` - API 엔드포인트 정의
- **서비스**: `service.py` - 비즈니스 로직 구현
- **모델**: `models.py` - 데이터베이스/도메인 모델
- **스키마**: `schemas.py` - Pydantic 요청/응답 모델
- **저장소**: `repository.py` - 데이터 액세스 계층

#### 함수/클래스 명명
```python
# 클래스: PascalCase
class PDFProcessingService:
    pass

class RelationshipConfig:
    pass

# 함수: snake_case
def extract_tables_from_pdf():
    pass

def save_relationship_config():
    pass

# 상수: UPPER_SNAKE_CASE
MAX_FILE_SIZE = 10 * 1024 * 1024
SUPPORTED_PDF_LIBRARIES = ["pdfplumber", "camelot", "tabula"]
```

## ⚛️ 프론트엔드 폴더 구조 정책

### 핵심 설계 원칙
1. **기능 중심 구조**: 페이지/화면별이 아닌 기능별 폴더링
2. **컴포넌트 재사용성**: 공통 컴포넌트의 중앙화
3. **관심사 분리**: UI, 로직, 스타일, 데이터의 명확한 분리
4. **스케일링 고려**: 기능 추가 시 확장 용이한 구조

### 상세 폴더 구조

```
frontend/
├── 📦 public/                   # 정적 자원
│   ├── index.html
│   ├── favicon.ico
│   └── manifest.json
├── 📁 src/                      # 소스 코드
│   ├── 🚀 App.js                # 메인 애플리케이션 컴포넌트
│   ├── 🏁 index.js              # 애플리케이션 진입점
│   ├── 🎯 features/             # 기능별 모듈
│   │   ├── pdf_processing/      # PDF 처리 기능
│   │   │   ├── 📱 components/    # PDF 관련 컴포넌트
│   │   │   │   ├── FileSelector.js
│   │   │   │   ├── LibrarySelector.js
│   │   │   │   ├── ProcessButton.js
│   │   │   │   └── ProcessingStatus.js
│   │   │   ├── 🪝 hooks/         # PDF 관련 커스텀 훅
│   │   │   │   ├── usePdfProcessor.js
│   │   │   │   └── useFileSelection.js
│   │   │   ├── 🌐 services/      # PDF API 서비스
│   │   │   │   └── pdfApiService.js
│   │   │   └── 🎨 styles/        # PDF 관련 스타일
│   │   │       └── pdfProcessing.module.css
│   │   ├── table_display/       # 테이블 표시 기능
│   │   │   ├── 📱 components/    # 테이블 관련 컴포넌트
│   │   │   │   ├── TableGrid.js
│   │   │   │   ├── PageTabs.js
│   │   │   │   ├── CellSelector.js
│   │   │   │   └── GridNavigator.js
│   │   │   ├── 🪝 hooks/         # 테이블 관련 훅
│   │   │   │   ├── useTableData.js
│   │   │   │   ├── useCellSelection.js
│   │   │   │   └── useGridNavigation.js
│   │   │   ├── 🔧 utils/         # 테이블 유틸리티
│   │   │   │   ├── gridCalculations.js
│   │   │   │   └── cellPositioning.js
│   │   │   └── 🎨 styles/        # 테이블 관련 스타일
│   │   │       ├── tableGrid.module.css
│   │   │       └── cellStyles.module.css
│   │   └── relationship_management/ # 관계 설정 기능
│   │       ├── 📱 components/    # 관계 설정 컴포넌트
│   │       │   ├── KeyManager.js
│   │       │   ├── RelationshipEditor.js
│   │       │   ├── ConfigSaver.js
│   │       │   └── RelationshipList.js
│   │       ├── 🪝 hooks/         # 관계 설정 훅
│   │       │   ├── useRelationships.js
│   │       │   ├── useKeyManagement.js
│   │       │   └── useConfigManager.js
│   │       ├── 🌐 services/      # 관계 설정 API
│   │       │   └── relationshipApiService.js
│   │       └── 🎨 styles/        # 관계 설정 스타일
│   │           └── relationship.module.css
│   ├── 🤝 shared/               # 공통 모듈
│   │   ├── 📱 components/        # 재사용 가능한 공통 컴포넌트
│   │   │   ├── ui/              # 기본 UI 컴포넌트
│   │   │   │   ├── Button.js
│   │   │   │   ├── Input.js
│   │   │   │   ├── Card.js
│   │   │   │   ├── Modal.js
│   │   │   │   ├── Loading.js
│   │   │   │   └── Toast.js
│   │   │   └── layout/          # 레이아웃 컴포넌트
│   │   │       ├── Header.js
│   │   │       ├── MainLayout.js
│   │   │       ├── Sidebar.js
│   │   │       └── ContentArea.js
│   │   ├── 🪝 hooks/            # 공통 커스텀 훅
│   │   │   ├── useApi.js
│   │   │   ├── useLocalStorage.js
│   │   │   ├── useDebounce.js
│   │   │   └── useNotification.js
│   │   ├── 🌐 services/         # 공통 서비스
│   │   │   ├── apiClient.js     # HTTP 클라이언트 설정
│   │   │   ├── storageService.js # 로컬 스토리지 서비스
│   │   │   └── notificationService.js # 알림 서비스
│   │   ├── 🔧 utils/            # 공통 유틸리티
│   │   │   ├── constants.js     # 상수 정의
│   │   │   ├── helpers.js       # 헬퍼 함수
│   │   │   ├── validators.js    # 검증 함수
│   │   │   └── formatters.js    # 포맷팅 함수
│   │   └── 🎨 styles/           # 공통 스타일
│   │       ├── globals.css      # 전역 스타일
│   │       ├── variables.css    # CSS 변수
│   │       ├── components.css   # 공통 컴포넌트 스타일
│   │       └── themes.css       # 테마 정의
│   └── 📄 types/                # TypeScript 타입 정의 (향후)
│       ├── api.ts
│       ├── pdf.ts
│       └── relationship.ts
├── 📦 package.json              # Node.js 의존성
└── 🧪 tests/                    # 테스트 코드
    ├── __tests__/               # Jest 테스트
    ├── __mocks__/               # 모킹 데이터
    └── utils/                   # 테스트 유틸리티
```

### 프론트엔드 명명 규칙

#### 파일 명명
- **컴포넌트**: `PascalCase.js` (예: `TableGrid.js`)
- **훅**: `camelCase.js` with use prefix (예: `useTableData.js`)
- **서비스**: `camelCase.js` with Service suffix (예: `pdfApiService.js`)
- **유틸리티**: `camelCase.js` (예: `gridCalculations.js`)
- **스타일**: `camelCase.module.css` (예: `tableGrid.module.css`)

#### 컴포넌트 구조
```javascript
// 컴포넌트 파일 구조 예시
import React from 'react';
import styles from './TableGrid.module.css';
import { useTableData } from '../hooks/useTableData';

const TableGrid = ({ data, onCellSelect }) => {
  // 1. 훅 사용
  const { processedData, isLoading } = useTableData(data);
  
  // 2. 이벤트 핸들러
  const handleCellClick = (row, col) => {
    onCellSelect({ row, col, value: processedData[row][col] });
  };
  
  // 3. 렌더링
  return (
    <div className={styles.gridContainer}>
      {/* JSX 내용 */}
    </div>
  );
};

export default TableGrid;
```

## 📋 폴더 구조 원칙

### 1. 기능별 응집성 (Feature Cohesion)
- 관련 기능들을 하나의 폴더에 모음
- 각 기능 폴더는 독립적으로 동작 가능
- 기능 간 의존성 최소화

### 2. 계층별 분리 (Layer Separation)
```
UI Layer (컴포넌트) → Logic Layer (훅/서비스) → Data Layer (API/스토리지)
```

### 3. 공통 코드 중앙화 (Shared Centralization)
- 재사용 가능한 코드는 `shared` 폴더에 위치
- 기능별 폴더는 해당 기능에만 특화된 코드 포함
- 의존성 방향: 기능 폴더 → 공통 폴더 (역방향 금지)

### 4. 확장성 고려 (Scalability)
- 새로운 기능 추가 시 기존 구조에 영향 최소화
- 폴더 구조만으로 프로젝트 전체 기능 파악 가능
- 컴포넌트 크기가 커지면 하위 폴더로 분할

### 5. 테스트 가능성 (Testability)
- 각 기능별로 테스트 코드 분리
- 모킹 가능한 구조로 설계
- 단위/통합 테스트 구분

## 🔄 폴더 간 의존성 규칙

### 허용되는 의존성
```
✅ features/pdf_processing → shared/
✅ features/table_display → shared/
✅ features/relationship_management → shared/
✅ features/table_display → features/pdf_processing (데이터 전달)
```

### 금지되는 의존성
```
❌ shared/ → features/ (공통 모듈이 특정 기능에 의존)
❌ features/pdf_processing → features/relationship_management (직접 의존)
```

### 기능 간 통신 방법
1. **Props 전달**: 부모 컴포넌트를 통한 데이터 전달
2. **Context API**: 전역 상태 관리 (필요시)
3. **이벤트 시스템**: 느슨한 결합을 위한 이벤트 기반 통신

## 📝 파일 생성 시 체크리스트

### 새 기능 추가 시
- [ ] 적절한 features 하위 폴더에 배치
- [ ] 컴포넌트, 훅, 서비스, 스타일 분리
- [ ] 공통 로직은 shared 폴더 활용
- [ ] 테스트 코드 함께 작성
- [ ] README 파일에 기능 설명 추가

### 새 컴포넌트 생성 시
- [ ] PascalCase 명명
- [ ] 해당 기능 폴더의 components 하위에 배치
- [ ] CSS Module 사용
- [ ] PropTypes 또는 TypeScript 타입 정의
- [ ] 스토리북 스토리 작성 (향후)

이 폴더 구조를 통해 코드의 가독성, 유지보수성, 확장성을 모두 확보할 수 있습니다.

---

## 🎯 프론트엔드 모듈화 가이드라인 (2024.01.25 업데이트)

### ✅ 실제 적용된 모듈화 사례

#### 1. 대규모 파일 분해 성공 사례
- **App.js**: 1,698줄 → 85줄 (95% 감소)
- **분해 방법**: 기능별 훅과 컴포넌트로 분리
- **결과**: 유지보수성과 가독성 대폭 향상

#### 2. 커스텀 훅 분리 패턴

##### A. 비즈니스 로직 훅
```javascript
// ✅ 템플릿 관리 로직 (527줄)
export const useTemplateManagement = ({ showSuccess, showError, showInfo }) => {
  // 상태 관리
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  // 비즈니스 로직
  const loadTemplates = useCallback(async () => { /* ... */ }, []);
  const handleSaveTemplate = useCallback(async (templateData) => { /* ... */ }, []);
  
  return {
    savedTemplates,
    selectedTemplate,
    loadTemplates,
    handleSaveTemplate
  };
};
```

##### B. UI 상태 관리 훅
```javascript
// ✅ 셀 매핑 로직 (306줄)
export const useCellMapping = ({ showSuccess, showError, showInfo }) => {
  // 상태 관리
  const [anchorCell, setAnchorCell] = useState(null);
  const [valueCell, setValueCell] = useState(null);
  const [keyMappings, setKeyMappings] = useState([]);
  
  // 이벤트 핸들러
  const handleCellClick = useCallback((rowIndex, colIndex, cellValue) => { /* ... */ }, []);
  const handleSaveMapping = useCallback((mappingData) => { /* ... */ }, []);
  
  return {
    anchorCell,
    valueCell,
    keyMappings,
    handleCellClick,
    handleSaveMapping
  };
};
```

#### 3. 페이지 컴포넌트 분리 패턴

##### A. 페이지별 상태 통합
```javascript
// ✅ DataExtractionPage (400줄)
const DataExtractionPage = () => {
  // 여러 훅을 조합하여 페이지 상태 관리
  const { analysisResults, startAnalysis } = useAnalysis();
  const { uploadedFiles } = useFileManagement();
  const { keyMappings, handleCellClick } = useCellMapping({ showSuccess, showError, showInfo });
  const { savedTemplates, handleSaveTemplate } = useTemplateManagement({ showSuccess, showError, showInfo });
  
  return (
    <MultiSectionLayout>
      <FileUploadSection />
      <TableDataSection />
      <KeySettingsSection />
    </MultiSectionLayout>
  );
};
```

#### 4. 섹션 컴포넌트 분리 패턴

##### A. 재사용 가능한 UI 섹션
```javascript
// ✅ FileUploadSection (80줄)
const FileUploadSection = ({ 
  selectedFile, 
  onFileSelect, 
  selectedLibrary, 
  onLibraryChange, 
  onStartAnalysis 
}) => {
  return (
    <SectionContainer title="파일 업로드 및 분석 설정">
      <FileUpload onFileSelect={onFileSelect} />
      <Select 
        value={selectedLibrary} 
        onChange={onLibraryChange}
        options={LIBRARY_OPTIONS}
      />
      <Button onClick={onStartAnalysis}>분석 시작</Button>
    </SectionContainer>
  );
};
```

### 📋 모듈화 적용 규칙

#### 1. 파일 크기 기준
- **1,000줄 이상**: 반드시 분해 필요
- **500줄 이상**: 분해 검토 권장
- **200줄 이상**: 기능별 분리 고려

#### 2. 분해 우선순위
1. **가장 큰 기능 블록** (500줄 이상)
2. **독립적인 기능** (다른 코드와 의존성 적음)
3. **재사용 가능한 로직** (여러 곳에서 사용)
4. **UI 섹션** (명확한 경계가 있는 부분)

#### 3. 네이밍 규칙 강화
- **훅**: `use` + 기능명 (예: `useTemplateManagement`)
- **페이지**: 기능명 + `Page` (예: `DataExtractionPage`)
- **섹션**: 기능명 + `Section` (예: `FileUploadSection`)
- **컴포넌트**: 기능명 + `Component` (예: `TableGrid`)

#### 4. 의존성 관리 규칙
```javascript
// ✅ 올바른 의존성 방향
Page Component → Custom Hooks → Services → Utils

// ❌ 잘못된 의존성 방향
Hook → Page Component (훅이 페이지에 의존하면 안됨)
Service → Hook (서비스가 훅에 의존하면 안됨)
```

### 🔧 모듈화 체크리스트

#### 분해 전 체크사항
- [ ] 파일이 1,000줄을 초과하는가?
- [ ] 명확히 구분되는 기능 블록이 있는가?
- [ ] 재사용 가능한 로직이 있는가?
- [ ] 독립적으로 테스트할 수 있는 부분이 있는가?

#### 분해 후 체크사항
- [ ] 각 모듈이 단일 책임을 가지는가?
- [ ] 의존성 방향이 올바른가?
- [ ] 네이밍 규칙을 준수하는가?
- [ ] 린터 에러가 없는가?
- [ ] 기능이 정상 동작하는가?

### 📊 모듈화 효과 측정

#### 정량적 지표
- **파일 크기 감소율**: 95% (1,698줄 → 85줄)
- **모듈 수 증가**: 1개 → 11개 (훅 5개 + 페이지 3개 + 섹션 3개)
- **린터 에러**: 0개
- **재사용 가능 컴포넌트**: 8개

#### 정성적 효과
- **가독성**: 코드 구조가 명확해짐
- **유지보수성**: 특정 기능 수정 시 해당 모듈만 수정
- **테스트 용이성**: 각 모듈을 독립적으로 테스트 가능
- **확장성**: 새로운 기능 추가 시 기존 코드 영향 최소화

### 🚀 모듈화 적용 가이드

#### 1단계: 분석
- 파일 크기와 기능 블록 파악
- 의존성 관계 분석
- 재사용 가능한 부분 식별

#### 2단계: 설계
- 모듈 경계 정의
- 인터페이스 설계
- 네이밍 규칙 적용

#### 3단계: 구현
- 훅부터 분리 (비즈니스 로직)
- 컴포넌트 분리 (UI 로직)
- 페이지 통합 (상태 관리)

#### 4단계: 검증
- 기능 동작 확인
- 린터 에러 해결
- 성능 영향 측정

이 가이드라인을 통해 대규모 파일을 효과적으로 모듈화할 수 있습니다.
