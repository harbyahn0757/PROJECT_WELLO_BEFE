# 파일 및 모듈 조직화 규칙

## 📋 개요
프론트엔드와 백엔드 전체 프로젝트의 파일 구조와 모듈 조직화 규칙을 통합 관리합니다.
일관성 있는 개발 환경과 효율적인 협업을 위한 표준을 제시합니다.

## 🏗️ 전체 프로젝트 구조

```
Ana_test_DocumentAI/
├── frontend/                 # React 프론트엔드
│   ├── public/
│   ├── src/
│   │   ├── shared/          # 공유 컴포넌트/스타일
│   │   │   ├── components/  # 재사용 컴포넌트
│   │   │   │   ├── ui/      # 기본 UI 컴포넌트
│   │   │   │   └── layout/  # 레이아웃 컴포넌트
│   │   │   ├── styles/      # 글로벌 스타일
│   │   │   ├── hooks/       # 커스텀 훅
│   │   │   └── utils/       # 유틸리티 함수
│   │   ├── features/        # 기능별 모듈
│   │   │   ├── file-upload/ # 파일 업로드 기능
│   │   │   ├── table-viewer/ # 테이블 뷰어 기능
│   │   │   └── relationship/ # 관계 설정 기능
│   │   └── App.js
│   ├── package.json
│   └── README.md
├── backend/                  # FastAPI 백엔드
│   ├── app/                 # 메인 애플리케이션
│   ├── api/                 # API 레이어
│   ├── core/                # 핵심 비즈니스 로직
│   ├── models/              # 데이터 모델
│   ├── services/            # 서비스 레이어
│   ├── utils/               # 유틸리티
│   ├── tests/               # 테스트 코드
│   ├── requirements.txt
│   └── README.md
├── documents/               # 프로젝트 문서
│   ├── README.md           # 문서 인덱스
│   ├── 01_project_overview.md
│   ├── 02_design_guidelines.md
│   └── ...
├── _backup_old_code/       # 백업 코드
├── samples/                # 샘플 파일
├── .gitignore
├── README.md              # 프로젝트 메인 README
└── requirements.txt       # 공통 의존성
```

## 📁 프론트엔드 폴더링 규칙

### 1. 기본 구조 원칙
```
frontend/src/
├── shared/                 # 공유 리소스 (재사용 가능)
│   ├── components/        # 재사용 컴포넌트
│   │   ├── ui/           # 기본 UI 컴포넌트 (Button, Input 등)
│   │   └── layout/       # 레이아웃 컴포넌트 (Header, Layout 등)
│   ├── styles/           # 글로벌 스타일
│   │   ├── globals.css
│   │   └── design-tokens.css
│   ├── hooks/            # 커스텀 훅
│   │   ├── useApi.js
│   │   └── useLocalStorage.js
│   ├── utils/            # 유틸리티 함수
│   │   ├── api.js
│   │   └── validation.js
│   └── constants/        # 상수 정의
│       ├── api.js
│       └── app.js
├── features/             # 기능별 모듈 (도메인 기반)
│   ├── file-upload/     # 파일 업로드 기능
│   │   ├── components/  # 기능 전용 컴포넌트
│   │   ├── hooks/       # 기능 전용 훅
│   │   ├── services/    # API 호출 로직
│   │   └── types/       # 타입 정의
│   ├── table-viewer/    # 테이블 뷰어 기능
│   └── relationship/    # 관계 설정 기능
├── assets/              # 정적 자원
│   ├── images/
│   ├── icons/
│   └── fonts/
└── App.js              # 루트 컴포넌트
```

### 2. 컴포넌트 명명 규칙
```javascript
// ✅ 컴포넌트 파일: PascalCase
Button.js
FileUploadForm.js
TableDataViewer.js

// ✅ 훅 파일: camelCase (use 접두사)
useFileUpload.js
useTableData.js

// ✅ 유틸리티 파일: camelCase
apiClient.js
fileValidator.js

// ✅ 상수 파일: camelCase
apiEndpoints.js
appConfig.js
```

### 3. Import/Export 규칙
```javascript
// ✅ Named Export 우선 (컴포넌트는 Default Export)
// Button.js
export default function Button() { ... }

// utils/validation.js
export const validateEmail = (email) => { ... }
export const validateFile = (file) => { ... }

// constants/api.js
export const API_BASE_URL = 'http://localhost:8000'
export const ENDPOINTS = {
  files: '/api/v1/files',
  tables: '/api/v1/tables'
}

// index.js에서 재수출
// shared/components/ui/index.js
export { default as Button } from './Button'
export { default as Input } from './Input'
export { default as Card } from './Card'
```

## 🐍 백엔드 폴더링 규칙

### 1. 계층형 아키텍처
```
backend/
├── app/                    # 애플리케이션 설정
│   ├── __init__.py
│   ├── main.py            # FastAPI 앱 엔트리포인트
│   ├── config.py          # 설정 관리
│   └── dependencies.py    # 의존성 주입
├── api/                   # API 계층
│   ├── v1/               # API 버전 관리
│   │   ├── endpoints/    # 엔드포인트별 라우터
│   │   │   ├── files.py
│   │   │   ├── tables.py
│   │   │   └── relationships.py
│   │   └── router.py     # 라우터 통합
├── core/                 # 도메인/비즈니스 로직
│   ├── pdf_processor/    # PDF 처리 도메인
│   │   ├── __init__.py
│   │   ├── base.py      # 추상 클래스
│   │   ├── pdfplumber_processor.py
│   │   ├── camelot_processor.py
│   │   └── tabula_processor.py
│   ├── table_extractor/  # 테이블 추출 도메인
│   └── relationship_manager/ # 관계 관리 도메인
├── models/               # 데이터 모델 (Pydantic)
│   ├── __init__.py
│   ├── file_models.py
│   ├── table_models.py
│   └── relationship_models.py
├── services/             # 애플리케이션 서비스
│   ├── __init__.py
│   ├── file_service.py
│   ├── extraction_service.py
│   └── relationship_service.py
├── utils/                # 공통 유틸리티
│   ├── __init__.py
│   ├── file_utils.py
│   ├── validation.py
│   └── logging_config.py
└── tests/                # 테스트 코드
    ├── test_api/
    ├── test_core/
    └── test_services/
```

### 2. 파이썬 모듈 명명 규칙
```python
# 📁 패키지/모듈: snake_case
pdf_processor/
table_extractor/
relationship_manager/

# 📄 파일명: snake_case + 용도
file_service.py
extraction_service.py
table_models.py

# 🏷️ 클래스명: PascalCase
class PDFProcessor:
class TableExtractor:
class FileUploadModel:

# 🔧 함수명: snake_case
def extract_tables():
def process_pdf():
def validate_file():

# 🔢 상수명: UPPER_SNAKE_CASE
MAX_FILE_SIZE = 10485760
SUPPORTED_EXTENSIONS = ['.pdf']
```

### 3. 모듈 내부 구조
```python
# 파일 구조 예시: core/pdf_processor/base.py
from abc import ABC, abstractmethod
from typing import List, Optional
from models.table_models import TableData

class PDFProcessorInterface(ABC):
    """PDF 처리기 인터페이스"""
    
    @abstractmethod
    def extract_tables(self, file_path: str) -> List[TableData]:
        """테이블 추출 추상 메서드"""
        pass
    
    @abstractmethod
    def validate_file(self, file_path: str) -> bool:
        """파일 유효성 검증"""
        pass
```

## 📄 파일 조직화 원칙

### 1. 단일 책임 원칙
```python
# ❌ 여러 책임을 가진 파일
# file_handler.py (안 좋은 예)
class FileHandler:
    def upload_file(self): pass
    def extract_tables(self): pass
    def save_to_database(self): pass
    def send_email(self): pass

# ✅ 단일 책임을 가진 파일들
# file_upload_service.py
class FileUploadService:
    def upload_file(self): pass

# table_extraction_service.py  
class TableExtractionService:
    def extract_tables(self): pass

# database_service.py
class DatabaseService:
    def save_data(self): pass
```

### 2. 기능별 그룹화
```
# 기능별 폴더 구조
features/file-upload/
├── components/
│   ├── FileUploadForm.js    # 업로드 폼
│   ├── FileList.js          # 파일 목록
│   └── ProgressIndicator.js # 진행률 표시
├── hooks/
│   ├── useFileUpload.js     # 업로드 로직
│   └── useFileValidation.js # 검증 로직
├── services/
│   └── fileUploadApi.js     # API 호출
└── types/
    └── fileTypes.js         # 타입 정의
```

### 3. 의존성 방향 규칙
```
High Level (상위 계층)
    ↓
API Layer (api/)
    ↓
Service Layer (services/)
    ↓
Core/Domain Layer (core/)
    ↓
Models Layer (models/)
    ↓
Utils Layer (utils/)
    ↓
Low Level (하위 계층)
```

## 🔄 모듈 인터페이스 설계

### 1. 프론트엔드 모듈 인터페이스
```javascript
// features/file-upload/index.js
export { default as FileUploadForm } from './components/FileUploadForm'
export { default as FileList } from './components/FileList'
export { useFileUpload } from './hooks/useFileUpload'
export { fileUploadApi } from './services/fileUploadApi'

// 사용 시
import { FileUploadForm, useFileUpload } from '../features/file-upload'
```

### 2. 백엔드 모듈 인터페이스
```python
# core/pdf_processor/__init__.py
from .base import PDFProcessorInterface
from .pdfplumber_processor import PDFPlumberProcessor
from .camelot_processor import CamelotProcessor
from .tabula_processor import TabulaProcessor
from .factory import PDFProcessorFactory

__all__ = [
    'PDFProcessorInterface',
    'PDFPlumberProcessor', 
    'CamelotProcessor',
    'TabulaProcessor',
    'PDFProcessorFactory'
]

# 사용 시
from core.pdf_processor import PDFProcessorFactory
```

## 📋 파일 템플릿

### 1. React 컴포넌트 템플릿
```javascript
// components/ExampleComponent.js
import React from 'react'
import PropTypes from 'prop-types'
import './ExampleComponent.css'

/**
 * 예시 컴포넌트
 * @param {Object} props - 컴포넌트 props
 * @param {string} props.title - 제목
 * @param {Function} props.onClick - 클릭 핸들러
 */
const ExampleComponent = ({ title, onClick }) => {
  return (
    <div className="example-component">
      <h3>{title}</h3>
      <button onClick={onClick}>클릭</button>
    </div>
  )
}

ExampleComponent.propTypes = {
  title: PropTypes.string.isRequired,
  onClick: PropTypes.func
}

ExampleComponent.defaultProps = {
  onClick: () => {}
}

export default ExampleComponent
```

### 2. Python 클래스 템플릿
```python
# services/example_service.py
"""
예시 서비스 모듈

이 모듈은 예시 비즈니스 로직을 처리합니다.
"""

import logging
from typing import List, Optional
from models.example_models import ExampleModel

logger = logging.getLogger(__name__)

class ExampleService:
    """예시 서비스 클래스
    
    비즈니스 로직을 처리하는 서비스 클래스입니다.
    
    Attributes:
        config: 서비스 설정
        
    Example:
        >>> service = ExampleService(config)
        >>> result = service.process_data(data)
    """
    
    def __init__(self, config: dict):
        """서비스 초기화
        
        Args:
            config: 서비스 설정 딕셔너리
        """
        self.config = config
        logger.info("ExampleService 초기화 완료")
    
    def process_data(self, data: List[dict]) -> List[ExampleModel]:
        """데이터 처리
        
        Args:
            data: 처리할 데이터 목록
            
        Returns:
            처리된 ExampleModel 목록
            
        Raises:
            ValueError: 잘못된 데이터 형식일 때
        """
        try:
            logger.info(f"데이터 처리 시작: {len(data)}개 항목")
            
            results = []
            for item in data:
                processed = self._process_item(item)
                results.append(processed)
            
            logger.info(f"데이터 처리 완료: {len(results)}개 결과")
            return results
            
        except Exception as e:
            logger.error(f"데이터 처리 실패: {e}")
            raise
    
    def _process_item(self, item: dict) -> ExampleModel:
        """개별 항목 처리 (내부 메서드)"""
        # 구현 로직
        pass
```

## 🚀 모듈 생성 자동화

### 1. 컴포넌트 생성 스크립트
```bash
#!/bin/bash
# scripts/create-component.sh

COMPONENT_NAME=$1
FEATURE_PATH=$2

if [ -z "$COMPONENT_NAME" ] || [ -z "$FEATURE_PATH" ]; then
    echo "Usage: ./create-component.sh ComponentName features/feature-name"
    exit 1
fi

# 컴포넌트 폴더 생성
mkdir -p "frontend/src/$FEATURE_PATH/components"

# 컴포넌트 파일 생성
cat > "frontend/src/$FEATURE_PATH/components/$COMPONENT_NAME.js" << EOF
import React from 'react'
import './$COMPONENT_NAME.css'

const $COMPONENT_NAME = () => {
  return (
    <div className="${COMPONENT_NAME,,}">
      <h3>$COMPONENT_NAME</h3>
    </div>
  )
}

export default $COMPONENT_NAME
EOF

# CSS 파일 생성
cat > "frontend/src/$FEATURE_PATH/components/$COMPONENT_NAME.css" << EOF
.${COMPONENT_NAME,,} {
  /* 스타일 작성 */
}
EOF

echo "컴포넌트 $COMPONENT_NAME 생성 완료: $FEATURE_PATH/components/"
```

### 2. 서비스 생성 스크립트
```bash
#!/bin/bash
# scripts/create-service.sh

SERVICE_NAME=$1

if [ -z "$SERVICE_NAME" ]; then
    echo "Usage: ./create-service.sh service_name"
    exit 1
fi

cat > "backend/services/${SERVICE_NAME}_service.py" << EOF
"""
${SERVICE_NAME^} 서비스 모듈
"""

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

class ${SERVICE_NAME^}Service:
    """${SERVICE_NAME^} 서비스"""
    
    def __init__(self):
        logger.info("${SERVICE_NAME^}Service 초기화")
    
    # 서비스 메서드 구현
    pass
EOF

echo "서비스 ${SERVICE_NAME}_service.py 생성 완료"
```

## 📏 코드 품질 관리

### 1. 파일 크기 제한
- **단일 파일**: 최대 500줄
- **컴포넌트**: 최대 200줄
- **함수**: 최대 50줄
- **클래스**: 최대 300줄

### 2. 복잡도 관리
- **Cyclomatic Complexity**: 최대 10
- **함수 매개변수**: 최대 5개
- **중첩 깊이**: 최대 4단계

### 3. 의존성 관리
```javascript
// ✅ 순환 의존성 방지
// A.js -> B.js -> C.js (OK)
// A.js -> B.js -> A.js (NG)

// ✅ 계층 간 의존성 준수
// components -> hooks (OK)
// hooks -> components (NG)
```

## 📝 문서화 규칙

### 1. README 구조
```markdown
# 모듈명

## 개요
모듈의 목적과 기능 설명

## 설치
설치 방법 및 의존성

## 사용법
기본 사용 예시

## API 문서
주요 함수/클래스 문서

## 예시
실제 사용 예시 코드

## 기여
기여 방법 안내
```

### 2. 변경 로그
```markdown
# CHANGELOG

## [1.2.0] - 2024-01-24
### Added
- 새로운 기능 추가

### Changed  
- 기존 기능 변경

### Fixed
- 버그 수정

### Removed
- 제거된 기능
```

---

## 📊 요약

### 핵심 원칙
1. **일관성**: 명명 규칙과 구조 표준화
2. **모듈화**: 단일 책임과 느슨한 결합
3. **확장성**: 새로운 기능 추가가 용이한 구조
4. **가독성**: 직관적인 폴더/파일 구조
5. **유지보수성**: 변경과 테스트가 쉬운 구조

### 폴더 구조 요약
- **Frontend**: shared(공통) + features(기능별) 분리
- **Backend**: 계층형 아키텍처 (api/service/core/models)
- **Documents**: 체계적인 문서 관리

이 규칙을 준수하여 일관성 있고 확장 가능한 코드베이스를 유지합니다.
