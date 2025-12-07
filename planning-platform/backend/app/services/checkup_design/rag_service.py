"""
RAG (Retrieval-Augmented Generation) 서비스 모듈
LlamaIndex 및 Gemini LLM 기반 의료 지식 검색 엔진
"""
import os
import json
import re
from typing import List, Dict, Any, Optional
from app.core.config import settings

# LlamaIndex RAG 관련 임포트
try:
    from llama_index.core import Settings
    from llama_index.core.llms import CustomLLM
    from llama_index.core.llms.llm import LLM
    from llama_index.core.llms import ChatMessage, MessageRole, CompletionResponse, LLMMetadata
    from llama_index.indices.managed.llama_cloud import LlamaCloudIndex
    from llama_index.llms.openai import OpenAI
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
LLAMACLOUD_INDEX_ID = "cb77bf6b-02a9-486f-9718-4ffac0d30e73"
LLAMACLOUD_PROJECT_ID = "45c4d9d4-ce6b-4f62-ad88-9107fe6de8cc"
LLAMACLOUD_ORGANIZATION_ID = "e4024539-3d26-48b5-8051-9092380c84d2"

# 전역 RAG 엔진 캐시
_rag_engine_cache: Optional[Any] = None

# Gemini CustomLLM 클래스
class GeminiLLM(CustomLLM):
    """Google Gemini를 LlamaIndex CustomLLM으로 구현 (RAG 검색용)"""
    
    def __init__(self, api_key: str, model: str = "gemini-2.0-flash", **kwargs):
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

async def init_rag_engine():
    """LlamaCloud 기반 RAG Query Engine 초기화"""
    global _rag_engine_cache
    
    if _rag_engine_cache is not None:
        return _rag_engine_cache
    
    if not LLAMAINDEX_AVAILABLE:
        print("[WARN] LlamaIndex 라이브러리가 설치되지 않았습니다.")
        return None
    
    try:
        llamaindex_api_key = os.environ.get("LLAMAINDEX_API_KEY") or settings.llamaindex_api_key
        gemini_api_key = os.environ.get("GOOGLE_GEMINI_API_KEY") or settings.google_gemini_api_key
        
        if not llamaindex_api_key or not gemini_api_key:
            print("[WARN] API 키가 설정되지 않았습니다.")
            return None
        
        if not GEMINI_AVAILABLE or not genai:
            return None
        
        llm = GeminiLLM(api_key=gemini_api_key, model="gemini-2.0-flash")
        Settings.llm = llm
        
        index = LlamaCloudIndex(
            index_id=LLAMACLOUD_INDEX_ID,
            api_key=llamaindex_api_key
        )
        
        query_engine = index.as_query_engine(
            similarity_top_k=5,
            response_mode="tree_summarize"
        )
        
        _rag_engine_cache = query_engine
        print(f"[INFO] RAG 엔진 초기화 완료 (Index ID: {LLAMACLOUD_INDEX_ID})")
        return query_engine
        
    except Exception as e:
        print(f"[ERROR] RAG 엔진 초기화 중 오류: {str(e)}")
        return None

def clean_html_content(text: str) -> str:
    """
    RAG 검색 결과(PDF 파싱 텍스트)에 포함된 HTML 태그를 제거하고 
    가독성 있는 텍스트로 정제합니다.
    """
    if not text:
        return ""
    
    try:
        # 1. HTML Table 태그를 구조적 텍스트로 변환 시도
        # </tr> -> 줄바꿈
        text = re.sub(r'</tr>', '\n', text, flags=re.IGNORECASE)
        # </td>, </th> -> 구분자 ( | )
        text = re.sub(r'</td>', ' | ', text, flags=re.IGNORECASE)
        text = re.sub(r'</th>', ' | ', text, flags=re.IGNORECASE)
        # <br> -> 줄바꿈
        text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
        
        # 2. 나머지 HTML 태그 제거
        text = re.sub(r'<[^>]+>', '', text)
        
        # 3. 마크다운 테이블 문법 보정 (파이프가 연속될 경우 정리)
        text = re.sub(r'\|\s*\|', '|', text)
        
        # 4. 다중 공백/줄바꿈 정리
        text = re.sub(r'\n\s*\n', '\n', text) # 과도한 줄바꿈 제거
        text = re.sub(r' +', ' ', text) # 과도한 공백 제거
        
        return text.strip()
    except Exception as e:
        print(f"[WARN] HTML 정제 중 오류: {str(e)}")
        return text

def extract_evidence_from_source_nodes(response) -> List[Dict[str, Any]]:
    """LlamaIndex 응답에서 소스 노드 메타데이터 추출"""
    evidences = []
    if hasattr(response, 'source_nodes'):
        for node in response.source_nodes:
            metadata = node.metadata if hasattr(node, 'metadata') else {}
            text = node.text if hasattr(node, 'text') else ""
            
            # [CRITICAL] HTML 태그 정제 (Table Cleaning)
            text = clean_html_content(text)
            
            score = node.score if hasattr(node, 'score') else 0.0
            
            # 메타데이터 추출 (파일명, 페이지 등)
            file_name = metadata.get('file_name', 'Unknown')
            page_label = metadata.get('page_label', 'Unknown')
            
            # 인용구 추출 (간단히 첫 문장 등)
            citation = text[:100] + "..." if len(text) > 100 else text
            
            evidences.append({
                "source_document": file_name,
                "page": page_label,
                "citation": citation,
                "full_text": text,
                "confidence_score": score,
                "organization": "의학회", # 메타데이터 없을 시 기본값
                "year": "2024" # 메타데이터 없을 시 기본값
            })
    return evidences

async def get_medical_evidence_from_rag(query_engine, patient_context: Dict, concerns: List[Dict]) -> Dict[str, Any]:
    """
    환자 정보와 염려 사항을 기반으로 RAG 검색 수행
    """
    if not query_engine:
        return {"context_text": "", "structured_evidences": []}
    
    try:
        # 검색 쿼리 구성 (임상적 맥락 포함)
        query_parts = []
        
        # 1. 나이/성별 기반 가이드라인
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



