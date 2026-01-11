# LlamaCloud → 로컬 벡터 DB 마이그레이션 계획

## 📋 개요

**목적**: 엘라마 클라우드 벡터 인덱스를 로컬 100GB 디스크(/data)로 마이그레이션하여 비용 절감 및 성능 향상

**현재 상황**:
- 엘라마 클라우드 인덱스: 1개 (Dr.Welno)
- 인덱스 ID: `1bcef115-bb95-4d14-9c29-d38bb097a39c`
- 로컬 디스크: `/data` (100GB, 사용량 0.036%)

---

## 🎯 마이그레이션 목표

### Before (클라우드)
```
사용자 질문
  ↓
LlamaCloud API (외부)
  ↓ (네트워크 호출)
벡터 검색 결과
  ↓
Gemini LLM
  ↓
답변 생성
```

**문제점**:
- ❌ API 호출 비용 (건당 과금)
- ❌ 네트워크 의존성
- ❌ 응답 속도 제한
- ❌ 데이터 소유권 제한

### After (로컬)
```
사용자 질문
  ↓
로컬 벡터 DB (/data/vector_db/welno/)
  ↓ (로컬 쿼리)
벡터 검색 결과
  ↓
Gemini LLM
  ↓
답변 생성
```

**장점**:
- ✅ API 비용 제로
- ✅ 오프라인 작동 가능
- ✅ 빠른 응답 속도 (네트워크 없음)
- ✅ 완전한 데이터 소유권

---

## 🛠️ 기술 스택 선택

### 옵션 1: ChromaDB (추천 ⭐)
```python
# 장점
- 경량 (Python 네이티브)
- 설치 간단 (pip install chromadb)
- 영구 저장 지원
- 유사도 검색 최적화
- LlamaIndex 네이티브 지원

# 단점
- 대규모 스케일링 제한 (단일 서버)

# 설치
pip install chromadb
```

### 옵션 2: Qdrant
```python
# 장점
- 고성능 Rust 엔진
- REST API 제공
- 클라우드/로컬 모두 지원

# 단점
- 별도 서버 실행 필요
- 메모리 사용량 높음

# 설치
docker run -p 6333:6333 qdrant/qdrant
pip install qdrant-client
```

### 옵션 3: FAISS (Meta)
```python
# 장점
- 초고속 검색 (Meta 개발)
- 대규모 데이터 처리

# 단점
- 영구 저장 수동 구현 필요
- 인덱스 빌드 복잡

# 설치
pip install faiss-cpu
```

**✅ 결정: ChromaDB (경량, 간편, LlamaIndex 호환)**

---

## 📦 Phase별 작업 계획

### Phase 1: 데이터 추출 (LlamaCloud → JSON)
**목표**: 기존 벡터 인덱스 데이터를 백업용 JSON으로 추출

```bash
작업 디렉토리: /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/scripts/04_migration/

파일:
1. extract_llamacloud_data.py
   - LlamaCloud API로 모든 문서 추출
   - 텍스트 + 메타데이터 + 임베딩 저장
   - 저장 경로: /data/vector_db/welno/backup/llamacloud_export.json

2. verify_export.py
   - 추출 데이터 무결성 검증
   - 문서 수, 임베딩 차원 확인
```

**예상 결과**:
```json
{
  "index_name": "Dr.Welno",
  "index_id": "1bcef115-bb95-4d14-9c29-d38bb097a39c",
  "total_documents": 1234,
  "embedding_dimension": 1536,
  "documents": [
    {
      "id": "doc_001",
      "text": "고혈압은...",
      "metadata": {
        "source": "medical_guide.pdf",
        "page": 15
      },
      "embedding": [0.123, 0.456, ...]
    }
  ]
}
```

---

### Phase 2: ChromaDB 설치 및 초기화
**목표**: 로컬 벡터 DB 환경 구축

```bash
작업:
1. ChromaDB 설치
   cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend
   pip install chromadb

2. 디렉토리 구조 생성
   mkdir -p /data/vector_db/welno/chroma_db
   mkdir -p /data/vector_db/welno/backup
   mkdir -p /data/vector_db/welno/logs

3. 초기화 스크립트 실행
   scripts/04_migration/init_chromadb.py
```

**디렉토리 구조**:
```
/data/vector_db/welno/
├── chroma_db/           # ChromaDB 데이터
│   ├── chroma.sqlite3   # 메타데이터
│   └── vectors/         # 벡터 데이터
├── backup/              # 백업
│   └── llamacloud_export.json
├── logs/                # 로그
│   └── migration.log
└── config.json          # 설정
```

---

### Phase 3: 데이터 마이그레이션 (JSON → ChromaDB)
**목표**: 추출한 데이터를 ChromaDB에 저장

```bash
작업 파일: scripts/04_migration/migrate_to_chromadb.py

처리 과정:
1. llamacloud_export.json 읽기
2. ChromaDB 컬렉션 생성 ("welno_medical_knowledge")
3. 문서별 임베딩 + 메타데이터 저장
4. 벡터 인덱스 빌드

예상 소요 시간: 5-10분 (1000개 문서 기준)
```

---

### Phase 4: RAG 서비스 코드 수정
**목표**: LlamaCloud API → ChromaDB로 변경

**수정 파일**: `backend/app/services/checkup_design/rag_service.py`

```python
# Before (LlamaCloud)
from llama_index.indices.managed.llama_cloud import LlamaCloudIndex

index = LlamaCloudIndex(
    index_id=LLAMACLOUD_INDEX_ID,
    api_key=llamaindex_api_key
)

# After (ChromaDB)
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.core import VectorStoreIndex, StorageContext
import chromadb

chroma_client = chromadb.PersistentClient(path="/data/vector_db/welno/chroma_db")
chroma_collection = chroma_client.get_or_create_collection("welno_medical_knowledge")

vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
storage_context = StorageContext.from_defaults(vector_store=vector_store)
index = VectorStoreIndex.from_vector_store(vector_store, storage_context=storage_context)
```

**환경변수 추가**: `backend/config.env`
```env
# 로컬 벡터 DB 설정
USE_LOCAL_VECTOR_DB=true  # true: 로컬, false: LlamaCloud
LOCAL_VECTOR_DB_PATH=/data/vector_db/welno/chroma_db
LOCAL_VECTOR_DB_COLLECTION=welno_medical_knowledge
```

---

### Phase 5: 병렬 테스트 (A/B 비교)
**목표**: 클라우드 vs 로컬 성능 비교

```bash
테스트 스크립트: scripts/04_migration/compare_performance.py

테스트 항목:
1. 응답 속도 (클라우드 vs 로컬)
2. 검색 정확도 (유사도 점수 비교)
3. 메모리 사용량
4. 디스크 사용량

예상 결과:
┌─────────────┬──────────────┬─────────────┐
│ 항목        │ 클라우드     │ 로컬        │
├─────────────┼──────────────┼─────────────┤
│ 응답 속도   │ 800ms        │ 120ms       │
│ API 비용    │ $0.02/query  │ $0          │
│ 정확도      │ 0.85         │ 0.85        │
│ 메모리      │ N/A          │ 200MB       │
│ 디스크      │ N/A          │ 500MB       │
└─────────────┴──────────────┴─────────────┘
```

---

### Phase 6: 프로덕션 전환
**목표**: 로컬 벡터 DB를 기본값으로 설정

```bash
1. config.env 수정
   USE_LOCAL_VECTOR_DB=true

2. PM2 재시작
   pm2 restart WELLO_BE

3. 모니터링 (24시간)
   - 에러율 확인
   - 응답 속도 확인
   - 메모리/디스크 사용량 확인

4. LlamaCloud API 키 백업 (비상용)
   - config.env.backup에 보관
   - 문제 발생 시 롤백 가능
```

---

## 🔧 필요 패키지

```bash
# requirements.txt 추가
chromadb>=0.4.22
tiktoken>=0.5.2
```

---

## 📊 예상 결과

### 비용 절감
```
현재 (클라우드):
- LlamaCloud API: $0.02/query
- 월 10,000 쿼리 = $200/month

마이그레이션 후 (로컬):
- API 비용: $0
- 디스크 비용: 이미 보유 (100GB 중 500MB 사용)
- 월 절감액: $200
```

### 성능 향상
```
응답 속도:
- 클라우드: 500-1000ms (네트워크 포함)
- 로컬: 50-150ms (디스크 I/O만)
- 개선율: 5-10배 빨라짐
```

### 디스크 사용량
```
/data/vector_db/welno/
├── chroma_db/       (~500MB)
├── backup/          (~100MB)
└── logs/            (~10MB)
총 예상 용량: 610MB (100GB 중 0.6%)
```

---

## ⚠️ 주의사항

1. **백업 필수**
   - 마이그레이션 전 LlamaCloud 데이터 JSON 백업
   - PostgreSQL 백업 (wello.wello_checkup_data)

2. **롤백 계획**
   - LlamaCloud API 키 보관
   - `USE_LOCAL_VECTOR_DB=false`로 즉시 복구 가능

3. **디스크 공간 모니터링**
   - /data 디스크 사용량 알림 설정
   - 80% 초과 시 경고

4. **벡터 인덱스 업데이트**
   - 새로운 의료 문서 추가 시 재인덱싱 필요
   - 업데이트 스크립트 준비: `scripts/04_migration/update_vectors.py`

---

## 📅 작업 일정 (예상)

```
Phase 1: 데이터 추출          - 1시간
Phase 2: ChromaDB 설치        - 30분
Phase 3: 데이터 마이그레이션  - 1시간
Phase 4: 코드 수정            - 2시간
Phase 5: 테스트               - 2시간
Phase 6: 프로덕션 전환        - 1시간
─────────────────────────────────────
총 예상 시간: 7.5시간 (1일)
```

---

## ✅ 체크리스트

### 마이그레이션 전
- [ ] LlamaCloud 데이터 백업
- [ ] PostgreSQL 백업
- [ ] 디스크 용량 확인 (/data 100GB 확인)
- [ ] 테스트 쿼리 준비 (정확도 비교용)

### 마이그레이션 중
- [ ] ChromaDB 설치
- [ ] 데이터 추출 (JSON)
- [ ] 데이터 임포트 (ChromaDB)
- [ ] 코드 수정 (rag_service.py)
- [ ] 환경변수 설정 (config.env)

### 마이그레이션 후
- [ ] A/B 테스트 (응답 속도, 정확도)
- [ ] 메모리/디스크 모니터링 (24시간)
- [ ] 에러율 확인
- [ ] LlamaCloud API 키 백업
- [ ] 문서화 업데이트

---

## 🚀 다음 단계

마이그레이션을 시작하시려면 다음 명령어를 실행해주세요:

```bash
# 1단계: 마이그레이션 스크립트 생성
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend
mkdir -p scripts/04_migration

# 2단계: ChromaDB 설치
pip install chromadb tiktoken

# 3단계: 데이터 추출 스크립트 실행
python scripts/04_migration/extract_llamacloud_data.py
```

**작업 승인을 받으면 Phase 1부터 시작하겠습니다!**
