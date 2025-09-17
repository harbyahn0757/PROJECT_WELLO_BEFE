# 유틸리티 함수 정책 및 재사용 가이드라인

## 📋 개요
백엔드 시스템에서 유틸리티 함수의 작성, 구성, 재사용에 대한 정책을 정의합니다.
코드 중복을 방지하고 유지보수성을 향상시키기 위한 표준을 제시합니다.

## 🎯 유틸리티 함수 정의 기준

### 1. 유틸리티 함수로 분리해야 하는 경우

#### ✅ **필수 분리 조건**
- **2개 이상의 클래스/모듈에서 동일한 로직이 사용되는 경우**
- **15줄 이상의 독립적인 기능 블록**
- **복잡한 계산이나 변환 로직**
- **외부 라이브러리 래핑이 필요한 경우**

#### ✅ **권장 분리 조건**
- **테스트가 필요한 독립적인 기능**
- **설정값에 따라 동작이 변경되는 로직**
- **에러 처리가 복잡한 기능**
- **향후 확장 가능성이 있는 기능**

### 2. 유틸리티 함수 배치 기준

```
backend/
├── core/                           # 도메인별 유틸리티
│   ├── pdf_processor/
│   │   └── pdf_utils.py           # PDF 처리 관련 공통 함수
│   ├── table_extractor/
│   │   └── table_utils.py         # 테이블 처리 관련 공통 함수
│   └── relationship_manager/
│       └── relationship_utils.py  # 관계 설정 관련 공통 함수
├── utils/                         # 전역 공통 유틸리티
│   ├── file_utils.py             # 파일 처리 공통 함수
│   ├── validation.py             # 검증 관련 공통 함수
│   ├── date_utils.py             # 날짜/시간 관련 함수
│   └── string_utils.py           # 문자열 처리 함수
└── shared/                       # 프로젝트 전체 공유
    └── utils/
        ├── constants.py          # 상수 정의
        ├── enums.py             # 열거형 정의
        └── helpers.py           # 기타 헬퍼 함수
```

## 🔧 유틸리티 함수 작성 규칙

### 1. 클래스 기반 유틸리티

```python
# ✅ 권장: 관련 기능들을 클래스로 그룹화
class PDFUtils:
    """PDF 처리 관련 공통 유틸리티"""
    
    @staticmethod
    def get_page_count(file_path: Path) -> int:
        """PDF 페이지 수 확인"""
        pass
    
    @staticmethod
    def validate_pdf_file_basic(file_path: Path) -> bool:
        """기본 PDF 파일 검증"""
        pass
    
    @classmethod
    def estimate_processing_time(cls, file_path: Path) -> float:
        """처리 시간 예측"""
        pass
```

### 2. 함수 네이밍 규칙

```python
# ✅ 동사 + 명사 패턴
def validate_email(email: str) -> bool:
def extract_numbers(text: str) -> List[int]:
def convert_to_bytes(size: str) -> int:

# ✅ get_ 접두사 (조회)
def get_file_size(path: Path) -> int:
def get_mime_type(path: Path) -> str:

# ✅ is_ 접두사 (불린 반환)
def is_valid_pdf(path: Path) -> bool:
def is_empty_table(data: List[List[str]]) -> bool:

# ✅ calculate_/estimate_ 접두사 (계산)
def calculate_confidence(table: Any) -> float:
def estimate_memory_usage(data_size: int) -> int:
```

### 3. 타입 힌트 필수

```python
# ✅ 모든 매개변수와 반환값에 타입 힌트 명시
def process_file_list(
    files: List[Path], 
    filter_ext: Optional[str] = None
) -> Dict[str, List[Path]]:
    """파일 목록 처리"""
    pass

# ✅ Union 타입 사용 시 명확한 문서화
def parse_size_value(size: Union[str, int]) -> int:
    """
    크기 값 파싱
    
    Args:
        size: "100MB" 같은 문자열 또는 바이트 수 정수
    """
    pass
```

### 4. 예외 처리 정책

```python
# ✅ 구체적인 예외 타입 사용
def read_config_file(path: Path) -> Dict[str, Any]:
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        raise ConfigFileNotFoundError(f"설정 파일을 찾을 수 없습니다: {path}")
    except json.JSONDecodeError as e:
        raise ConfigParseError(f"설정 파일 파싱 실패: {e}")
    except Exception as e:
        raise ConfigError(f"설정 파일 읽기 실패: {e}")

# ✅ 선택적 예외 처리 (safe 버전 제공)
def safe_get_page_count(file_path: Path) -> Optional[int]:
    """예외를 발생시키지 않는 안전한 페이지 수 확인"""
    try:
        return PDFUtils.get_page_count(file_path)
    except Exception:
        return None
```

## 📚 도메인별 유틸리티 가이드

### 1. PDF 처리 유틸리티 (pdf_utils.py)

```python
class PDFUtils:
    """PDF 처리 관련 공통 기능"""
    
    # ✅ 페이지 관련
    @staticmethod
    def get_page_count(file_path: Path) -> int: pass
    
    # ✅ 검증 관련
    @staticmethod
    def validate_pdf_file_basic(file_path: Path) -> bool: pass
    
    # ✅ 메타데이터 관련
    @staticmethod
    def get_pdf_info(file_path: Path) -> Optional[dict]: pass
    
    # ✅ 성능 관련
    @staticmethod
    def estimate_processing_time(file_path: Path) -> float: pass
```

### 2. 테이블 처리 유틸리티 (table_utils.py)

```python
class TableUtils:
    """테이블 처리 관련 공통 기능"""
    
    # ✅ 테이블 분석
    @staticmethod
    def calculate_empty_cell_ratio(table: List[List[str]]) -> float: pass
    
    # ✅ 테이블 변환
    @staticmethod
    def normalize_table_data(table: List[List[str]]) -> List[List[str]]: pass
    
    # ✅ 테이블 검증
    @staticmethod
    def is_valid_table_structure(table: List[List[str]]) -> bool: pass
```

### 3. 파일 처리 유틸리티 (file_utils.py)

```python
class FileUtils:
    """파일 처리 관련 공통 기능"""
    
    @staticmethod
    def ensure_directory(path: Path) -> None: pass
    
    @staticmethod
    def get_safe_filename(filename: str) -> str: pass
    
    @staticmethod
    def calculate_file_hash(file_path: Path) -> str: pass
```

## 🧪 테스트 정책

### 1. 유틸리티 함수 테스트 필수

```python
# tests/test_utils/test_pdf_utils.py
class TestPDFUtils:
    """PDF 유틸리티 함수 테스트"""
    
    def test_get_page_count_valid_pdf(self):
        """유효한 PDF 파일의 페이지 수 확인"""
        pass
    
    def test_get_page_count_invalid_file(self):
        """잘못된 파일에 대한 예외 처리"""
        pass
    
    def test_validate_pdf_file_basic_success(self):
        """기본 검증 성공 케이스"""
        pass
```

### 2. 테스트 우선순위

1. **고빈도 사용 함수** - 필수 테스트
2. **복잡한 로직 함수** - 엣지 케이스 포함
3. **예외 처리 함수** - 모든 예외 경로 테스트
4. **데이터 변환 함수** - 입출력 검증

## 📖 문서화 규칙

### 1. Docstring 표준

```python
def complex_utility_function(
    input_data: List[Dict[str, Any]], 
    config: Dict[str, Any]
) -> ProcessingResult:
    """
    복잡한 데이터 처리 유틸리티 함수
    
    여러 단계의 데이터 처리를 수행하고 결과를 반환합니다.
    
    Args:
        input_data: 처리할 데이터 목록
            - 각 딕셔너리는 'id', 'value' 키를 포함해야 함
        config: 처리 설정
            - threshold: 임계값 (기본: 0.5)
            - mode: 처리 모드 ('strict' 또는 'loose')
    
    Returns:
        ProcessingResult: 처리 결과
            - processed_count: 처리된 항목 수
            - errors: 발생한 오류 목록
            - results: 처리된 데이터
    
    Raises:
        ValidationError: 입력 데이터가 유효하지 않은 경우
        ProcessingError: 처리 중 오류가 발생한 경우
    
    Example:
        >>> config = {'threshold': 0.7, 'mode': 'strict'}
        >>> data = [{'id': 1, 'value': 0.8}, {'id': 2, 'value': 0.6}]
        >>> result = complex_utility_function(data, config)
        >>> result.processed_count
        2
    """
    pass
```

## 🔄 리팩터링 가이드

### 1. 기존 코드에서 유틸리티 추출

```python
# ❌ 중복 코드 (리팩터링 전)
class ProcessorA:
    def validate_file(self, path):
        if not path.exists(): return False
        if path.suffix != '.pdf': return False
        # ... 추가 검증
        
class ProcessorB:
    def validate_file(self, path):
        if not path.exists(): return False
        if path.suffix != '.pdf': return False
        # ... 동일한 검증

# ✅ 공통 유틸리티로 추출 (리팩터링 후)
class FileUtils:
    @staticmethod
    def validate_basic_pdf(path: Path) -> bool:
        if not path.exists(): return False
        if path.suffix.lower() != '.pdf': return False
        return True

class ProcessorA:
    def validate_file(self, path):
        if not FileUtils.validate_basic_pdf(path):
            return False
        # ... 특화된 검증

class ProcessorB:
    def validate_file(self, path):
        if not FileUtils.validate_basic_pdf(path):
            return False
        # ... 특화된 검증
```

### 2. 점진적 리팩터링 단계

1. **중복 코드 식별** - grep, 정적 분석 도구 활용
2. **공통 기능 추출** - 가장 범용적인 부분부터
3. **유틸리티 함수 작성** - 타입 힌트, 문서화 포함
4. **기존 코드 수정** - 단계적으로 교체
5. **테스트 추가** - 새로운 유틸리티 함수 검증
6. **문서 업데이트** - 사용법 가이드 작성

## 🚨 주의사항

### 1. 과도한 추상화 금지

```python
# ❌ 나쁜 예: 너무 범용적인 유틸리티
def process_anything(data: Any, config: Any) -> Any:
    """모든 것을 처리하는 함수 - 사용하지 말 것"""
    pass

# ✅ 좋은 예: 구체적이고 명확한 목적
def normalize_table_headers(headers: List[str]) -> List[str]:
    """테이블 헤더 정규화"""
    pass
```

### 2. 의존성 최소화

```python
# ❌ 나쁜 예: 무거운 의존성
def pdf_utility_with_ml(path: Path) -> Result:
    import tensorflow as tf  # 너무 무거운 의존성
    pass

# ✅ 좋은 예: 가벼운 표준 라이브러리 활용
def pdf_basic_info(path: Path) -> dict:
    import os
    import mimetypes
    pass
```

---

## 📊 현재 적용 현황

### ✅ 구현 완료된 유틸리티

1. **PDFUtils** (`backend/core/pdf_processor/pdf_utils.py`)
   - `get_page_count()` - PDF 페이지 수 확인
   - `validate_pdf_file_basic()` - 기본 PDF 파일 검증
   - `get_pdf_info()` - PDF 메타데이터 추출
   - `estimate_processing_time()` - 처리 시간 예측

### 🔧 리팩터링 완료된 코드

1. **CamelotProcessor** - PDFUtils 사용으로 중복 제거
2. **TabulaProcessor** - PDFUtils 사용으로 중복 제거  
3. **PDFPlumberProcessor** - PDFUtils 사용으로 중복 제거

### 📈 개선 효과

- **코드 중복 제거**: 약 60줄의 중복 코드 제거
- **유지보수성 향상**: 단일 책임 원칙 적용
- **테스트 용이성**: 독립적인 유틸리티 함수 테스트 가능
- **확장성 개선**: 새로운 PDF 처리기 추가 시 공통 기능 재사용

---

이 정책을 통해 코드의 재사용성을 높이고 유지보수 비용을 절감할 수 있습니다.

---

## 🎯 프론트엔드 커스텀 훅 정책 (2024.01.25 업데이트)

### 📋 개요
React 프론트엔드에서 커스텀 훅의 작성, 구성, 재사용에 대한 정책을 정의합니다.
상태 로직의 재사용성을 높이고 컴포넌트의 복잡성을 줄이기 위한 표준을 제시합니다.

### 🎯 커스텀 훅 정의 기준

#### 1. 커스텀 훅으로 분리해야 하는 경우

##### ✅ **필수 분리 조건**
- **2개 이상의 컴포넌트에서 동일한 상태 로직이 사용되는 경우**
- **50줄 이상의 독립적인 상태 관리 로직**
- **복잡한 상태 업데이트나 사이드 이펙트**
- **API 호출과 상태 관리가 결합된 로직**

##### ✅ **권장 분리 조건**
- **테스트가 필요한 독립적인 상태 로직**
- **재사용 가능성이 높은 비즈니스 로직**
- **복잡한 폼 상태 관리**
- **외부 라이브러리와의 통합 로직**

#### 2. 커스텀 훅 배치 기준

```
frontend/src/
├── shared/hooks/                    # 전역 공통 훅
│   ├── useApi.js                   # API 호출 관련 훅
│   ├── useLocalStorage.js          # 로컬 스토리지 훅
│   ├── useDebounce.js              # 디바운스 훅
│   └── useNotification.js          # 알림 관련 훅
├── features/                       # 기능별 훅
│   ├── data_extraction/
│   │   └── hooks/
│   │       ├── useAnalysis.js      # 분석 관련 훅
│   │       ├── useFileManagement.js # 파일 관리 훅
│   │       └── useCellMapping.js   # 셀 매핑 훅
│   └── template_management/
│       └── hooks/
│           ├── useTemplateManagement.js # 템플릿 관리 훅
│           └── useQuickTest.js     # 빠른 테스트 훅
└── pages/                          # 페이지별 훅
    ├── DataExtractionPage.js       # 페이지 컴포넌트
    └── ExtractionTestPage.js       # 페이지 컴포넌트
```

### 🔧 커스텀 훅 작성 규칙

#### 1. 훅 네이밍 규칙

```javascript
// ✅ use 접두사 + 기능명 (camelCase)
export const useTemplateManagement = () => { /* ... */ };
export const useCellMapping = () => { /* ... */ };
export const useQuickTest = () => { /* ... */ };

// ✅ 매개변수는 객체로 받기
export const useCellMapping = ({ showSuccess, showError, showInfo }) => {
  // 훅 로직
};

// ✅ 반환값은 객체로 제공
return {
  // 상태
  anchorCell,
  valueCell,
  keyMappings,
  // 함수
  handleCellClick,
  handleSaveMapping,
  handleDeleteMapping
};
```

#### 2. 상태 관리 패턴

```javascript
// ✅ useState로 로컬 상태 관리
export const useTemplateManagement = ({ showSuccess, showError, showInfo }) => {
  // 기본 상태
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateMode, setTemplateMode] = useState('new');
  
  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);
  
  // 에러 상태
  const [error, setError] = useState(null);
  
  return {
    savedTemplates,
    selectedTemplate,
    templateMode,
    isLoading,
    error,
    // ... 함수들
  };
};
```

#### 3. 사이드 이펙트 관리

```javascript
// ✅ useEffect로 사이드 이펙트 관리
export const useTemplateManagement = ({ showSuccess, showError, showInfo }) => {
  const [savedTemplates, setSavedTemplates] = useState([]);
  
  // 컴포넌트 마운트 시 템플릿 로드
  useEffect(() => {
    loadTemplates();
  }, []);
  
  // 템플릿 변경 시 자동 저장
  useEffect(() => {
    if (selectedTemplate) {
      saveTemplateToStorage(selectedTemplate);
    }
  }, [selectedTemplate]);
  
  const loadTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const templates = await templateApiService.getTemplates();
      setSavedTemplates(templates);
    } catch (error) {
      setError(error.message);
      showError('템플릿 로드 실패');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);
  
  return { savedTemplates, loadTemplates, isLoading, error };
};
```

#### 4. 이벤트 핸들러 패턴

```javascript
// ✅ useCallback으로 함수 메모이제이션
export const useCellMapping = ({ showSuccess, showError, showInfo }) => {
  const [anchorCell, setAnchorCell] = useState(null);
  const [valueCell, setValueCell] = useState(null);
  
  // 셀 클릭 핸들러
  const handleCellClick = useCallback((rowIndex, colIndex, cellValue, tableData) => {
    if (!anchorCell) {
      // 앵커 설정
      setAnchorCell({ row: rowIndex, col: colIndex, content: cellValue });
      showInfo(`앵커 설정: "${cellValue}" (${rowIndex}, ${colIndex})`);
    } else {
      // 값 설정
      setValueCell({ row: rowIndex, col: colIndex, content: cellValue });
      const rowDiff = rowIndex - anchorCell.row;
      const colDiff = colIndex - anchorCell.col;
      showSuccess(`값 설정: "${cellValue}" - 상대위치: (${rowDiff}, ${colDiff})`);
    }
  }, [anchorCell, showInfo, showSuccess]);
  
  // 앵커/값 리셋 핸들러
  const handleAnchorValueReset = useCallback(() => {
    setAnchorCell(null);
    setValueCell(null);
    showInfo('앵커/값 설정이 초기화되었습니다');
  }, [showInfo]);
  
  return {
    anchorCell,
    valueCell,
    handleCellClick,
    handleAnchorValueReset
  };
};
```

### 📚 도메인별 훅 가이드

#### 1. 데이터 관리 훅 (useTemplateManagement)

```javascript
// ✅ 템플릿 관리 로직 (527줄)
export const useTemplateManagement = ({ showSuccess, showError, showInfo }) => {
  // 상태 관리
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateMode, setTemplateMode] = useState('new');
  
  // API 호출 함수
  const loadTemplates = useCallback(async () => {
    try {
      const templates = await templateApiService.getTemplates();
      setSavedTemplates(templates);
    } catch (error) {
      showError('템플릿 로드 실패');
    }
  }, [showError]);
  
  const handleSaveTemplate = useCallback(async (templateData) => {
    try {
      const savedTemplate = await templateApiService.saveTemplate(templateData);
      setSavedTemplates(prev => [...prev, savedTemplate]);
      showSuccess('템플릿이 저장되었습니다');
    } catch (error) {
      showError('템플릿 저장 실패');
    }
  }, [showSuccess, showError]);
  
  return {
    savedTemplates,
    selectedTemplate,
    templateMode,
    loadTemplates,
    handleSaveTemplate
  };
};
```

#### 2. UI 상태 관리 훅 (useCellMapping)

```javascript
// ✅ 셀 매핑 로직 (306줄)
export const useCellMapping = ({ showSuccess, showError, showInfo }) => {
  // 상태 관리
  const [anchorCell, setAnchorCell] = useState(null);
  const [valueCell, setValueCell] = useState(null);
  const [keyMappings, setKeyMappings] = useState([]);
  
  // 상태 변경 감지
  useEffect(() => {
    if (anchorCell && valueCell) {
      const rowDiff = valueCell.row - anchorCell.row;
      const colDiff = valueCell.col - anchorCell.col;
      setRelativePosition({ row: rowDiff, col: colDiff });
    }
  }, [anchorCell, valueCell]);
  
  // 매핑 저장
  const handleSaveMapping = useCallback((mappingData) => {
    const newMapping = {
      id: Date.now().toString(),
      ...mappingData,
      createdAt: new Date().toISOString()
    };
    setKeyMappings(prev => [...prev, newMapping]);
    showSuccess('매핑이 저장되었습니다');
  }, [showSuccess]);
  
  return {
    anchorCell,
    valueCell,
    keyMappings,
    handleCellClick,
    handleSaveMapping
  };
};
```

#### 3. API 통신 훅 (useQuickTest)

```javascript
// ✅ 빠른 테스트 로직 (93줄)
export const useQuickTest = ({ showSuccess, showError }) => {
  const [quickTestResults, setQuickTestResults] = useState(null);
  const [isQuickTestLoading, setIsQuickTestLoading] = useState(false);
  
  const executeQuickTest = useCallback(async (testData) => {
    try {
      setIsQuickTestLoading(true);
      const results = await quickTestApiService.executeTest(testData);
      setQuickTestResults(results);
      showSuccess('빠른 테스트가 완료되었습니다');
    } catch (error) {
      showError('빠른 테스트 실행 실패');
    } finally {
      setIsQuickTestLoading(false);
    }
  }, [showSuccess, showError]);
  
  return {
    quickTestResults,
    isQuickTestLoading,
    executeQuickTest
  };
};
```

### 🧪 훅 테스트 정책

#### 1. 훅 테스트 필수

```javascript
// tests/hooks/useTemplateManagement.test.js
import { renderHook, act } from '@testing-library/react-hooks';
import { useTemplateManagement } from '../shared/hooks/useTemplateManagement';

describe('useTemplateManagement', () => {
  it('should load templates on mount', async () => {
    const { result } = renderHook(() => useTemplateManagement({
      showSuccess: jest.fn(),
      showError: jest.fn(),
      showInfo: jest.fn()
    }));
    
    await act(async () => {
      await result.current.loadTemplates();
    });
    
    expect(result.current.savedTemplates).toHaveLength(2);
  });
  
  it('should save template successfully', async () => {
    const { result } = renderHook(() => useTemplateManagement({
      showSuccess: jest.fn(),
      showError: jest.fn(),
      showInfo: jest.fn()
    }));
    
    const templateData = { name: 'Test Template', mappings: [] };
    
    await act(async () => {
      await result.current.handleSaveTemplate(templateData);
    });
    
    expect(result.current.savedTemplates).toContainEqual(
      expect.objectContaining({ name: 'Test Template' })
    );
  });
});
```

### 📖 훅 문서화 규칙

#### 1. JSDoc 표준

```javascript
/**
 * 셀 클릭 및 매핑 관리를 위한 커스텀 훅
 * 
 * @param {Object} options - 훅 옵션
 * @param {Function} options.showSuccess - 성공 메시지 표시 함수
 * @param {Function} options.showError - 에러 메시지 표시 함수
 * @param {Function} options.showInfo - 정보 메시지 표시 함수
 * @param {Function} options.setPendingPageValidation - 페이지 검증 대기 상태 설정 함수
 * @param {Function} options.setActivePageTab - 활성 페이지 탭 설정 함수
 * @returns {Object} 훅 반환값
 * @returns {Object|null} returns.anchorCell - 앵커 셀 정보
 * @returns {Object|null} returns.valueCell - 값 셀 정보
 * @returns {Array} returns.keyMappings - 키 매핑 목록
 * @returns {Function} returns.handleCellClick - 셀 클릭 핸들러
 * @returns {Function} returns.handleSaveMapping - 매핑 저장 핸들러
 * 
 * @example
 * ```javascript
 * const {
 *   anchorCell,
 *   valueCell,
 *   keyMappings,
 *   handleCellClick,
 *   handleSaveMapping
 * } = useCellMapping({
 *   showSuccess,
 *   showError,
 *   showInfo,
 *   setPendingPageValidation,
 *   setActivePageTab
 * });
 * ```
 */
export const useCellMapping = ({ showSuccess, showError, showInfo, setPendingPageValidation, setActivePageTab }) => {
  // 훅 구현
};
```

### 🔄 훅 리팩터링 가이드

#### 1. 기존 컴포넌트에서 훅 추출

```javascript
// ❌ 중복 로직 (리팩터링 전)
const ComponentA = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  // ... 컴포넌트 로직
};

const ComponentB = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  // ... 동일한 로직
};

// ✅ 공통 훅으로 추출 (리팩터링 후)
export const useTemplateManagement = ({ showSuccess, showError }) => {
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const templates = await templateApiService.getTemplates();
      setSavedTemplates(templates);
    } catch (error) {
      showError('템플릿 로드 실패');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);
  
  return { savedTemplates, isLoading, loadTemplates };
};

const ComponentA = () => {
  const { savedTemplates, isLoading, loadTemplates } = useTemplateManagement({
    showSuccess,
    showError
  });
  
  // ... 컴포넌트 로직
};

const ComponentB = () => {
  const { savedTemplates, isLoading, loadTemplates } = useTemplateManagement({
    showSuccess,
    showError
  });
  
  // ... 컴포넌트 로직
};
```

### 📊 현재 적용 현황

#### ✅ 구현 완료된 훅

1. **useTemplateManagement** (527줄)
   - 템플릿 저장/로드/삭제 로직
   - API 통신 및 에러 처리
   - 상태 관리 및 사이드 이펙트

2. **useCellMapping** (306줄)
   - 셀 클릭 및 앵커/값 설정
   - 키 매핑 관리
   - 페이지 간 상태 동기화

3. **useQuickTest** (93줄)
   - 빠른 테스트 실행
   - 결과 관리 및 로딩 상태

4. **useAnalysis** (66줄)
   - PDF 분석 관련 로직
   - 분석 상태 관리

5. **useFileManagement**
   - 파일 업로드/관리 로직
   - 파일 상태 관리

#### 📈 개선 효과

- **코드 중복 제거**: 약 1,000줄의 중복 로직 제거
- **재사용성 향상**: 5개 훅으로 다양한 컴포넌트에서 활용
- **테스트 용이성**: 각 훅을 독립적으로 테스트 가능
- **유지보수성**: 단일 책임 원칙 적용으로 수정 범위 최소화

---

이 정책을 통해 React 애플리케이션의 상태 로직을 효과적으로 관리하고 재사용성을 높일 수 있습니다.
