"""
RAG (Retrieval-Augmented Generation) 서비스 모듈
FAISS 직접 호출 + OpenAI 임베딩 기반 의료 지식 검색 엔진

llama-index 의존성 제거 — FAISSVectorSearch 직접 사용
"""
import os
import re
import logging
from collections import OrderedDict
from pathlib import Path
from typing import List, Dict, Any, Optional
from ...core.config import settings
from .vector_search import FAISSVectorSearch

logger = logging.getLogger(__name__)

# 상수 정의
LOCAL_FAISS_DIR = "/data/vector_db/welno/faiss_db"
EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_DIMENSION = 1536
LOCAL_FAISS_BY_HOSPITAL = os.environ.get(
    "LOCAL_FAISS_BY_HOSPITAL", "/data/vector_db/welno/faiss_db_by_hospital"
)

# 글로벌 + 병원별 FAISSVectorSearch 캐시
_global_vs_cache: Optional[FAISSVectorSearch] = None
_hospital_vs_cache: OrderedDict = OrderedDict()  # LRU 캐시 (OOM 방지)
MAX_HOSPITAL_CACHE = 5  # 병원별 FAISS 인스턴스 최대 개수

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


def _get_openai_api_key() -> Optional[str]:
    """OpenAI API 키 반환 (없거나 dev 키면 None)."""
    key = os.environ.get("OPENAI_API_KEY") or settings.openai_api_key
    if not key or key == "dev-openai-key":
        return None
    return key


async def init_rag_engine(use_local_vector_db: bool = True):
    """
    FAISSVectorSearch 인스턴스 반환 (캐시됨).
    기존 호출부와의 호환을 위해 async 시그니처 유지.
    """
    global _global_vs_cache

    if _global_vs_cache is not None:
        return _global_vs_cache

    openai_api_key = _get_openai_api_key()
    if not openai_api_key:
        logger.warning("OPENAI_API_KEY가 설정되지 않았습니다.")
        return None

    faiss_index_path = f"{LOCAL_FAISS_DIR}/faiss.index"
    if not Path(faiss_index_path).exists():
        logger.warning(f"FAISS 인덱스 파일 없음: {faiss_index_path}")
        return None

    try:
        vs = FAISSVectorSearch(
            faiss_dir=LOCAL_FAISS_DIR,
            openai_api_key=openai_api_key,
            embedding_model=EMBEDDING_MODEL,
        )
        _global_vs_cache = vs
        return vs
    except Exception as e:
        logger.error(f"RAG 엔진 초기화 오류: {e}")
        import traceback
        traceback.print_exc()
        return None


def clean_html_content(text: str) -> str:
    """HTML 태그를 제거하고 텍스트를 정리합니다."""
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def extract_evidence_from_source_nodes(results: List[Dict]) -> List[Dict[str, Any]]:
    """검색 결과에서 소스 메타데이터 추출."""
    evidences = []
    for r in results:
        text = clean_html_content(r.get("text", ""))
        metadata = r.get("metadata", {})
        score = r.get("score", 0.0)
        file_name = metadata.get('file_name', 'Unknown')
        page_label = metadata.get('page_label', 'Unknown')
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


async def get_medical_evidence_from_rag(
    query_engine, patient_context: Dict, concerns: List[Dict]
) -> Dict[str, Any]:
    """환자 정보와 염려 사항을 기반으로 RAG 검색 수행."""
    if not query_engine:
        return {"context_text": "", "structured_evidences": []}

    try:
        query_parts = []
        age = patient_context.get('age', 40)
        gender = patient_context.get('gender', 'unknown')
        query_parts.append(f"{age}세 {gender}에게 권장되는 필수 건강검진 항목과 암 선별검사 기준")

        for item in patient_context.get('abnormal_items', []):
            name = item.get('name', '')
            status = item.get('status', '')
            if name:
                query_parts.append(f"{name} 수치가 {status}일 때 필요한 정밀 검사와 임상적 의의")

        for fh in patient_context.get('family_history', []):
            query_parts.append(f"{fh} 가족력이 있을 때 권장되는 조기 선별검사")

        for concern in concerns:
            c_name = concern.get('name', '')
            if c_name:
                query_parts.append(f"{c_name} 관련 최신 진료지침과 검사 권고안")

        final_query = " \n".join(query_parts)
        logger.info(f"RAG 검색 쿼리 생성: {len(final_query)}자")

        # FAISSVectorSearch.search() 호출
        nodes = query_engine.search(final_query, top_k=10)

        structured_evidences = []
        for r in nodes:
            text = clean_html_content(r.get("text", ""))
            metadata = r.get("metadata", {})
            score = r.get("score", 0.0)
            file_name = metadata.get('file_name', 'Unknown')
            page_label = metadata.get('page_label', 'Unknown')
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

        for ev in structured_evidences:
            ev['query'] = final_query
            ev['category'] = 'Clinical Guideline'

        context_text = ""
        if structured_evidences:
            formatted_parts = []
            for idx, ev in enumerate(structured_evidences[:5], 1):
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
        logger.error(f"RAG 검색 실행 실패: {e}")
        return {"context_text": "", "structured_evidences": []}


async def search_checkup_knowledge(
    query: str, use_local_vector_db: bool = True
) -> Dict[str, Any]:
    """검진 지식 검색 (RAG)."""
    vs = await init_rag_engine(use_local_vector_db=use_local_vector_db)
    if not vs:
        return {"success": False, "error": "RAG 엔진 초기화 실패", "answer": None, "sources": []}

    try:
        results = vs.search(query, top_k=10)
        sources = []
        for r in results:
            sources.append({
                "text": clean_html_content(r.get("text", ""))[:500],
                "score": r.get("score"),
                "metadata": r.get("metadata", {}),
            })
        return {"success": True, "answer": None, "sources": sources, "query": query}

    except Exception as e:
        logger.error(f"RAG 검색 중 오류: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e), "answer": None, "sources": []}


async def search_hospital_knowledge(
    hospital_id: str, query: str, partner_id: str = "welno"
) -> Dict[str, Any]:
    """
    병원별 RAG 검색 — 병원 전용 인덱스 + 글로벌 인덱스 양쪽 검색.
    결과를 score 기반으로 병합하여 반환.
    """
    if not query:
        return {"success": False, "sources": []}

    results = []

    # 1. 병원별 인덱스 검색
    if hospital_id:
        hospital_results = await _search_hospital_faiss(hospital_id, query)
        if hospital_results:
            results.extend(hospital_results)

    # 2. 글로벌 인덱스 검색
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

    results.sort(key=lambda x: x.get("score") or 0, reverse=True)
    return {
        "success": True,
        "answer": None,
        "sources": results[:10],
        "query": query,
    }


async def _search_hospital_faiss(
    hospital_id: str, query: str
) -> List[Dict[str, Any]]:
    """병원 전용 FAISS 인덱스 검색 (내부 헬퍼)."""
    if not hospital_id:
        return []

    hospital_dir = Path(LOCAL_FAISS_BY_HOSPITAL) / hospital_id
    faiss_binary = hospital_dir / "faiss.index"
    index_store_path = hospital_dir / "index_store.json"
    if not faiss_binary.exists() and not index_store_path.exists():
        return []

    openai_api_key = _get_openai_api_key()
    if not openai_api_key:
        return []

    try:
        # LRU 캐시: 히트 시 최신으로 이동, 초과 시 가장 오래된 항목 제거
        if hospital_id in _hospital_vs_cache:
            _hospital_vs_cache.move_to_end(hospital_id)
        else:
            if len(_hospital_vs_cache) >= MAX_HOSPITAL_CACHE:
                evicted_id, _ = _hospital_vs_cache.popitem(last=False)
                logger.info(f"병원 FAISS 캐시 LRU 제거: {evicted_id} (현재 {len(_hospital_vs_cache)}/{MAX_HOSPITAL_CACHE})")
            _hospital_vs_cache[hospital_id] = FAISSVectorSearch(
                faiss_dir=str(hospital_dir),
                openai_api_key=openai_api_key,
                embedding_model=EMBEDDING_MODEL,
            )
        vs = _hospital_vs_cache[hospital_id]
        raw = vs.search(query, top_k=10)
        results = []
        for r in raw:
            results.append({
                "text": clean_html_content(r.get("text", ""))[:500],
                "score": r.get("score", 0.0),
                "metadata": r.get("metadata", {}),
                "source_type": "hospital",
            })
        return results
    except Exception as e:
        logger.error(f"병원 RAG 검색 실패 (hospital_id={hospital_id}): {e}")
        return []
