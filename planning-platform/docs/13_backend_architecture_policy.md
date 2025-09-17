# 백엔드 아키텍처 및 코딩 정책

## 📋 개요
건강검진 데이터 추출 시스템의 백엔드 아키텍처, 폴더 구조, 파이썬 코딩 표준을 정의합니다.
FastAPI 기반의 모듈화된 구조로 확장성과 유지보수성을 보장합니다.

## 🏗️ 백엔드 아키텍처

### 기본 구조
```
backend/
├── app/                      # 메인 애플리케이션
│   ├── __init__.py
│   ├── main.py              # FastAPI 앱 엔트리포인트
│   ├── config.py            # 설정 관리
│   └── dependencies.py      # 의존성 주입
├── api/                     # API 레이어
│   ├── __init__.py
│   ├── v1/                  # API 버전 관리
│   │   ├── __init__.py
│   │   ├── endpoints/       # 엔드포인트 정의
│   │   │   ├── __init__.py
│   │   │   ├── files.py     # 파일 관련 API
│   │   │   ├── tables.py    # 테이블 추출 API
│   │   │   └── relationships.py # 관계 설정 API
│   │   └── router.py        # 라우터 통합
├── core/                    # 핵심 비즈니스 로직
│   ├── __init__.py
│   ├── pdf_processor/       # PDF 처리 엔진
│   │   ├── __init__.py
│   │   ├── base.py         # 추상 클래스
│   │   ├── pdf_utils.py    # PDF 처리 공통 유틸리티
│   │   ├── pdfplumber_processor.py
│   │   ├── camelot_processor.py
│   │   └── tabula_processor.py
│   ├── table_extractor/     # 테이블 추출 로직
│   │   ├── __init__.py
│   │   ├── extractor.py    # 메인 추출기
│   │   └── analyzer.py     # 테이블 분석기
│   └── relationship_manager/ # 관계 설정 관리
│       ├── __init__.py
│       ├── manager.py      # 관계 관리자
│       └── matcher.py      # 패턴 매칭
├── models/                  # 데이터 모델
│   ├── __init__.py
│   ├── file_models.py      # 파일 관련 모델
│   ├── table_models.py     # 테이블 모델
│   └── relationship_models.py # 관계 모델
├── services/                # 서비스 레이어
│   ├── __init__.py
│   ├── file_service.py     # 파일 관리 서비스
│   ├── extraction_service.py # 추출 서비스
│   └── relationship_service.py # 관계 관리 서비스
├── utils/                   # 전역 공통 유틸리티
│   ├── __init__.py
│   ├── file_utils.py       # 파일 처리 공통 함수
│   ├── validation.py       # 검증 관련 공통 함수
│   ├── date_utils.py       # 날짜/시간 관련 함수
│   ├── string_utils.py     # 문자열 처리 함수
│   └── logging_config.py   # 로깅 설정
├── storage/                 # 저장소 관리
│   ├── __init__.py
│   ├── file_storage.py     # 파일 저장소
│   └── cache_manager.py    # 캐시 관리
├── tests/                   # 테스트 코드
│   ├── __init__.py
│   ├── test_api/           # API 테스트
│   ├── test_core/          # 핵심 로직 테스트
│   └── test_services/      # 서비스 테스트
├── scripts/                 # 유틸리티 스크립트
│   ├── setup_dev.py        # 개발 환경 설정
│   └── data_migration.py   # 데이터 마이그레이션
├── requirements.txt         # 의존성 목록
├── requirements-dev.txt     # 개발 의존성
├── pyproject.toml          # 프로젝트 설정
└── README.md               # 백엔드 README
```

## 📁 폴더링 정책

### 1. 계층별 분리 원칙
- **API 레이어**: HTTP 요청/응답 처리
- **Service 레이어**: 비즈니스 로직 조합
- **Core 레이어**: 핵심 도메인 로직
- **Models 레이어**: 데이터 구조 정의
- **Utils 레이어**: 공통 유틸리티

### 2. 유틸리티 함수 분류 기준
- **도메인별 유틸리티**: `core/{domain}/{domain}_utils.py`
- **전역 공통 유틸리티**: `utils/{category}_utils.py`
- **재사용 가능한 함수**: 2개 이상 모듈에서 사용되는 로직
- **DRY 원칙 준수**: 중복 코드 제거 및 공통화

### 3. 모듈 명명 규칙
```python
# 📁 폴더명: snake_case
pdf_processor/
table_extractor/

# 📄 파일명: snake_case
file_service.py
extraction_service.py

# 🏷️ 클래스명: PascalCase
class PDFProcessor:
class TableExtractor:

# 🔧 함수명: snake_case
def extract_tables():
def process_pdf():

# 🔢 상수명: UPPER_SNAKE_CASE
MAX_FILE_SIZE = 10485760
SUPPORTED_EXTENSIONS = ['.pdf']
```

### 3. Import 순서 정책
```python
# 1. 표준 라이브러리
import os
import sys
from typing import List, Optional

# 2. 서드파티 라이브러리
from fastapi import FastAPI, HTTPException
import pandas as pd

# 3. 로컬 앱 임포트
from app.config import settings
from core.pdf_processor import PDFProcessor
from models.table_models import TableData
```

## 🐍 파이썬 코딩 표준

### 1. 코드 스타일
```python
# ✅ 권장: Type Hints 사용
def extract_tables(file_path: str, library: str) -> List[TableData]:
    """PDF에서 테이블을 추출합니다."""
    pass

# ✅ 권장: Docstring 작성 (Google 스타일)
class PDFProcessor:
    """PDF 파일을 처리하는 기본 클래스.
    
    Args:
        file_path: PDF 파일 경로
        extraction_method: 추출 방법 ('pdfplumber', 'camelot', 'tabula')
        
    Raises:
        FileNotFoundError: 파일이 존재하지 않을 때
        ProcessingError: 처리 중 오류 발생 시
    """
    pass

# ✅ 권장: 예외 처리
try:
    result = process_pdf(file_path)
except ProcessingError as e:
    logger.error(f"PDF 처리 실패: {e}")
    raise HTTPException(status_code=500, detail=str(e))
```

### 2. 에러 핸들링
```python
# custom_exceptions.py
class PDFProcessingError(Exception):
    """PDF 처리 관련 예외"""
    pass

class TableExtractionError(Exception):
    """테이블 추출 관련 예외"""
    pass

class ValidationError(Exception):
    """검증 관련 예외"""
    pass

# 사용 예시
def extract_tables(file_path: str) -> List[TableData]:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"파일을 찾을 수 없음: {file_path}")
    
    try:
        return processor.extract(file_path)
    except Exception as e:
        raise TableExtractionError(f"테이블 추출 실패: {e}") from e
```

### 3. 설정 관리
```python
# config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """애플리케이션 설정"""
    
    # 서버 설정
    host: str = "localhost"
    port: int = 8000
    debug: bool = False
    
    # 파일 설정
    upload_dir: str = "uploads"
    max_file_size: int = 100 * 1024 * 1024  # 100MB
    allowed_extensions: list[str] = [".pdf"]
    
    # 캐시 설정
    cache_dir: str = "cache"
    cache_ttl: int = 3600  # 1시간
    
    class Config:
        env_file = ".env"

settings = Settings()
```

### 4. 로깅 표준
```python
# logging_config.py
import logging
from app.config import settings

def setup_logging():
    """로깅 설정 초기화"""
    
    logging.basicConfig(
        level=logging.DEBUG if settings.debug else logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.FileHandler("logs/app.log"),
            logging.StreamHandler()
        ]
    )

# 사용 예시
logger = logging.getLogger(__name__)

def process_file(file_path: str):
    logger.info(f"파일 처리 시작: {file_path}")
    try:
        result = do_processing(file_path)
        logger.info(f"파일 처리 완료: {len(result)} 테이블 추출")
        return result
    except Exception as e:
        logger.error(f"파일 처리 실패: {e}", exc_info=True)
        raise
```

## 🔧 모듈화 원칙

### 1. 단일 책임 원칙
```python
# ❌ 나쁜 예: 여러 책임을 가진 클래스
class PDFHandler:
    def extract_tables(self): pass
    def save_to_database(self): pass
    def send_email(self): pass

# ✅ 좋은 예: 단일 책임
class PDFProcessor:
    def extract_tables(self): pass

class DatabaseService:
    def save_data(self): pass

class EmailService:
    def send_notification(self): pass
```

### 2. 의존성 주입
```python
# dependencies.py
from abc import ABC, abstractmethod

class PDFProcessorInterface(ABC):
    @abstractmethod
    def extract_tables(self, file_path: str) -> List[TableData]:
        pass

# 구현체
class PDFPlumberProcessor(PDFProcessorInterface):
    def extract_tables(self, file_path: str) -> List[TableData]:
        # pdfplumber 구현
        pass

# 서비스에서 사용
class ExtractionService:
    def __init__(self, processor: PDFProcessorInterface):
        self.processor = processor
    
    def process_file(self, file_path: str) -> List[TableData]:
        return self.processor.extract_tables(file_path)
```

### 3. 팩토리 패턴
```python
# pdf_processor_factory.py
class PDFProcessorFactory:
    """PDF 처리기 팩토리"""
    
    @staticmethod
    def create_processor(library: str) -> PDFProcessorInterface:
        processors = {
            'pdfplumber': PDFPlumberProcessor,
            'camelot': CamelotProcessor,
            'tabula': TabulaProcessor
        }
        
        if library not in processors:
            raise ValueError(f"지원하지 않는 라이브러리: {library}")
        
        return processors[library]()
```

## 📦 패키지 관리

### 1. requirements.txt 구조
```txt
# Core dependencies
fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0

# PDF processing
pdfplumber==0.10.3
camelot-py[cv]==0.11.0
tabula-py==2.8.2

# Data processing
pandas==2.1.4
numpy==1.26.2

# Utilities
python-multipart==0.0.6
aiofiles==23.2.1
```

### 2. 개발 의존성 분리
```txt
# requirements-dev.txt
pytest==7.4.3
pytest-asyncio==0.21.1
black==23.11.0
flake8==6.1.0
mypy==1.7.1
pre-commit==3.6.0
```

### 3. 버전 관리 정책
- **메이저 버전**: 호환성 깨지는 변경
- **마이너 버전**: 기능 추가
- **패치 버전**: 버그 수정
- **고정 버전 사용**: 재현 가능한 빌드

## 🧪 테스트 전략

### 1. 테스트 구조
```python
# test_extraction_service.py
import pytest
from unittest.mock import Mock, patch
from services.extraction_service import ExtractionService

class TestExtractionService:
    """추출 서비스 테스트"""
    
    @pytest.fixture
    def mock_processor(self):
        return Mock()
    
    @pytest.fixture
    def service(self, mock_processor):
        return ExtractionService(mock_processor)
    
    def test_extract_tables_success(self, service, mock_processor):
        # Given
        file_path = "test.pdf"
        expected_tables = [TableData(...)]
        mock_processor.extract_tables.return_value = expected_tables
        
        # When
        result = service.process_file(file_path)
        
        # Then
        assert result == expected_tables
        mock_processor.extract_tables.assert_called_once_with(file_path)
```

### 2. 테스트 카테고리
- **Unit Tests**: 개별 함수/클래스 테스트
- **Integration Tests**: 모듈 간 연동 테스트
- **API Tests**: 엔드포인트 테스트
- **E2E Tests**: 전체 워크플로 테스트

## 🚀 성능 최적화

### 1. 비동기 처리
```python
# 파일 처리 비동기화
import asyncio
from concurrent.futures import ThreadPoolExecutor

class AsyncExtractionService:
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=4)
    
    async def process_multiple_files(self, file_paths: List[str]) -> List[TableData]:
        """여러 파일을 병렬로 처리"""
        loop = asyncio.get_event_loop()
        tasks = [
            loop.run_in_executor(self.executor, self.process_file, path)
            for path in file_paths
        ]
        return await asyncio.gather(*tasks)
```

### 2. 캐싱 전략
```python
# cache_manager.py
import hashlib
import pickle
from pathlib import Path

class CacheManager:
    """파일 처리 결과 캐싱"""
    
    def __init__(self, cache_dir: str = "cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
    
    def get_cache_key(self, file_path: str, library: str) -> str:
        """캐시 키 생성"""
        content = f"{file_path}:{library}:{os.path.getmtime(file_path)}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def get(self, cache_key: str) -> Optional[Any]:
        cache_file = self.cache_dir / f"{cache_key}.pkl"
        if cache_file.exists():
            with open(cache_file, 'rb') as f:
                return pickle.load(f)
        return None
    
    def set(self, cache_key: str, data: Any) -> None:
        cache_file = self.cache_dir / f"{cache_key}.pkl"
        with open(cache_file, 'wb') as f:
            pickle.dump(data, f)
```

## 📝 코드 품질 관리

### 1. pre-commit 설정
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/psf/black
    rev: 23.11.0
    hooks:
      - id: black
  
  - repo: https://github.com/PyCQA/flake8
    rev: 6.1.0
    hooks:
      - id: flake8
  
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.7.1
    hooks:
      - id: mypy
```

### 2. 코드 품질 체크리스트
- [x] Type hints 작성
- [x] Docstring 작성 (Google 스타일)
- [ ] 단위 테스트 작성
- [x] 에러 핸들링 구현
- [x] 로깅 추가 (표준화된 포맷)
- [x] Black 포맷팅 적용
- [x] Flake8 린트 통과
- [x] MyPy 타입 체크 통과 (경미한 외부 라이브러리 이슈 제외)

### 3. 개선 완료 항목 (2025.01.23)
- [x] **매직 넘버 제거**: config.py에 모든 상수 중앙화
- [x] **로깅 표준화**: logging_constants.py로 메시지 포맷 통일
- [x] **중복 코드 제거**: extraction_helpers.py로 빌더 패턴 구현
- [x] **Docstring 표준화**: Google 스타일로 통일

## 🔒 보안 가이드라인

### 1. 파일 업로드 보안
```python
def validate_file(file: UploadFile) -> None:
    """파일 검증"""
    
    # 확장자 검증
    if not file.filename.lower().endswith('.pdf'):
        raise ValidationError("PDF 파일만 업로드 가능합니다")
    
    # 파일 크기 검증
    if file.size > settings.max_file_size:
        raise ValidationError("파일 크기가 너무 큽니다")
    
    # MIME 타입 검증
    if file.content_type != 'application/pdf':
        raise ValidationError("올바른 PDF 파일이 아닙니다")
```

### 2. 경로 보안
```python
def secure_filename(filename: str) -> str:
    """안전한 파일명 생성"""
    import re
    import uuid
    
    # 위험한 문자 제거
    filename = re.sub(r'[^\w\s.-]', '', filename)
    
    # 고유 접두사 추가
    unique_prefix = str(uuid.uuid4())[:8]
    return f"{unique_prefix}_{filename}"
```

---

## 📊 요약

### 핵심 원칙
1. **모듈화**: 단일 책임 원칙 준수
2. **타입 안전성**: Type hints 필수 사용
3. **테스트 가능성**: 의존성 주입 활용
4. **성능**: 비동기 처리 및 캐싱
5. **보안**: 입력 검증 및 안전한 파일 처리

### 폴더 구조 요약
- `api/`: REST API 엔드포인트
- `core/`: 핵심 비즈니스 로직
- `services/`: 서비스 레이어
- `models/`: 데이터 모델
- `utils/`: 공통 유틸리티

이 정책을 준수하여 확장 가능하고 유지보수 가능한 백엔드 시스템을 구축합니다.
