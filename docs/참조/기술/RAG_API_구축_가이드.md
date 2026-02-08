# 🤖 WELNO RAG API 구축 및 외부 제공 가이드

**생성일**: 미상  
**작업일자**: 미상  
**작업내용**: RAG API 구축 및 외부 제공 가이드

---

## 📊 현재 구축된 시스템

### 1. 테스트 가능한 API

#### ✅ `/api/v1/rag/test` - RAG 검색 테스트

**요청:**
```bash
curl -X GET "http://localhost:8082/api/v1/rag/test?q=고혈압+관리+방법" \
  -H "Content-Type: application/json"
```

**응답:**
```json
{
  "context_text": "고혈압 관리를 위해서는...",
  "structured_evidences": [
    {
      "source_document": "고혈압_가이드라인.pdf",
      "page": "12",
      "citation": "혈압 140/90mmHg 이상...",
      "confidence_score": 0.85,
      "relevance": "높음"
    }
  ],
  "performance": {
    "total_seconds": 1.2,
    "evidence_count": 3
  }
}
```

#### ✅ `/api/v1/rag/diagnose` - 시스템 상태 확인

**요청:**
```bash
curl -X GET "http://localhost:8082/api/v1/rag/diagnose"
```

**응답:**
```json
{
  "status": "success",
  "timing": {
    "engine_init": 0.5,
    "total": 2.3
  },
  "sample_query": {
    "execution_time": 1.8,
    "source_node_count": 5
  }
}
```

### 2. 채팅 API (스트리밍)

#### `/api/v1/welno-rag-chat/message`

**요청:**
```bash
curl -X POST "http://localhost:8082/api/v1/welno-rag-chat/message" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "test-user-123",
    "hospital_id": "test-hospital",
    "message": "혈당 관리 방법 알려주세요",
    "session_id": "chat_session_123"
  }'
```

**응답 (Server-Sent Events):**
```
data: {"type":"chunk","content":"혈당 관리를 위해서는..."}

data: {"type":"chunk","content":"규칙적인 식사가 중요합니다..."}

data: {"type":"done","sources":[...]}
```

---

## 🚀 외부 API로 제공하는 방법

### 방법 1: REST API (권장)

#### 구현 예시: `app/api/external/rag_api.py`

```python
"""
외부 제공용 RAG API
- API 키 인증
- Rate Limiting
- 응답 캐싱
"""
from fastapi import APIRouter, HTTPException, Header, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import hashlib
import time
from functools import lru_cache

from ...services.checkup_design.rag_service import search_checkup_knowledge
from ...core.security import verify_api_key  # API 키 검증

router = APIRouter(prefix="/external/v1", tags=["External RAG API"])


class RAGQueryRequest(BaseModel):
    """RAG 검색 요청"""
    query: str
    max_results: Optional[int] = 5
    min_score: Optional[float] = 0.3
    categories: Optional[List[str]] = None  # ["고혈압", "당뇨", "영양"] 등


class RAGQueryResponse(BaseModel):
    """RAG 검색 응답"""
    success: bool
    query: str
    answer: str
    sources: List[Dict[str, Any]]
    metadata: Dict[str, Any]


# 간단한 메모리 캐시 (프로덕션에서는 Redis 사용)
response_cache: Dict[str, tuple[Dict[str, Any], float]] = {}
CACHE_TTL = 3600  # 1시간


def get_cached_response(query_hash: str) -> Optional[Dict[str, Any]]:
    """캐시에서 응답 조회"""
    if query_hash in response_cache:
        cached_data, timestamp = response_cache[query_hash]
        if time.time() - timestamp < CACHE_TTL:
            return cached_data
        else:
            del response_cache[query_hash]
    return None


def set_cached_response(query_hash: str, data: Dict[str, Any]):
    """응답 캐싱"""
    response_cache[query_hash] = (data, time.time())


@router.post("/rag/query", response_model=RAGQueryResponse)
async def external_rag_query(
    request: RAGQueryRequest,
    api_key: str = Header(..., alias="X-API-Key")
):
    """
    외부 파트너사용 RAG 검색 API
    
    **인증**: X-API-Key 헤더 필수
    
    **Rate Limit**: 분당 100회
    
    **예시:**
    ```bash
    curl -X POST "https://welno.com/external/v1/rag/query" \\
      -H "X-API-Key: your-api-key-here" \\
      -H "Content-Type: application/json" \\
      -d '{"query": "고혈압 관리 방법", "max_results": 5}'
    ```
    """
    
    # 1. API 키 검증
    is_valid, partner_info = await verify_api_key(api_key)
    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    
    # 2. Rate Limiting 체크
    # (생략 - Redis로 구현)
    
    # 3. 캐시 확인
    query_hash = hashlib.sha256(
        f"{request.query}_{request.max_results}_{request.min_score}".encode()
    ).hexdigest()
    
    cached = get_cached_response(query_hash)
    if cached:
        return JSONResponse(content={
            **cached,
            "cached": True,
            "partner_id": partner_info["id"]
        })
    
    # 4. RAG 검색 실행
    start_time = time.time()
    
    result = await search_checkup_knowledge(
        query=request.query,
        use_local_vector_db=True
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail="RAG 검색 실패")
    
    # 5. 응답 구조화
    response_data = {
        "success": True,
        "query": request.query,
        "answer": result.get("answer", ""),
        "sources": [
            {
                "text": source.get("text", "")[:500],  # 500자 제한
                "document": source.get("metadata", {}).get("file_name", "Unknown"),
                "page": source.get("metadata", {}).get("page_label", "Unknown"),
                "score": source.get("score", 0.0)
            }
            for source in result.get("sources", [])[:request.max_results]
            if source.get("score", 0) >= request.min_score
        ],
        "metadata": {
            "partner_id": partner_info["id"],
            "query_time": round(time.time() - start_time, 2),
            "source_count": len(result.get("sources", [])),
            "cached": False
        }
    }
    
    # 6. 캐싱
    set_cached_response(query_hash, response_data)
    
    return JSONResponse(content=response_data)


@router.get("/rag/health", response_model=Dict[str, str])
async def health_check():
    """API 상태 확인"""
    return {
        "status": "healthy",
        "version": "v1.0",
        "service": "WELNO RAG API"
    }
```

---

### 방법 2: Python SDK 제공

#### `welno_rag_sdk/client.py`

```python
"""
WELNO RAG API Python SDK
"""
import requests
from typing import List, Dict, Any, Optional


class WelnoRAGClient:
    """WELNO RAG API 클라이언트"""
    
    def __init__(self, api_key: str, base_url: str = "https://welno.com"):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }
    
    def query(
        self, 
        query: str,
        max_results: int = 5,
        min_score: float = 0.3
    ) -> Dict[str, Any]:
        """
        RAG 검색 실행
        
        Args:
            query: 검색 질문
            max_results: 최대 결과 수
            min_score: 최소 관련성 점수
            
        Returns:
            {
                "success": True,
                "answer": "...",
                "sources": [...]
            }
        """
        url = f"{self.base_url}/external/v1/rag/query"
        
        payload = {
            "query": query,
            "max_results": max_results,
            "min_score": min_score
        }
        
        response = requests.post(url, json=payload, headers=self.headers)
        response.raise_for_status()
        
        return response.json()
    
    def health_check(self) -> Dict[str, str]:
        """API 상태 확인"""
        url = f"{self.base_url}/external/v1/rag/health"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()


# 사용 예시
if __name__ == "__main__":
    # 초기화
    client = WelnoRAGClient(api_key="your-api-key-here")
    
    # 검색
    result = client.query("고혈압 관리 방법")
    
    print(f"답변: {result['answer']}")
    print(f"출처: {len(result['sources'])}개")
    
    for source in result['sources']:
        print(f"  - {source['document']} (p.{source['page']})")
```

---

### 방법 3: GraphQL API

#### `app/graphql/rag_schema.py`

```python
"""
GraphQL 스키마 (선택사항)
"""
import strawberry
from typing import List, Optional


@strawberry.type
class RAGSource:
    text: str
    document: str
    page: str
    score: float


@strawberry.type
class RAGQueryResult:
    success: bool
    query: str
    answer: str
    sources: List[RAGSource]


@strawberry.type
class Query:
    @strawberry.field
    async def rag_search(
        self, 
        query: str,
        max_results: Optional[int] = 5
    ) -> RAGQueryResult:
        """RAG 검색"""
        # ... (구현)
        pass


schema = strawberry.Schema(query=Query)
```

---

## 🏗️ 리트리버 서비스 구축 아키텍처

### 전체 구조

```
[클라이언트]
    ↓
[API Gateway] 
    ├─ API 키 인증
    ├─ Rate Limiting
    └─ 요청 로깅
    ↓
[RAG Service]
    ├─ Query Understanding (질문 의도 파악)
    ├─ Vector Search (벡터 검색)
    ├─ Reranking (재순위화)
    └─ LLM Generation (답변 생성)
    ↓
[Vector DB]
    ├─ FAISS (로컬, 빠름)
    ├─ Pinecone (클라우드)
    └─ Weaviate (오픈소스)
    ↓
[Document Store]
    ├─ 의학 지침서 PDF
    ├─ 건강검진 가이드
    └─ 영양 가이드
```

---

## 🔧 구현 단계

### Phase 1: API 인증 및 보안

#### 1.1 API 키 관리

```python
# app/core/security.py

import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Tuple, Dict, Any

# API 키 DB 테이블
"""
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    key_hash VARCHAR(64) UNIQUE NOT NULL,
    partner_id VARCHAR(50) NOT NULL,
    partner_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    rate_limit_per_minute INTEGER DEFAULT 100
);
"""


def generate_api_key() -> str:
    """API 키 생성 (64자 랜덤)"""
    return f"welno_{secrets.token_urlsafe(48)}"


def hash_api_key(api_key: str) -> str:
    """API 키 해싱 (DB 저장용)"""
    return hashlib.sha256(api_key.encode()).hexdigest()


async def verify_api_key(api_key: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    API 키 검증
    
    Returns:
        (is_valid, partner_info)
    """
    # DB에서 해시된 키 조회
    key_hash = hash_api_key(api_key)
    
    # SELECT * FROM api_keys WHERE key_hash = ? AND is_active = TRUE
    partner = await db.fetch_one(
        "SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = TRUE",
        key_hash
    )
    
    if not partner:
        return False, None
    
    # 만료 확인
    if partner["expires_at"] and datetime.now() > partner["expires_at"]:
        return False, None
    
    return True, {
        "id": partner["partner_id"],
        "name": partner["partner_name"],
        "rate_limit": partner["rate_limit_per_minute"]
    }
```

#### 1.2 Rate Limiting (Redis)

```python
# app/middleware/rate_limiter.py

import redis
from datetime import datetime
from fastapi import HTTPException

redis_client = redis.from_url("redis://localhost:6379/1")


async def check_rate_limit(partner_id: str, limit_per_minute: int = 100) -> bool:
    """
    Rate Limiting 체크
    
    Returns:
        True: 허용
        False: 제한 초과
    """
    key = f"rate_limit:{partner_id}:{datetime.now().strftime('%Y%m%d%H%M')}"
    
    current = redis_client.incr(key)
    
    if current == 1:
        redis_client.expire(key, 60)  # 1분 TTL
    
    if current > limit_per_minute:
        return False
    
    return True
```

---

### Phase 2: 벡터 DB 선택 및 구축

#### 옵션 1: FAISS (현재 사용 중, 로컬)

**장점:**
- 무료
- 빠른 검색 속도
- 로컬 저장

**단점:**
- 확장성 제한
- 클러스터링 어려움

**구축 방법:**
```python
# 벡터 DB 구축 스크립트
import faiss
from llama_index.core import SimpleDirectoryReader, VectorStoreIndex
from llama_index.vector_stores.faiss import FaissVectorStore
from llama_index.embeddings.openai import OpenAIEmbedding

# 1. 문서 로드
documents = SimpleDirectoryReader("/data/medical_docs/").load_data()

# 2. 임베딩 모델 초기화
embed_model = OpenAIEmbedding(model="text-embedding-3-large")

# 3. FAISS 인덱스 생성
dimension = 1536  # text-embedding-3-large
faiss_index = faiss.IndexFlatL2(dimension)

# 4. 벡터 스토어 생성
vector_store = FaissVectorStore(faiss_index=faiss_index)

# 5. 인덱스 빌드
index = VectorStoreIndex.from_documents(
    documents,
    vector_store=vector_store,
    embed_model=embed_model
)

# 6. 저장
index.storage_context.persist(persist_dir="/data/vector_db/welno/faiss_db")

print("✅ FAISS 인덱스 구축 완료")
```

#### 옵션 2: Pinecone (클라우드, 권장)

**장점:**
- 완전 관리형
- 자동 확장
- 높은 성능

**단점:**
- 유료 (월 $70~)

**구축 방법:**
```python
import pinecone
from llama_index.vector_stores.pinecone import PineconeVectorStore

# 1. Pinecone 초기화
pinecone.init(api_key="your-key", environment="us-west1-gcp")

# 2. 인덱스 생성
pinecone.create_index(
    name="welno-health-knowledge",
    dimension=1536,
    metric="cosine"
)

# 3. 벡터 스토어 연결
vector_store = PineconeVectorStore(
    pinecone_index=pinecone.Index("welno-health-knowledge")
)

# 4. 문서 임베딩 및 업로드
index = VectorStoreIndex.from_documents(
    documents,
    vector_store=vector_store
)
```

#### 옵션 3: Weaviate (오픈소스, 자체 호스팅)

**장점:**
- 오픈소스
- 강력한 필터링
- GraphQL 지원

**단점:**
- 직접 관리 필요

**Docker 실행:**
```yaml
# docker-compose.yml
version: '3.7'
services:
  weaviate:
    image: semitechnologies/weaviate:latest
    ports:
      - "8080:8080"
    environment:
      QUERY_DEFAULTS_LIMIT: 25
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'false'
      PERSISTENCE_DATA_PATH: '/var/lib/weaviate'
    volumes:
      - weaviate_data:/var/lib/weaviate

volumes:
  weaviate_data:
```

---

### Phase 3: LLM 통합 (답변 생성)

#### 현재 사용 중: Google Gemini

```python
# app/services/checkup_design/rag_service.py

class GeminiLLM(CustomLLM):
    """Gemini를 LlamaIndex에 통합"""
    
    def __init__(self, api_key: str, model: str = "gemini-2.0-flash-exp"):
        genai.configure(api_key=api_key)
        self._model = genai.GenerativeModel(model)
    
    async def acomplete(self, prompt: str) -> CompletionResponse:
        response = self._model.generate_content(prompt)
        return CompletionResponse(text=response.text)
```

#### 대안: OpenAI GPT-4

```python
from llama_index.llms.openai import OpenAI

llm = OpenAI(
    model="gpt-4-turbo-preview",
    api_key="your-openai-key",
    temperature=0.1
)
```

#### 대안: Claude (Anthropic)

```python
from anthropic import AsyncAnthropic

client = AsyncAnthropic(api_key="your-claude-key")

async def claude_complete(prompt: str) -> str:
    response = await client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text
```

---

### Phase 4: 응답 최적화

#### 4.1 하이브리드 검색

```python
# 벡터 검색 + 키워드 검색 조합
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.query_engine import RetrieverQueryEngine

vector_retriever = VectorIndexRetriever(
    index=index,
    similarity_top_k=10
)

# BM25 키워드 검색 추가
from llama_index.retrievers.bm25 import BM25Retriever

bm25_retriever = BM25Retriever.from_defaults(
    docstore=index.docstore,
    similarity_top_k=10
)

# 하이브리드 검색
from llama_index.core.retrievers import QueryFusionRetriever

hybrid_retriever = QueryFusionRetriever(
    retrievers=[vector_retriever, bm25_retriever],
    similarity_top_k=5,
    num_queries=1
)
```

#### 4.2 Reranking (재순위화)

```python
# Cohere Reranker 사용
from llama_index.postprocessor.cohere_rerank import CohereRerank

reranker = CohereRerank(
    api_key="your-cohere-key",
    top_n=3
)

query_engine = RetrieverQueryEngine.from_args(
    retriever=hybrid_retriever,
    node_postprocessors=[reranker]
)
```

---

## 📦 배포 및 모니터링

### 1. Docker 배포

```dockerfile
# Dockerfile.rag-api
FROM python:3.12-slim

WORKDIR /app

# 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 벡터 DB 복사
COPY vector_db/ /data/vector_db/

# 앱 복사
COPY app/ ./app/

# API 실행
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8082"]
```

### 2. 모니터링

```python
# app/middleware/logging.py

import time
from fastapi import Request

async def log_rag_requests(request: Request, call_next):
    """RAG API 요청 로깅"""
    start_time = time.time()
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    
    # Prometheus 메트릭 기록
    rag_request_duration.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)
    
    rag_request_count.labels(
        method=request.method,
        status=response.status_code
    ).inc()
    
    return response
```

---

## 🧪 테스트 방법

### 1. 로컬 테스트

```bash
# 서버 실행
cd planning-platform/backend
uvicorn app.main:app --reload --port 8082

# 테스트
curl "http://localhost:8082/api/v1/rag/test?q=고혈압"
curl "http://localhost:8082/api/v1/rag/diagnose"
```

### 2. Python으로 테스트

```python
import requests

# RAG 검색
response = requests.get(
    "http://localhost:8082/api/v1/rag/test",
    params={"q": "혈당 관리 방법"}
)

result = response.json()
print(f"답변: {result['context_text'][:200]}...")
print(f"출처: {len(result['structured_evidences'])}개")
```

### 3. 프론트엔드 테스트

```typescript
// src/services/ragTestService.ts

export const testRAG = async (query: string) => {
  const response = await fetch(
    `/api/v1/rag/test?q=${encodeURIComponent(query)}`
  );
  
  if (!response.ok) {
    throw new Error('RAG 검색 실패');
  }
  
  return await response.json();
};

// 사용
const result = await testRAG('고혈압 관리');
console.log(result.context_text);
```

---

## 💰 비용 최적화

### 1. 캐싱 전략

```python
# Redis 캐시
import redis
import json
import hashlib

redis_client = redis.from_url("redis://localhost:6379/2")

async def cached_rag_query(query: str):
    # 캐시 키 생성
    cache_key = f"rag:query:{hashlib.md5(query.encode()).hexdigest()}"
    
    # 캐시 확인
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # RAG 검색
    result = await search_checkup_knowledge(query)
    
    # 캐싱 (1시간)
    redis_client.setex(cache_key, 3600, json.dumps(result))
    
    return result
```

### 2. 임베딩 비용 절감

```python
# OpenAI 임베딩 대신 오픈소스 모델 사용
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('jhgan/ko-sroberta-multitask')

def embed_text(text: str):
    return model.encode(text).tolist()

# 또는 한국어 특화 모델
model = SentenceTransformer('snunlp/KR-SBERT-V40K-klueNLI-augSTS')
```

---

## 📈 성능 벤치마크

### 현재 시스템 성능

| 단계 | 평균 시간 | 최적 목표 |
|------|----------|----------|
| 엔진 초기화 | 0.5초 | <1초 |
| 벡터 검색 | 0.3초 | <0.5초 |
| LLM 생성 | 1.5초 | <3초 |
| **총 응답 시간** | **2.3초** | **<5초** |

---

## 🔐 보안 체크리스트

### API 제공 시 필수 사항

- [ ] API 키 인증
- [ ] Rate Limiting (분당 100회)
- [ ] HTTPS 필수
- [ ] CORS 설정
- [ ] 요청 로깅
- [ ] 민감 정보 필터링
- [ ] API 키 만료 관리
- [ ] IP 화이트리스트 (선택)

---

## 📚 문서화

### API 문서 자동 생성 (Swagger)

FastAPI는 자동으로 `/docs`에서 API 문서 제공:

```python
# app/main.py

app = FastAPI(
    title="WELNO RAG API",
    description="건강 지식 검색 및 상담 API",
    version="1.0.0",
    docs_url="/external/docs",
    redoc_url="/external/redoc"
)
```

접속: `http://localhost:8082/external/docs`

---

## 🎯 파트너사 제공 패키지

### 제공 항목

1. **API 키** (welno_abc123...)
2. **API 문서** (Swagger/Postman)
3. **Python SDK** (pip install welno-rag-sdk)
4. **사용 예시 코드**
5. **Rate Limit** (분당 100회)
6. **지원**: support@welno.com

### SDK 배포

```bash
# PyPI 배포
cd welno_rag_sdk/
python setup.py sdist bdist_wheel
twine upload dist/*

# 설치
pip install welno-rag-sdk
```

---

## 🔧 현재 프로젝트 테스트

### 즉시 테스트 가능

```bash
# 1. 백엔드 실행 확인
curl http://localhost:8082/api/v1/rag/diagnose

# 2. 검색 테스트
curl "http://localhost:8082/api/v1/rag/test?q=혈압+관리"

# 3. 채팅 테스트 (프론트엔드)
http://localhost:9282/welno
# → 우측 하단 채팅 버튼 클릭
```

### API 응답 예시

```json
{
  "context_text": "고혈압 관리를 위해서는 규칙적인 운동과 저염식이 중요합니다...",
  "structured_evidences": [
    {
      "source_document": "고혈압_임상진료지침.pdf",
      "page": "15",
      "citation": "혈압 140/90mmHg 이상일 경우...",
      "confidence_score": 0.87,
      "relevance": "높음",
      "category": "고혈압 관리"
    }
  ],
  "performance": {
    "total_seconds": 1.85,
    "evidence_count": 3
  }
}
```

---

**작성일**: 2026-01-18  
**현재 구축 상태**:
- ✅ RAG 서비스 (FAISS + Gemini)
- ✅ 테스트 API (`/api/v1/rag/test`)
- ✅ 채팅 UI (메인 페이지 버튼)
- 🔲 외부 API (구현 필요)
- 🔲 Python SDK (구현 필요)
