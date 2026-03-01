"""
RAG (Retrieval-Augmented Generation) 서비스 모듈
LlamaIndex 및 Gemini LLM 기반 의료 지식 검색 엔진

**로컬 FAISS 벡터 DB 지원 추가**
- 로컬 FAISS 벡터 DB (비용 절감, 빠른 응답)
"""
import os
import json
import re
from typing import List, Dict, Any, Optional
from ...core.config import settings

# LlamaIndex RAG 관련 임포트
try:
    from llama_index.core import Settings, VectorStoreIndex, StorageContext, load_index_from_storage
    from llama_index.core.llms import CustomLLM
    from llama_index.core.llms.llm import LLM
    from llama_index.core.llms import ChatMessage, MessageRole, CompletionResponse, LLMMetadata
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

# 로컬 FAISS 벡터 DB 경로
LOCAL_FAISS_DIR = "/data/vector_db/welno/faiss_db"
LOCAL_FAISS_INDEX_PATH = f"{LOCAL_FAISS_DIR}/faiss.index"
LOCAL_FAISS_METADATA_PATH = f"{LOCAL_FAISS_DIR}/metadata.pkl"

# 임베딩 모델·차원 (병원별 확장 시 동일 값 유지로 호환)
EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_DIMENSION = 1536

# 병원별 FAISS 루트 (전역과 분리, 병원 RAG 우선용)
LOCAL_FAISS_BY_HOSPITAL = os.environ.get("LOCAL_FAISS_BY_HOSPITAL", "/data/vector_db/welno/faiss_db_by_hospital")

# 로컬 FAISS 엔진 캐시
_rag_engine_local_cache: Optional[Any] = None


def _patch_docstore_aget_nodes():
    """
    llama_index 버그 패치: BaseDocumentStore.aget_nodes()에서
    raise_error=False 분기가 aget_node()에 raise_error를 전달하지 않는 문제 수정.
    FAISS orphaned node가 있을 때 전체 검색이 실패하는 것을 방지.
    """
    try:
        from llama_index.core.storage.docstore.types import BaseDocumentStore
        import inspect

        original = BaseDocumentStore.aget_nodes
        src = inspect.getsource(original)
        if "aget_node(node_id)" in src and "raise_error=raise_error" not in src.split("else:")[-1]:
            async def patched_aget_nodes(self, node_ids, raise_error=True):
                results = []
                for node_id in node_ids:
                    try:
                        node = await self.aget_node(node_id, raise_error=raise_error)
                        if node is not None:
                            results.append(node)
                    except ValueError:
                        if raise_error:
                            raise
                        # orphaned node — skip silently
                        continue
                return results

            BaseDocumentStore.aget_nodes = patched_aget_nodes
            print("[INFO] ✅ docstore.aget_nodes orphaned-node 패치 적용 완료")
    except Exception as e:
        print(f"[WARN] docstore 패치 실패 (서비스에는 영향 없음): {e}")

_patch_docstore_aget_nodes()

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

CHAT_SYSTEM_PROMPT_TEMPLATE = (
    "당신은 검진 결과지를 읽어 드리는 {persona_name}입니다.\n"
    "\n"
    "⚠️ **핵심 규칙**:\n"
    "1. 당신은 의료인이 아닙니다. '검진 결과지를 읽어 드리는 에이전트'입니다.\n"
    "2. [Context]에 없는 정보는 생성하지 마세요.\n"
    "3. 사용자가 언급한 증상만 다루세요 (추측 금지).\n"
    "4. 높다/낮다/이상 등은 검진기관이 설정한 기준치 또는 일반적 참고 범위 기준으로만 설명합니다. "
    "'이 수치는 검진기관 기준으로 정상 범위를 벗어나 있어요' 형태로 안내하세요.\n"
    "5. 의학적 진단, 처방, 약물 추천은 절대 하지 마세요. "
    "'자세한 내용은 담당 의료진과 상담하시길 권해요 😊' 로 안내하세요.\n"
    "6. 검진 데이터가 없거나 0인 항목은 "
    "'해당 검사 결과를 불러오지 못했어요. 검진받으신 병원에 결과지를 요청해 보시는 것도 좋을 것 같아요 😊' 로 안내하세요.\n"
    "7. 생년월일이 1900-01-01 등 비정상이면 나이 언급을 하지 마세요.\n"
    "8. 주민번호, 카드번호 등 민감정보가 입력되면 "
    "'개인정보는 채팅에 입력하지 않는 것이 안전해요! 🔒' 경고 후 본래 질문으로 유도하세요.\n"
    "9. 불확실한 정보는 추측하지 말고 명확히 표현하세요.\n"
    "\n"
    "💡 **답변 스타일**:\n"
    "- [Context]에 환자 건강 데이터가 있으면 간단히 언급하며 시작\n"
    "- '지침서에 따르면' 같은 부연 설명 생략, 읽기 쉽게 답변\n"
    "- 핵심 위주로 요약, 실천 방법은 불렛 포인트\n"
    "- 근거 문서 언급 불필요 (프론트엔드에서 표시)\n"
    "- 이모지를 가볍게 사용하여 친근한 톤을 유지하세요 (😊🩺💪📋 등 1-2개/응답)\n"
    "\n"
    "🔗 **답변 구조** (2단계):\n"
    "1단계: 사용자 질문에 직접 답변 (먼저)\n"
    "2단계: 의학 문서에 연관성 명시 시에만 과거 데이터 언급 (나중에)\n"
    "   - 출처 명시: \"2021년 검진\", \"복약 내역\", \"이전 문진\"\n"
    "   - 자연스러운 전환어 사용: \"참고로\", \"그런데\", \"다만\"\n"
    "   예: \"체중 관리는... (답변) 참고로, 2021년 검진에서 체중 증가 시 혈압도 상승했습니다.\"\n"
    "\n"
    "📋 **데이터 확인**:\n"
    "- 사용자 말과 기존 데이터(검진/복약/문진)가 다를 때 확인 질문\n"
    "  예: \"2021년 검진에서 체중 감소 추세였는데, 최근 상태는 어떤가요?\"\n"
    "- 시스템이 직접 묻는 방식으로 표현\n"
    "\n"
    "🏥 **안내 유도**:\n"
    "- 복잡한 증상은 '담당 의료진과 상담하시길 권해요 😊'로 안내\n"
    "- 병원에서 설정한 기준치와 일반적인 참고 범위를 기준으로 안내해 드려요\n"
    "\n"
    "🚫 **금지어**: '메디링스', 'MediLinx', 'Dr. Welno', '건강 상담가', '상담사', '전문가' 등 의료인 느낌 표현 금지\n"
    "\n"
    "[Context]\n"
    "{context_str}\n"
    "\n"
    "사용자 질문: {query_str}\n"
    "도우미 답변:"
)

async def init_rag_engine(use_local_vector_db: bool = True):
    """
    RAG Query Engine 초기화
    
    Args:
        use_local_vector_db: True면 로컬 FAISS 벡터 DB 사용 (비용 절감, 빠른 응답, 기본값)
                            False면 로컬 FAISS API 사용
    """
    global _rag_engine_local_cache
    
    # 캐시 확인
    if use_local_vector_db:
        if _rag_engine_local_cache is not None:
            print("[INFO] 로컬 FAISS 엔진 캐시 사용")
            return _rag_engine_local_cache
    if not LLAMAINDEX_AVAILABLE:
        print("[WARN] LlamaIndex 라이브러리가 설치되지 않았습니다.")
        return None
    
    try:
        # ===== 로컬 FAISS 벡터 DB 사용 =====
        if use_local_vector_db:
            if not FAISS_AVAILABLE:
                print("[WARN] 로컬 FAISS를 사용할 수 없습니다.")
                return None
            else:
                print("[INFO] 로컬 FAISS 벡터 DB 초기화 중...")
                
                # FAISS 인덱스 로드
                if not PathLib(LOCAL_FAISS_INDEX_PATH).exists():
                    print(f"[WARN] FAISS 인덱스 파일을 찾을 수 없습니다: {LOCAL_FAISS_INDEX_PATH}")
                    print("[WARN] 로컬 FAISS를 사용할 수 없습니다.")
                    return None
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
                            print("[WARN] 로컬 FAISS를 사용할 수 없습니다.")
                            return None
                        else:
                            embed_model = OpenAIEmbedding(
                                model=EMBEDDING_MODEL,
                                api_key=openai_api_key
                            )
                            Settings.embed_model = embed_model
                            
                            # Gemini LLM 설정 (답변 생성용)
                            gemini_api_key = os.environ.get("GOOGLE_GEMINI_API_KEY") or settings.google_gemini_api_key
                            if not gemini_api_key or gemini_api_key == "dev-gemini-key":
                                print("[WARN] Google Gemini API 키가 설정되지 않았습니다.")
                                print("[WARN] 로컬 FAISS를 사용할 수 없습니다.")
                                return None
                            elif not GEMINI_AVAILABLE or not genai:
                                print("[WARN] Google Gemini가 사용 불가능합니다.")
                                print("[WARN] 로컬 FAISS를 사용할 수 없습니다.")
                                return None
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
                                # 파트너 정보를 위해 persona_name을 기본값으로 채운 템플릿 사용
                                # (나중에 query 시점에 다시 바꿀 수도 있지만 초기화 시점에 기본 설정)
                                default_persona = "검진 결과 에이전트"
                                system_prompt = CHAT_SYSTEM_PROMPT_TEMPLATE.format(
                                    persona_name=default_persona,
                                    context_str="{context_str}",
                                    query_str="{query_str}"
                                )
                                
                                query_engine = index.as_query_engine(
                                    similarity_top_k=10,
                                    response_mode="compact",
                                    text_qa_template=PromptTemplate(system_prompt)
                                )
                                
                                _rag_engine_local_cache = query_engine
                                print(f"[INFO] ✅ 로컬 FAISS RAG 엔진 초기화 완료 (벡터: {faiss_index.ntotal}개, 문서: {total_docs}개)")
                                
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
        
        # 검색 실행 - aretrieve() 사용 (벡터 검색만, LLM 응답 생성 제거)
        nodes = await query_engine.aretrieve(final_query)
        
        # 결과 처리 - source_nodes에서 직접 추출
        structured_evidences = []
        for node in nodes:
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
            
            structured_evidences.append({
                "source_document": file_name,
                "page": page_label,
                "citation": citation,
                "full_text": text,
                "confidence_score": score,
                "organization": "의학회",
                "year": "2024"
            })
        
        # 각 에비던스에 쿼리 맥락 추가
        for ev in structured_evidences:
            ev['query'] = final_query
            ev['category'] = 'Clinical Guideline'
        
        # structured_evidences를 context_text로 포맷팅 (LLM 응답 대신 원본 문서 사용)
        # 간단한 포맷팅 (순환 import 방지)
        context_text = ""
        if structured_evidences:
            formatted_parts = []
            for idx, ev in enumerate(structured_evidences[:5], 1):  # 상위 5개만
                doc_name = ev.get('source_document', '문서명 없음')
                citation = ev.get('citation', '')
                if citation:
                    formatted_parts.append(f"{idx}. [{doc_name}]\n\"{citation}\"\n")
            context_text = "\n".join(formatted_parts)
        
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
        use_local_vector_db: True면 로컬 FAISS 사용, 로컬 FAISS 벡터 DB 사용 여부
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
        # 검색만 수행 (LLM 응답 합성 없이 소스만 반환 → 속도 대폭 개선)
        nodes = await query_engine.aretrieve(query)
        
        sources = []
        for node in nodes:
            source_info = {
                "text": clean_html_content(node.text)[:500] if hasattr(node, 'text') else "",
                "score": float(node.score) if hasattr(node, 'score') else None,
                "metadata": node.metadata if hasattr(node, 'metadata') else {}
            }
            sources.append(source_info)
        
        return {
            "success": True,
            "answer": None,
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

async def search_hospital_knowledge(hospital_id: str, query: str, partner_id: str = "welno") -> Dict[str, Any]:
    """
    병원별 RAG 검색 — 병원 전용 인덱스 + 글로벌 인덱스 양쪽 검색.
    병원 인덱스가 있으면 우선 사용하고, 글로벌 인덱스는 항상 검색.
    결과를 score 기반으로 병합하여 반환.
    """
    if not query:
        return {"success": False, "sources": []}

    results = []

    # 1. 병원별 인덱스 검색 (있으면)
    if hospital_id:
        hospital_results = await _search_hospital_faiss(hospital_id, query)
        if hospital_results:
            results.extend(hospital_results)

    # 2. 글로벌 인덱스 검색 (항상)
    global_results = await search_checkup_knowledge(query)
    if global_results.get("success") and global_results.get("sources"):
        for src in global_results["sources"]:
            results.append({
                "text": src.get("text", ""),
                "score": src.get("score", 0.0),
                "metadata": src.get("metadata", {}),
                "source_type": "global"
            })

    if not results:
        return {"success": False, "sources": []}

    # 3. 점수 기반 정렬 + 상위 10개 반환
    results.sort(key=lambda x: x.get("score") or 0, reverse=True)
    top_results = results[:10]

    return {
        "success": True,
        "answer": None,  # answer는 호출자가 LLM으로 생성
        "sources": top_results,
        "query": query
    }


async def _search_hospital_faiss(hospital_id: str, query: str) -> List[Dict[str, Any]]:
    """병원 전용 FAISS 인덱스 검색 (내부 헬퍼)"""
    if not hospital_id:
        return []
    hospital_dir = PathLib(LOCAL_FAISS_BY_HOSPITAL) / hospital_id
    # faiss 바이너리 또는 LlamaIndex 메타데이터 존재 확인
    faiss_binary = hospital_dir / "faiss.index"
    index_store = hospital_dir / "index_store.json"
    if not faiss_binary.exists() and not index_store.exists():
        return []
    if not FAISS_AVAILABLE:
        return []
    openai_api_key = os.environ.get("OPENAI_API_KEY") or settings.openai_api_key
    if not openai_api_key or openai_api_key == "dev-openai-key":
        return []
    try:
        embed_model = OpenAIEmbedding(model=EMBEDDING_MODEL, api_key=openai_api_key)
        Settings.embed_model = embed_model
        vector_store = FaissVectorStore.from_persist_dir(str(hospital_dir))
        from llama_index.core.storage.docstore import SimpleDocumentStore
        from llama_index.core.storage.index_store import SimpleIndexStore
        docstore = SimpleDocumentStore.from_persist_dir(str(hospital_dir))
        index_store = SimpleIndexStore.from_persist_dir(str(hospital_dir))
        storage_context = StorageContext.from_defaults(
            vector_store=vector_store,
            docstore=docstore,
            index_store=index_store,
        )
        try:
            index = load_index_from_storage(storage_context)
        except ValueError as e:
            if "Please specify index_id" in str(e):
                index_structs = storage_context.index_store.index_structs()
                index_ids = list(index_structs.keys()) if isinstance(index_structs, dict) else [getattr(s, "index_id", None) for s in (index_structs or []) if hasattr(s, "index_id")]
                if index_ids and index_ids[0]:
                    index = load_index_from_storage(storage_context, index_id=index_ids[0])
                else:
                    return []
            else:
                return []
        retriever = index.as_retriever(similarity_top_k=10)
        nodes = await retriever.aretrieve(query)
        results = []
        for node in nodes:
            results.append({
                "text": clean_html_content(node.text)[:500] if hasattr(node, 'text') else "",
                "score": float(node.score) if hasattr(node, 'score') else 0.0,
                "metadata": node.metadata if hasattr(node, 'metadata') else {},
                "source_type": "hospital"
            })
        return results
    except Exception as e:
        print(f"[ERROR] 병원 RAG 검색 실패 (hospital_id={hospital_id}): {e}")
        return []
