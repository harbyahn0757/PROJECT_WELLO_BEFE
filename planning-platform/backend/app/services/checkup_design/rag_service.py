"""
RAG (Retrieval-Augmented Generation) 서비스 모듈
LlamaIndex 및 Gemini LLM 기반 의료 지식 검색 엔진

**로컬 FAISS 벡터 DB 지원 추가**
- LlamaCloud API (기본값)
- 로컬 FAISS 벡터 DB (비용 절감, 빠른 응답)
"""
import os
import json
import re
from typing import List, Dict, Any, Optional
from app.core.config import settings

# LlamaIndex RAG 관련 임포트
try:
    from llama_index.core import Settings, VectorStoreIndex, StorageContext, load_index_from_storage
    from llama_index.core.llms import CustomLLM
    from llama_index.core.llms.llm import LLM
    from llama_index.core.llms import ChatMessage, MessageRole, CompletionResponse, LLMMetadata
    from llama_index.indices.managed.llama_cloud import LlamaCloudIndex
    from llama_index.llms.openai import OpenAI
    from llama_index.embeddings.openai import OpenAIEmbedding
    # FAISS 벡터 스토어 임포트
    try:
        import faiss
        import pickle
        from pathlib import Path as PathLib
        from llama_index.vector_stores.faiss import FaissVectorStore
        FAISS_AVAILABLE = True
    except ImportError:
        FAISS_AVAILABLE = False
    # Google Gemini는 google-generativeai 직접 사용하여 CustomLLM으로 래핑
    try:
        import google.generativeai as genai
        GEMINI_AVAILABLE = True
    except ImportError:
        GEMINI_AVAILABLE = False
        genai = None
    LLAMAINDEX_AVAILABLE = True
except ImportError as e:
    LLAMAINDEX_AVAILABLE = False
    GEMINI_AVAILABLE = False
    FAISS_AVAILABLE = False
    genai = None
    # 개발 환경에서 라이브러리가 없을 경우를 대비한 더미 클래스
    class LlamaCloudIndex:
        pass
    class OpenAI:
        pass
    class CustomLLM:
        pass
    class ChatMessage:
        pass
    class MessageRole:
        pass
    class CompletionResponse:
        pass
    class LLMMetadata:
        pass

# 상수 정의
LLAMACLOUD_INDEX_NAME = "Dr.Welno"
LLAMACLOUD_PROJECT_NAME = "Default"
LLAMACLOUD_INDEX_ID = "1bcef115-bb95-4d14-9c29-d38bb097a39c"
LLAMACLOUD_PROJECT_ID = "45c4d9d4-ce6b-4f62-ad88-9107fe6de8cc"
LLAMACLOUD_ORGANIZATION_ID = "e4024539-3d26-48b5-8051-9092380c84d2"

# 로컬 FAISS 벡터 DB 경로
LOCAL_FAISS_DIR = "/data/vector_db/welno/faiss_db"
LOCAL_FAISS_INDEX_PATH = f"{LOCAL_FAISS_DIR}/faiss.index"
LOCAL_FAISS_METADATA_PATH = f"{LOCAL_FAISS_DIR}/metadata.pkl"

# 전역 RAG 엔진 캐시 (기존 플로우용)
_rag_engine_cache: Optional[Any] = None
# 테스트용 RAG 엔진 캐시 (엘라마 클라우드 스타일)
_rag_engine_test_cache: Optional[Any] = None
# 로컬 FAISS 엔진 캐시
_rag_engine_local_cache: Optional[Any] = None

# Gemini CustomLLM 클래스
class GeminiLLM(CustomLLM):
    """Google Gemini를 LlamaIndex CustomLLM으로 구현 (RAG 검색용)"""
    
    def __init__(self, api_key: str, model: str = "gemini-3-flash-preview", **kwargs):
        if not GEMINI_AVAILABLE or not genai:
            raise ImportError("google-generativeai가 설치되지 않았습니다.")
        
        super().__init__(**kwargs)
        genai.configure(api_key=api_key)
        self._model = genai.GenerativeModel(model)
        self._model_name = model
    
    @property
    def metadata(self) -> LLMMetadata:
        return LLMMetadata(
            context_window=8192,
            num_output=2048,
            is_chat_model=True,
            model_name=self._model_name
        )
    
    def complete(self, prompt: str, formatted: bool = False, **kwargs) -> CompletionResponse:
        try:
            response = self._model.generate_content(prompt)
            text = response.text if hasattr(response, 'text') else str(response)
            return CompletionResponse(text=text)
        except Exception as e:
            raise Exception(f"Gemini API 호출 실패: {str(e)}")
    
    async def acomplete(self, prompt: str, formatted: bool = False, **kwargs) -> CompletionResponse:
        try:
            response = self._model.generate_content(prompt)
            text = response.text if hasattr(response, 'text') else str(response)
            return CompletionResponse(text=text)
        except Exception as e:
            raise Exception(f"Gemini API 호출 실패: {str(e)}")
    
    def stream_complete(self, prompt: str, formatted: bool = False, **kwargs):
        try:
            response = self._model.generate_content(prompt, stream=True)
            for chunk in response:
                if hasattr(chunk, 'text') and chunk.text:
                    yield CompletionResponse(text=chunk.text, delta=chunk.text)
        except Exception as e:
            raise Exception(f"Gemini API 호출 실패: {str(e)}")

# 프롬프트 템플릿 정의
from llama_index.core import PromptTemplate

CHAT_SYSTEM_PROMPT = (
    "당신은 전문적이고 친절한 건강 상담가 'Dr. Welno'입니다.\n"
    "다음 지침을 반드시 지켜 답변하세요.\n"
    "1. **맞춤형 브리핑**: 만약 [Context]에 '환자 최근 건강 상태' 정보가 있다면, 첫 인사와 함께 해당 정보를 아주 짧게 언급하며 상담을 시작하세요.\n"
    "   - **주의**: 실제로 [Context]에 있는 정보(예: BMI, 혈압, 질환 의심 소견)만 언급하세요. '문진표를 확인했다'거나 [Context]에 없는 내용을 지어내어 말하지 마세요. (환각 금지)\n"
    "2. **직설적 답변**: '지침서에 따르면', '제공된 정보에 의하면'과 같은 부연 설명은 절대 하지 마세요. 전문가로서 자연스럽고 단호하게 답변하세요.\n"
    "3. **질문 집중**: 브리핑 이후에는 사용자가 현재 묻고 있는 구체적인 질문에 집중하여 답변하세요.\n"
    "4. **간결성**: 답변은 핵심 위주로 요약하고, 구체적인 실천 방법은 불렛 포인트로 정리하세요.\n"
    "5. **에비던스 제외**: 근거 문서나 출처에 대한 언급은 답변 텍스트에 포함하지 마세요.\n"
    "\n"
    "[Context]\n"
    "{context_str}\n"
    "\n"
    "사용자 질문: {query_str}\n"
    "전문가 답변:"
)

async def init_rag_engine(use_elama_model: bool = False, use_local_vector_db: bool = True):
    """
    RAG Query Engine 초기화
    
    Args:
        use_elama_model: True면 엘라마 클라우드의 모델 설정 사용 (테스트용)
                        False면 GeminiLLM 사용 (기존 검진 설계 플로우용)
        use_local_vector_db: True면 로컬 FAISS 벡터 DB 사용 (비용 절감, 빠른 응답, 기본값)
                            False면 LlamaCloud API 사용
    """
    global _rag_engine_cache, _rag_engine_test_cache, _rag_engine_local_cache
    
    # 캐시 확인
    if use_local_vector_db:
        if _rag_engine_local_cache is not None:
            print("[INFO] 로컬 FAISS 엔진 캐시 사용")
            return _rag_engine_local_cache
    elif use_elama_model:
        if _rag_engine_test_cache is not None:
            return _rag_engine_test_cache
    else:
        if _rag_engine_cache is not None:
            return _rag_engine_cache
    
    if not LLAMAINDEX_AVAILABLE:
        print("[WARN] LlamaIndex 라이브러리가 설치되지 않았습니다.")
        return None
    
    try:
        # ===== 로컬 FAISS 벡터 DB 사용 =====
        if use_local_vector_db:
            if not FAISS_AVAILABLE:
                print("[WARN] FAISS 라이브러리가 설치되지 않았습니다. LlamaCloud로 fallback합니다.")
                use_local_vector_db = False  # Fallback to cloud
            else:
                print("[INFO] 로컬 FAISS 벡터 DB 초기화 중...")
                
                # FAISS 인덱스 로드
                if not PathLib(LOCAL_FAISS_INDEX_PATH).exists():
                    print(f"[WARN] FAISS 인덱스 파일을 찾을 수 없습니다: {LOCAL_FAISS_INDEX_PATH}")
                    print("[INFO] LlamaCloud로 fallback합니다.")
                    use_local_vector_db = False
                else:
                    faiss_index = faiss.read_index(LOCAL_FAISS_INDEX_PATH)
                    print(f"[INFO] FAISS 인덱스 로드 완료: {faiss_index.ntotal}개 벡터")
                    
                    # 메타데이터 로드 (선택 사항으로 변경)
                    if PathLib(LOCAL_FAISS_METADATA_PATH).exists():
                        with open(LOCAL_FAISS_METADATA_PATH, 'rb') as f:
                            metadata = pickle.load(f)
                        total_docs = metadata.get('total_documents', metadata.get('total_nodes', faiss_index.ntotal))
                        print(f"[INFO] 메타데이터 로드 완료: {total_docs}개 문서")
                    else:
                        print(f"[INFO] 메타데이터 파일이 없으므로 기본 정보만 사용합니다.")
                        total_docs = faiss_index.ntotal
                    
                    # OpenAI 임베딩 모델 설정 (검색용)
                        openai_api_key = os.environ.get("OPENAI_API_KEY") or settings.openai_api_key
                        if not openai_api_key or openai_api_key == "dev-openai-key":
                            print("[WARN] OPENAI_API_KEY가 설정되지 않았습니다.")
                            print("[INFO] LlamaCloud로 fallback합니다.")
                            use_local_vector_db = False
                        else:
                            embed_model = OpenAIEmbedding(
                                model="text-embedding-ada-002",
                                api_key=openai_api_key
                            )
                            Settings.embed_model = embed_model
                            
                            # Gemini LLM 설정 (답변 생성용)
                            gemini_api_key = os.environ.get("GOOGLE_GEMINI_API_KEY") or settings.google_gemini_api_key
                            if not gemini_api_key or gemini_api_key == "dev-gemini-key":
                                print("[WARN] Google Gemini API 키가 설정되지 않았습니다.")
                                print("[INFO] LlamaCloud로 fallback합니다.")
                                use_local_vector_db = False
                            elif not GEMINI_AVAILABLE or not genai:
                                print("[WARN] Google Gemini가 사용 불가능합니다.")
                                print("[INFO] LlamaCloud로 fallback합니다.")
                                use_local_vector_db = False
                            else:
                                llm = GeminiLLM(api_key=gemini_api_key, model="gemini-3-flash-preview")
                                Settings.llm = llm
                                
                                # FAISS 벡터 스토어 생성
                                vector_store = FaissVectorStore.from_persist_dir(str(PathLib(LOCAL_FAISS_DIR)))
                                
                                # Storage Context 생성 (docstore와 index_store만 로드)
                                print(f"[INFO] Storage Context 로드 중...")
                                from llama_index.core.storage.docstore import SimpleDocumentStore
                                from llama_index.core.storage.index_store import SimpleIndexStore
                                
                                docstore = SimpleDocumentStore.from_persist_dir(str(PathLib(LOCAL_FAISS_DIR)))
                                index_store = SimpleIndexStore.from_persist_dir(str(PathLib(LOCAL_FAISS_DIR)))
                                
                                storage_context = StorageContext.from_defaults(
                                    vector_store=vector_store,
                                    docstore=docstore,
                                    index_store=index_store
                                )
                                
                                # 인덱스 로드 (index_id 명시)
                                try:
                                    # 먼저 index_id 없이 시도
                                    index = load_index_from_storage(storage_context)
                                except ValueError as e:
                                    if "Please specify index_id" in str(e):
                                        # index_store에서 index_id 목록 가져오기
                                        from llama_index.core.storage.index_store import SimpleIndexStore
                                        index_structs = storage_context.index_store.index_structs()
                                        
                                        if isinstance(index_structs, dict):
                                            index_ids = list(index_structs.keys())
                                        elif isinstance(index_structs, list):
                                            # list인 경우 첫 번째 항목의 index_id 사용
                                            index_ids = [struct.index_id for struct in index_structs if hasattr(struct, 'index_id')]
                                        else:
                                            raise ValueError(f"Unexpected index_structs type: {type(index_structs)}")
                                        
                                        if index_ids:
                                            print(f"[INFO] 여러 인덱스 발견, 첫 번째 사용: {index_ids[0]}")
                                            index = load_index_from_storage(storage_context, index_id=index_ids[0])
                                        else:
                                            raise ValueError("No index found in storage")
                                    else:
                                        raise
                                
                                # 쿼리 엔진 생성 (성능 최적화 및 커스텀 프롬프트 적용)
                                query_engine = index.as_query_engine(
                                    similarity_top_k=5,
                                    response_mode="compact",
                                    text_qa_template=PromptTemplate(CHAT_SYSTEM_PROMPT)
                                )
                                
                                _rag_engine_local_cache = query_engine
                                print(f"[INFO] ✅ 로컬 FAISS RAG 엔진 초기화 완료 (벡터: {faiss_index.ntotal}개, 문서: {total_docs}개)")
                                
                                return query_engine
        
        # ===== LlamaCloud API 사용 (기존 로직 또는 Fallback) =====
        if not use_local_vector_db:
            llamaindex_api_key = os.environ.get("LLAMAINDEX_API_KEY") or settings.llamaindex_api_key
            
            if not llamaindex_api_key:
                print("[WARN] LlamaIndex API 키가 설정되지 않았습니다.")
                return None
            
            index = LlamaCloudIndex(
                index_id=LLAMACLOUD_INDEX_ID,
                api_key=llamaindex_api_key
            )
            
            # GeminiLLM은 항상 필요 (LlamaCloudIndex가 기본적으로 OpenAI를 찾으려고 함)
            gemini_api_key = os.environ.get("GOOGLE_GEMINI_API_KEY") or settings.google_gemini_api_key
            
            if not gemini_api_key:
                print("[WARN] Google Gemini API 키가 설정되지 않았습니다.")
                return None
            
            if not GEMINI_AVAILABLE or not genai:
                return None
            
            llm = GeminiLLM(api_key=gemini_api_key, model="gemini-3-flash-preview")
            
            if use_elama_model:
                # 테스트용: GeminiLLM 사용
                query_engine = index.as_query_engine(
                    llm=llm,
                    similarity_top_k=5,
                    response_mode="tree_summarize"
                )
                _rag_engine_test_cache = query_engine
                print(f"[INFO] RAG 엔진 초기화 완료 (테스트용 - GeminiLLM, LlamaCloud Index ID: {LLAMACLOUD_INDEX_ID})")
            else:
                # 기존 플로우: GeminiLLM 사용 + Settings.llm 설정
                Settings.llm = llm
                
                query_engine = index.as_query_engine(
                    similarity_top_k=5,
                    response_mode="tree_summarize"
                )
                
                _rag_engine_cache = query_engine
                print(f"[INFO] RAG 엔진 초기화 완료 (LlamaCloud Index ID: {LLAMACLOUD_INDEX_ID})")
            
            return query_engine
        
    except Exception as e:
        print(f"[ERROR] RAG 엔진 초기화 중 오류: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def clean_html_content(text: str) -> str:
    """
    HTML 태그를 제거하고 텍스트를 정리합니다.
    """
    # HTML 태그 제거
    text = re.sub(r'<[^>]+>', '', text)
    # 연속된 공백 제거
    text = re.sub(r'\s+', ' ', text)
    # 앞뒤 공백 제거
    text = text.strip()
    return text

def extract_evidence_from_source_nodes(response) -> List[Dict[str, Any]]:
    """LlamaIndex 응답에서 소스 노드 메타데이터 추출"""
    evidences = []
    if hasattr(response, 'source_nodes'):
        for node in response.source_nodes:
            metadata = node.metadata if hasattr(node, 'metadata') else {}
            text = node.text if hasattr(node, 'text') else ""
            
            # HTML 태그 정제
            text = clean_html_content(text)
            
            score = node.score if hasattr(node, 'score') else 0.0
            
            # 메타데이터 추출
            file_name = metadata.get('file_name', 'Unknown')
            page_label = metadata.get('page_label', 'Unknown')
            
            # 인용구 추출
            citation = text[:100] + "..." if len(text) > 100 else text
            
            evidences.append({
                "source_document": file_name,
                "page": page_label,
                "citation": citation,
                "full_text": text,
                "confidence_score": score,
                "organization": "의학회",
                "year": "2024"
            })
    return evidences


async def get_medical_evidence_from_rag(query_engine, patient_context: Dict, concerns: List[Dict]) -> Dict[str, Any]:
    """
    환자 정보와 염려 사항을 기반으로 RAG 검색 수행
    """
    if not query_engine:
        return {"context_text": "", "structured_evidences": []}
    
    try:
        # 검색 쿼리 구성
        query_parts = []
        
        # 1. 나이/성별 기반
        age = patient_context.get('age', 40)
        gender = patient_context.get('gender', 'unknown')
        query_parts.append(f"{age}세 {gender}에게 권장되는 필수 건강검진 항목과 암 선별검사 기준")
        
        # 2. 이상 소견 기반
        abnormal_items = patient_context.get('abnormal_items', [])
        for item in abnormal_items:
            name = item.get('name', '')
            status = item.get('status', '')
            if name:
                query_parts.append(f"{name} 수치가 {status}일 때 필요한 정밀 검사와 임상적 의의")
        
        # 3. 가족력 기반
        family_history = patient_context.get('family_history', [])
        for fh in family_history:
            query_parts.append(f"{fh} 가족력이 있을 때 권장되는 조기 선별검사")
            
        # 4. 염려 항목 기반
        for concern in concerns:
            c_name = concern.get('name', '')
            if c_name:
                query_parts.append(f"{c_name} 관련 최신 진료지침과 검사 권고안")
        
        final_query = " \n".join(query_parts)
        print(f"[INFO] RAG 검색 쿼리 생성: {len(final_query)}자")
        
        # 검색 실행
        response = await query_engine.aquery(final_query)
        
        # 결과 처리
        context_text = str(response)
        structured_evidences = extract_evidence_from_source_nodes(response)
        
        # 각 에비던스에 쿼리 맥락 추가
        for ev in structured_evidences:
            ev['query'] = final_query
            ev['category'] = 'Clinical Guideline'
            
        return {
            "context_text": context_text,
            "structured_evidences": structured_evidences
        }
        
    except Exception as e:
        print(f"[ERROR] RAG 검색 실행 실패: {str(e)}")
        return {"context_text": "", "structured_evidences": []}


async def search_checkup_knowledge(query: str, use_local_vector_db: bool = True) -> Dict[str, Any]:
    """
    검진 지식 검색 (RAG)
    
    Args:
        query: 검색 쿼리
        use_local_vector_db: True면 로컬 FAISS 사용, False면 LlamaCloud 사용
    """
    query_engine = await init_rag_engine(use_local_vector_db=use_local_vector_db)
    
    if not query_engine:
        return {
            "success": False,
            "error": "RAG 엔진 초기화 실패",
            "answer": None,
            "sources": []
        }
    
    try:
        # 비동기 검색으로 변경
        response = await query_engine.aquery(query)
        
        # 소스 추출
        sources = []
        if hasattr(response, 'source_nodes'):
            for node in response.source_nodes:
                source_info = {
                    "text": clean_html_content(node.text)[:500],
                    "score": float(node.score) if hasattr(node, 'score') else None,
                    "metadata": node.metadata if hasattr(node, 'metadata') else {}
                }
                sources.append(source_info)
        
        return {
            "success": True,
            "answer": str(response),
            "sources": sources,
            "query": query
        }
    
    except Exception as e:
        print(f"[ERROR] RAG 검색 중 오류: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
            "answer": None,
            "sources": []
        }
