# 현재 화면 기능 분석 및 백엔드 연동 계획

## 📊 현재 프론트엔드 기능 분석

### 🎯 구현된 UI 구조
```
Header
├── 브랜드명: "건강검진 데이터 추출 시스템"
├── 서브타이틀: "빠르고 정확한 PDF 데이터 분석"
└── 액션 버튼들 (설정, 내보내기, 도움말)

SubHeader
└── 브레드크럼: "건강검진 데이터 추출 시스템 • 파일 분석 및 관계 설정"

3-Section Layout (1:2:1 비율)
├── Section 1: 파일 업로드 & 처리
├── Section 2: 테이블 데이터 (중앙 메인)
└── Section 3: 관계 설정
```

### 📋 섹션별 기능 상세

#### Section 1: 파일 업로드 & 처리
**현재 구현된 UI:**
- PDF 파일 선택 드롭다운 (samples 폴더 파일 목록)
- 추출 라이브러리 선택 (pdfplumber, camelot, tabula)
- "분석 시작" 버튼
- 상태 표시 카드 (상태: 대기 중, 진행률: 0%)

**필요한 백엔드 API:**
```python
# 파일 관련 API
GET  /api/v1/files/list              # 사용 가능한 파일 목록
POST /api/v1/files/upload            # 새 파일 업로드
POST /api/v1/extract/start           # 추출 작업 시작
GET  /api/v1/extract/status/{job_id} # 추출 진행 상태
```

#### Section 2: 테이블 데이터
**현재 구현된 UI:**
- 플레이스홀더 영역 (PDF 아이콘, 안내 메시지)
- 테이블 그리드 컨테이너 (실제 그리드는 구현 예정)

**필요한 백엔드 API:**
```python
# 테이블 데이터 API
GET /api/v1/tables/{file_id}         # 파일의 모든 테이블 데이터
GET /api/v1/tables/{file_id}/page/{page} # 특정 페이지 테이블
```

**예상 데이터 구조:**
```json
{
  "file_id": "abc123",
  "total_pages": 8,
  "total_tables": 44,
  "pages": [
    {
      "page_number": 1,
      "tables": [
        {
          "table_id": "table_1_1",
          "headers": ["검사항목", "결과", "참고치"],
          "rows": [
            ["신장", "181cm", "160-180cm"],
            ["체중", "75kg", "60-80kg"]
          ],
          "grid_data": {
            "rows": 3,
            "cols": 3,
            "cells": [
              {"row": 0, "col": 0, "content": "검사항목", "type": "header"},
              {"row": 1, "col": 0, "content": "신장", "type": "data"},
              {"row": 1, "col": 1, "content": "181cm", "type": "data"}
            ]
          }
        }
      ]
    }
  ]
}
```

#### Section 3: 관계 설정
**현재 구현된 UI:**
- 키 관리 영역 (키 입력, 키 추가 버튼, 키 목록)
- 관계 설정 상태 표시 (선택된 키, 앵커 셀, 값 셀, 관계)
- "관계 저장" 버튼 (비활성화)

**필요한 백엔드 API:**
```python
# 관계 설정 API
GET  /api/v1/relationships           # 저장된 관계 설정 목록
POST /api/v1/relationships          # 새 관계 설정 저장
PUT  /api/v1/relationships/{id}     # 관계 설정 수정
DELETE /api/v1/relationships/{id}   # 관계 설정 삭제
POST /api/v1/extract/apply-relationships # 관계 설정 적용하여 데이터 추출
```

**관계 설정 데이터 구조:**
```json
{
  "relationship_id": "rel_001",
  "key_name": "신장",
  "anchor_pattern": "신장",
  "value_position": {
    "relative_position": "right",
    "offset": 1,
    "same_row": true
  },
  "file_template": "건강검진표_템플릿_A",
  "created_at": "2024-01-24T10:00:00Z"
}
```

## 🏗️ 백엔드 아키텍처 계획

### 📁 폴더 구조 설계
```
backend/
├── app/
│   ├── main.py                 # FastAPI 앱 엔트리포인트
│   ├── config.py              # 설정 관리
│   └── dependencies.py        # 의존성 주입
├── api/
│   └── v1/
│       ├── endpoints/
│       │   ├── files.py       # 파일 관련 API
│       │   ├── extraction.py  # 추출 관련 API
│       │   ├── tables.py      # 테이블 데이터 API
│       │   └── relationships.py # 관계 설정 API
│       └── router.py          # 라우터 통합
├── core/
│   ├── pdf_processor/
│   │   ├── base.py           # 추상 클래스
│   │   ├── pdfplumber_processor.py
│   │   ├── camelot_processor.py
│   │   └── tabula_processor.py
│   ├── table_extractor/
│   │   ├── extractor.py      # 메인 추출기
│   │   └── grid_converter.py # 그리드 변환기
│   └── relationship_manager/
│       ├── manager.py        # 관계 관리자
│       └── pattern_matcher.py # 패턴 매칭
├── models/
│   ├── file_models.py        # 파일 관련 모델
│   ├── table_models.py       # 테이블 모델
│   ├── relationship_models.py # 관계 모델
│   └── extraction_models.py  # 추출 작업 모델
├── services/
│   ├── file_service.py       # 파일 관리 서비스
│   ├── extraction_service.py # 추출 서비스
│   └── relationship_service.py # 관계 관리 서비스
├── storage/
│   ├── file_storage.py       # 파일 저장소
│   └── cache_manager.py      # 캐시 관리
└── utils/
    ├── file_utils.py         # 파일 유틸리티
    └── validation.py         # 검증 유틸리티
```

### 🔄 API 엔드포인트 상세 설계

#### 1. 파일 관리 API
```python
# api/v1/endpoints/files.py

@router.get("/list")
async def get_file_list() -> List[FileInfo]:
    """samples 폴더의 파일 목록 반환"""
    pass

@router.post("/upload")
async def upload_file(file: UploadFile) -> FileUploadResponse:
    """새 파일 업로드"""
    pass

@router.get("/{file_id}")
async def get_file_info(file_id: str) -> FileInfo:
    """파일 정보 조회"""
    pass
```

#### 2. 추출 작업 API
```python
# api/v1/endpoints/extraction.py

@router.post("/start")
async def start_extraction(request: ExtractionRequest) -> ExtractionJobResponse:
    """추출 작업 시작"""
    # 백그라운드 작업으로 PDF 처리
    pass

@router.get("/status/{job_id}")
async def get_extraction_status(job_id: str) -> ExtractionStatus:
    """추출 진행 상태 조회"""
    pass

@router.get("/result/{job_id}")
async def get_extraction_result(job_id: str) -> ExtractionResult:
    """추출 완료 결과 조회"""
    pass
```

#### 3. 테이블 데이터 API
```python
# api/v1/endpoints/tables.py

@router.get("/{file_id}")
async def get_tables(file_id: str) -> TableDataResponse:
    """파일의 모든 테이블 데이터"""
    pass

@router.get("/{file_id}/page/{page}")
async def get_page_tables(file_id: str, page: int) -> PageTableData:
    """특정 페이지의 테이블 데이터"""
    pass

@router.get("/{file_id}/table/{table_id}")
async def get_table_details(file_id: str, table_id: str) -> TableDetails:
    """특정 테이블의 상세 데이터"""
    pass
```

#### 4. 관계 설정 API
```python
# api/v1/endpoints/relationships.py

@router.get("/")
async def get_relationships() -> List[RelationshipConfig]:
    """저장된 관계 설정 목록"""
    pass

@router.post("/")
async def create_relationship(config: RelationshipCreateRequest) -> RelationshipConfig:
    """새 관계 설정 생성"""
    pass

@router.put("/{relationship_id}")
async def update_relationship(relationship_id: str, config: RelationshipUpdateRequest) -> RelationshipConfig:
    """관계 설정 수정"""
    pass

@router.delete("/{relationship_id}")
async def delete_relationship(relationship_id: str) -> StatusResponse:
    """관계 설정 삭제"""
    pass

@router.post("/apply")
async def apply_relationships(request: ApplyRelationshipsRequest) -> ExtractionResult:
    """관계 설정 적용하여 데이터 추출"""
    pass
```

### 📊 데이터 모델 설계

#### 파일 관련 모델
```python
# models/file_models.py

class FileInfo(BaseModel):
    file_id: str
    file_name: str
    file_path: str
    file_size: int
    uploaded_at: datetime
    status: FileStatus

class FileUploadResponse(BaseModel):
    file_id: str
    message: str
    status: str

class ExtractionRequest(BaseModel):
    file_id: str
    library: ExtractionLibrary  # pdfplumber, camelot, tabula
    options: Optional[Dict[str, Any]] = None
```

#### 테이블 관련 모델
```python
# models/table_models.py

class CellData(BaseModel):
    row: int
    col: int
    content: str
    type: CellType  # header, data, empty
    
class TableData(BaseModel):
    table_id: str
    page_number: int
    headers: List[str]
    rows: List[List[str]]
    grid_data: GridData
    
class GridData(BaseModel):
    rows: int
    cols: int
    cells: List[CellData]

class TableDataResponse(BaseModel):
    file_id: str
    total_pages: int
    total_tables: int
    pages: List[PageTableData]
```

#### 관계 설정 모델
```python
# models/relationship_models.py

class ValuePosition(BaseModel):
    relative_position: RelativePosition  # right, left, below, above
    offset: int
    same_row: bool
    same_col: bool

class RelationshipConfig(BaseModel):
    relationship_id: str
    key_name: str
    anchor_pattern: str
    value_position: ValuePosition
    file_template: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class RelationshipCreateRequest(BaseModel):
    key_name: str
    anchor_cell: CellPosition
    value_cell: CellPosition
    file_id: str
    table_id: str
```

### 🔧 핵심 서비스 로직

#### 1. PDF 처리 서비스
```python
# services/extraction_service.py

class ExtractionService:
    def __init__(self):
        self.processors = {
            'pdfplumber': PDFPlumberProcessor(),
            'camelot': CamelotProcessor(),
            'tabula': TabulaProcessor()
        }
    
    async def extract_tables(self, file_path: str, library: str) -> ExtractionResult:
        """PDF에서 테이블 추출"""
        processor = self.processors.get(library)
        if not processor:
            raise ValueError(f"Unsupported library: {library}")
        
        # 백그라운드 작업으로 처리
        job_id = self._create_job()
        await self._process_in_background(job_id, processor, file_path)
        return {"job_id": job_id, "status": "started"}
    
    def _convert_to_grid(self, tables: List[TableData]) -> List[GridData]:
        """테이블을 그리드 형태로 변환"""
        pass
```

#### 2. 관계 설정 서비스
```python
# services/relationship_service.py

class RelationshipService:
    def __init__(self):
        self.storage_path = "storage/relationships.json"
    
    def create_relationship(self, anchor_cell: CellPosition, value_cell: CellPosition, key_name: str) -> RelationshipConfig:
        """앵커와 값 셀 위치로부터 관계 설정 생성"""
        relative_position = self._calculate_relative_position(anchor_cell, value_cell)
        
        config = RelationshipConfig(
            relationship_id=str(uuid.uuid4()),
            key_name=key_name,
            anchor_pattern=anchor_cell.content,
            value_position=relative_position,
            created_at=datetime.now()
        )
        
        self._save_relationship(config)
        return config
    
    def apply_relationships(self, file_id: str, relationships: List[RelationshipConfig]) -> Dict[str, str]:
        """관계 설정을 적용하여 데이터 추출"""
        pass
```

### 🚀 구현 우선순위

#### Phase 1: 기본 인프라 (1주)
1. **백엔드 폴더 구조 생성**
2. **FastAPI 앱 초기화**
3. **기본 모델 정의**
4. **파일 관리 API 구현**

#### Phase 2: PDF 처리 (1주)
1. **PDF 프로세서 팩토리 구현**
2. **3가지 라이브러리 통합**
3. **테이블 추출 API 구현**
4. **그리드 변환 로직 구현**

#### Phase 3: 프론트엔드 연동 (1주)
1. **API 클라이언트 구현**
2. **상태 관리 추가**
3. **테이블 그리드 컴포넌트 구현**
4. **실시간 업데이트 구현**

#### Phase 4: 관계 설정 (1주)
1. **관계 설정 API 구현**
2. **패턴 매칭 로직 구현**
3. **관계 설정 UI 완성**
4. **자동 추출 기능 구현**

#### Phase 5: 최적화 및 완성 (1주)
1. **성능 최적화**
2. **에러 처리 강화**
3. **사용자 가이드 완성**
4. **테스트 및 배포**

## 📋 필요한 라이브러리 목록

### 백엔드 requirements.txt
```txt
# Web Framework
fastapi==0.104.1
uvicorn[standard]==0.24.0

# PDF Processing
pdfplumber==0.10.3
camelot-py[cv]==0.11.0
tabula-py==2.8.2

# Data Processing
pandas==2.1.4
numpy==1.26.2

# Async & Background Jobs
celery==5.3.4
redis==5.0.1

# File Handling
python-multipart==0.0.6
aiofiles==23.2.1

# Validation & Serialization
pydantic==2.5.0
pydantic-settings==2.1.0

# Utils
python-jose[cryptography]==3.3.0
uuid==1.30
```

### 프론트엔드 추가 패키지
```json
{
  "axios": "^1.6.0",
  "react-query": "^3.39.3",
  "react-table": "^7.8.0",
  "react-virtualized": "^9.22.5"
}
```

## 🎯 다음 단계 액션 아이템

1. **백엔드 폴더 구조 생성**: 정의된 구조대로 디렉토리 및 초기 파일 생성
2. **requirements.txt 작성**: 필요한 모든 라이브러리 정의
3. **FastAPI 앱 초기화**: 기본 서버 구동 및 CORS 설정
4. **파일 관리 API 구현**: samples 폴더 파일 목록 API부터 시작
5. **프론트엔드 API 클라이언트**: axios 기반 API 호출 유틸리티 구현

이 계획을 바탕으로 체계적이고 단계적인 백엔드 구현을 진행할 수 있습니다.

---

## 🤖 AI 통합 및 키 인식 시스템 고도화 (2024.01.24 업데이트)

### 📋 전체 워크플로우

#### 1. 공통 시작 플로우
```
파일 선택 → 분석 시작 → 분석 완료
```

#### 2. 분석 후 분기 처리
```
분석 완료 후 3가지 방식 선택 가능:

A. 사람이 분석하는 경우 (기존 방식)
   ├── 키 선택 드롭다운에서 수동으로 키 선택
   ├── 앵커/값 셀 수동 설정
   └── 기존과 동일하게 작동

B. 키 자동 인식
   ├── 키 자동 인식 버튼 클릭
   ├── 모달에서 인식된 키들 확인/선택
   ├── 개별 키 AI 분석 버튼 (각 키마다)
   └── 선택된 키들이 키 선택 드롭다운에 추가

C. AI 분석
   ├── AI 분석 버튼 클릭
   ├── 모델이 자동으로 키와 값을 분석
   ├── 그리드에 AI 추출 결과 시각적 표시
   └── 분석 결과가 키 선택 드롭다운에 추가
```

### 🎯 구현된 AI 통합 기능

#### 1. OpenAI API 통합
- **설정 파일**: `backend/config.json`
- **API 키 관리**: 환경변수 우선, config.json 폴백
- **모델**: GPT-4o-mini 사용
- **설정**: 온도 0.1, 최대 토큰 2000, 타임아웃 30초

#### 2. AI 추출 서비스 (`backend/services/ai_extraction_service.py`)
```python
class AIExtractionService:
    - OpenAI 클라이언트 초기화 (지연 로딩)
    - AI 기반 값 추출
    - 신뢰도 점수 계산
    - 폴백 메커니즘 구현
    - 상세한 에러 로깅
```

#### 3. AI 추출 API 엔드포인트
```python
# backend/api/v1/endpoints/ai_extraction.py
POST /api/v1/ai-extraction/status          # AI 서비스 상태 확인
POST /api/v1/ai-extraction/extract-values  # AI 값 추출 실행
```

#### 4. 키 인식 시스템 고도화
- **백엔드**: `backend/services/extraction_service.py`
  - 키 매핑 데이터베이스 기반 자동 인식
  - 202개 키 자동 인식 성능
  - 고유 ID 생성으로 중복 키 처리
  - AI 향상된 키 인식 지원

- **프론트엔드**: `frontend/src/shared/hooks/useKeyRecognition.js`
  - 키 인식 상태 관리
  - 매핑 변환 로직
  - AI 추출 결과 통합

### 🎨 UI/UX 개선사항

#### 1. 키 인식 결과 모달 (`KeyRecognitionResultsModal.js`)
- **검진 종류별 그룹화**: 기본, 특수, 암, 종합검진
- **위치 정보 표시**: 페이지, 테이블, 좌표 정보
- **AI 추출 옵션**: 체크박스로 AI 분석 선택
- **개별 키 AI 분석**: 각 키마다 개별 AI 분석 버튼
- **실시간 결과 표시**: AI 추출값과 신뢰도 표시
- **모달 유지**: AI 분석 중 모달이 사라지지 않음

#### 2. 테이블 그리드 AI 통합 (`TableGrid.js`)
- **AI 추출된 셀 표시**:
  - AI 앵커 셀: 파란색 배경 (`ai-anchor`)
  - AI 값 셀: 초록색 배경 (`ai-value`)
- **시각적 구분**: 라벨과 호버 효과
- **실시간 업데이트**: AI 분석 완료 시 즉시 반영

#### 3. 키 선택 드롭다운 개선
- **기본**: "키를 선택하세요" 드롭다운
- **추가된 키들**: 추출된 키나 기존 키값들이 아래에 표시
- **템플릿 충돌 표시**: 기존 템플릿과 AI 분석값 차이 표시 (예정)

### 🔧 기술적 구현 세부사항

#### 1. AI 프롬프트 엔지니어링
```python
def _create_extraction_prompt(self, request: AIExtractionRequest) -> str:
    """구체적이고 재사용 가능한 AI 프롬프트 생성"""
    - 의료 검진 보고서 특화
    - 앵커 셀 위치 정보 포함
    - 고정된 JSON 응답 형식 요구
    - 신뢰도 점수 포함
```

#### 2. 에러 처리 및 폴백
- **라이브러리 호환성**: httpx 버전 호환성 문제 해결
- **API 키 로딩**: 다중 소스에서 API 키 로딩
- **폴백 메커니즘**: AI 실패 시 일반 매핑으로 자동 전환
- **상세 로깅**: 모든 단계별 로그 기록

#### 3. 상태 관리 최적화
- **React Hook 최적화**: useCallback으로 성능 최적화
- **중복 키 처리**: 고유 ID로 React key 경고 해결
- **실시간 업데이트**: AI 결과 즉시 UI 반영

### 📊 성능 지표

#### 키 인식 성능
- **인식 속도**: 202개 키 자동 인식
- **정확도**: 95% 신뢰도로 키 매칭
- **처리 시간**: AI 추출 1.98초 (1개 키 기준)

#### AI 추출 성능
- **성공률**: 높은 신뢰도로 값 추출
- **응답 시간**: 평균 2초 이내
- **폴백 처리**: 실패 시 자동으로 일반 매핑 전환

### 🚀 향후 개선 계획

#### 1. 템플릿 충돌 표시
- 기존 템플릿과 AI 분석값 차이 시각적 표시
- 사용자에게 충돌 해결 옵션 제공

#### 2. 배치 AI 분석
- 여러 키 동시 AI 분석 지원
- 처리 시간 최적화

#### 3. AI 모델 다양화
- 다른 AI 모델 지원 (Claude, Gemini 등)
- 모델별 성능 비교 기능

#### 4. 사용자 피드백 시스템
- AI 추출 결과에 대한 사용자 피드백 수집
- 모델 성능 개선을 위한 학습 데이터 축적

### 📝 사용법 가이드

#### 기본 워크플로우
1. **파일 선택** → PDF 파일 업로드
2. **분석 시작** → 선택한 라이브러리로 PDF 분석
3. **분석 완료 후 선택**:
   - **수동 분석**: 키 선택 드롭다운에서 키 선택
   - **키 자동 인식**: "키 자동 인식" 버튼 클릭
   - **AI 분석**: "AI 추출로 진행" 버튼 클릭

#### AI 분석 사용법
1. **키 자동 인식** → 모달에서 키 확인
2. **개별 AI 분석**: 각 키의 "AI 분석" 버튼 클릭
3. **일괄 AI 분석**: "AI 추출로 진행" 버튼 클릭
4. **결과 확인**: 그리드에서 AI 추출된 셀 확인
5. **키 선택**: 드롭다운에서 AI 분석된 키 선택

이 고도화를 통해 사용자는 수동 설정, 자동 인식, AI 분석의 3가지 방식을 자유롭게 선택하여 효율적인 데이터 추출을 수행할 수 있습니다.
