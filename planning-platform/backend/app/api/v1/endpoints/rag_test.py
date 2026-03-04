"""
RAG 테스트용 간단 엔드포인트
- FAISS 직접 호출 기반 벡터 검색 + Gemini LLM 답변
- 사용자 질문을 벡터 인덱스에 검색하여 에비던스 반환
"""
import asyncio
import time
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any

from app.services.checkup_design import init_rag_engine
from app.services.checkup_design.rag_service import (
    extract_evidence_from_source_nodes,
    clean_html_content,
)

router = APIRouter()


async def _gemini_complete(api_key: str, prompt: str, model: str = "gemini-2.0-flash") -> str:
    """Gemini API 직접 호출 (llama-index 의존 없이)."""
    from google import genai

    client = genai.Client(api_key=api_key)
    resp = await client.aio.models.generate_content(model=model, contents=prompt)
    return resp.text if hasattr(resp, "text") else str(resp)


@router.get("/rag/test", summary="RAG 테스트용 쿼리 실행", tags=["rag-test"])
async def rag_test(
    q: str = Query(..., description="RAG 테스트용 질문 (그대로 벡터 인덱스에 전달)"),
):
    """
    간단한 RAG 테스트 엔드포인트.
    FAISSVectorSearch로 검색 → Gemini LLM으로 답변 생성
    """
    start_time = time.time()
    timing: Dict[str, float] = {}

    # 1. RAG 엔진 초기화 (FAISSVectorSearch 캐시)
    init_start = time.time()
    vector_search = await init_rag_engine(use_local_vector_db=True)
    timing['engine_init'] = time.time() - init_start

    if not vector_search:
        raise HTTPException(
            status_code=503,
            detail="RAG 엔진을 초기화할 수 없습니다. (API 키 또는 FAISS 인덱스 확인 필요)",
        )

    try:
        query_start = time.time()

        # 2-1. 질문 의도 파악 및 검색 쿼리 생성 (Gemini 직접 호출)
        from app.core.config import settings
        import os

        gemini_api_key = os.environ.get("GOOGLE_GEMINI_API_KEY") or getattr(settings, "google_gemini_api_key", None)
        search_query = q  # 기본값: 원본 질문

        if gemini_api_key:
            try:
                query_understanding_prompt = f"""사용자의 건강 관련 질문을 분석하여 의료 문서 검색에 적합한 검색 쿼리를 생성해주세요.

**규칙:**
1. 사용자 질문의 핵심 의도를 정확히 파악하세요
2. 시간 표현(14일, 1주일 등)은 유지하세요
3. "방법", "해야", "어떻게", "개선" 같은 표현은 유지하세요
4. 의료 용어와 검사 항목명은 정확히 유지하세요
5. 정말 불필요한 감탄사나 접속사만 제거하세요

**사용자 질문:**
{q}

**검색 쿼리만 출력하세요 (설명 없이):**
"""
                generated_query = await _gemini_complete(gemini_api_key, query_understanding_prompt)
                if generated_query and len(generated_query) <= 100:
                    search_query = generated_query.strip()
                    print(f"[INFO] 검색 쿼리 생성: '{q}' → '{search_query}'")
                else:
                    print(f"[INFO] 검색 쿼리 생성 실패, 원본 질문 사용: {q}")
            except Exception as e:
                print(f"[WARN] Gemini 쿼리 생성 실패: {e}, 원본 질문 사용")
        else:
            print(f"[WARN] Gemini API 키 없음, 원본 질문 사용: {q}")

        # 2-2. FAISSVectorSearch로 검색
        retrieved_nodes = vector_search.search(search_query, top_k=10)

        # 검색 결과 품질 체크
        obesity_count = sum(
            1 for r in retrieved_nodes
            if r.get("metadata", {}).get("file_name", "").find("비만") != -1
        )
        if retrieved_nodes and obesity_count >= len(retrieved_nodes) * 0.6:
            print(f"[WARN] 검색 결과의 {obesity_count}/{len(retrieved_nodes)}개가 비만 관련입니다.")

        # 2-3. LLM 관련성 판단 + 에비던스 구성
        MIN_RELEVANCE_SCORE = 0.3
        relevant_indices = set(range(min(5, len(retrieved_nodes))))

        if retrieved_nodes and gemini_api_key:
            file_names = [r.get("metadata", {}).get("file_name", "Unknown") for r in retrieved_nodes[:5]]
            relevance_prompt = f"""다음 문서들이 사용자 질문과 관련이 있는지 판단해주세요.

**사용자 질문:**
{q}

**검색된 문서들:**
{chr(10).join([f"{i+1}. {name}" for i, name in enumerate(file_names)])}

**각 문서에 대해 한 줄씩 "관련" 또는 "무관"만 출력하세요:**
"""
            try:
                relevance_text = await _gemini_complete(gemini_api_key, relevance_prompt)
                relevance_results = relevance_text.strip().split("\n")
                relevant_indices = set()
                for i, result in enumerate(relevance_results):
                    if "관련" in result and "무관" not in result:
                        relevant_indices.add(i)
                print(f"[INFO] LLM 관련성 판단: {len(relevant_indices)}/{len(file_names)}개 관련")
            except Exception as e:
                print(f"[WARN] 관련성 판단 실패: {e}, 모든 문서 사용")
                relevant_indices = set(range(min(5, len(retrieved_nodes))))

        # 에비던스 텍스트 구성
        evidence_texts = []
        filtered_nodes = []
        for idx, r in enumerate(retrieved_nodes):
            score = r.get("score", 0.0)
            if score < MIN_RELEVANCE_SCORE:
                continue
            if idx not in relevant_indices:
                print(f"[INFO] LLM 판단으로 제외: {r.get('metadata', {}).get('file_name', 'Unknown')}")
                continue
            filtered_nodes.append(r)

        for i, r in enumerate(filtered_nodes[:5], 1):
            text = clean_html_content(r.get("text", ""))
            metadata = r.get("metadata", {})
            file_name = metadata.get("file_name", "Unknown")
            page = metadata.get("page_label", "Unknown")
            score = r.get("score", 0.0)
            evidence_texts.append(
                f"[참고 자료 {i}] {file_name} (페이지 {page}, 관련도: {score:.2f})\n{text[:1000]}..."
            )

        # 필터링 후 에비던스가 없으면 상위 3개 사용
        if not evidence_texts:
            print(f"[INFO] 필터링 후 에비던스가 없어 원본 검색 결과 사용 (총 {len(retrieved_nodes)}개)")
            for i, r in enumerate(retrieved_nodes[:3], 1):
                text = clean_html_content(r.get("text", ""))
                metadata = r.get("metadata", {})
                file_name = metadata.get("file_name", "Unknown")
                page = metadata.get("page_label", "Unknown")
                score = r.get("score", 0.0)
                evidence_texts.append(
                    f"[참고 자료 {i}] {file_name} (페이지 {page}, 관련도: {score:.2f})\n{text[:1000]}..."
                )

        # 2-4. LLM 답변 생성
        if evidence_texts:
            enhanced_prompt = f"""당신은 전문 건강상담사입니다. 아래 참고 자료를 바탕으로 질문에 상세하게 답변해주세요.

**답변 요구사항:**
1. 한글로만 답변하세요.
2. 참고 자료에 구체적인 검사 항목, 수치, 기준이 있으면 포함하세요.
3. 참고 자료가 질문과 관련 없으면 "참고 자료에는 해당 정보가 없지만, 일반적으로..."로 시작하세요.
4. 최소 4-6문단 이상의 상세한 답변을 작성하세요.

**참고 자료:**
{chr(10).join(evidence_texts)}

**사용자 질문:**
{q}

위 질문에 대해 참고 자료를 포함하여 상세하게 한글로 답변해주세요."""
        else:
            enhanced_prompt = f"다음 질문에 대해 한글로 상세하고 전문적으로 답변해주세요:\n\n{q}"

        context_text = ""
        if gemini_api_key:
            context_text = await _gemini_complete(gemini_api_key, enhanced_prompt)
        else:
            context_text = "Gemini API 키가 설정되지 않아 LLM 답변을 생성할 수 없습니다."

        timing['query_execution'] = time.time() - query_start

        # 3. 결과 처리
        process_start = time.time()

        structured_evidences = []
        for idx, r in enumerate(retrieved_nodes[:5], 1):
            metadata = r.get("metadata", {})
            text = clean_html_content(r.get("text", ""))
            score = r.get("score", 0.0)
            file_name = metadata.get("file_name", "Unknown")
            page_label = metadata.get("page_label", "Unknown")
            citation = text[:300] + "..." if len(text) > 300 else text
            first_sentence = text.split(".")[0] + "." if "." in text else text[:100]

            category = "일반"
            for keyword, cat in [("비만", "비만 관리"), ("구강", "구강 건강"), ("영양", "영양 상태"),
                                  ("검진", "건강검진"), ("암", "암 예방"), ("고혈압", "고혈압 관리")]:
                if keyword in file_name or keyword in text[:200]:
                    category = cat
                    break

            structured_evidences.append({
                "source_document": file_name,
                "page": page_label,
                "citation": citation,
                "summary": first_sentence,
                "full_text": text,
                "confidence_score": score,
                "relevance": "높음" if score >= 0.5 else "보통" if score >= 0.35 else "낮음",
                "category": category,
                "organization": "의학회",
                "year": "2024",
                "order": idx,
            })

        for ev in structured_evidences:
            ev["query"] = q
            ev["category"] = "Health Consultation"

        timing['result_processing'] = time.time() - process_start
        timing['total'] = time.time() - start_time

        return {
            "context_text": context_text,
            "structured_evidences": structured_evidences,
            "original_query": q,
            "timing": timing,
            "debug": {
                "search_type": "FAISSVectorSearch",
                "retrieved_count": len(retrieved_nodes),
                "response_length": len(context_text),
                "response_preview": context_text[:200] if context_text else "",
            },
            "performance": {
                "total_seconds": round(timing["total"], 2),
                "engine_init_seconds": round(timing["engine_init"], 2),
                "query_execution_seconds": round(timing["query_execution"], 2),
                "result_processing_seconds": round(timing["result_processing"], 2),
                "evidence_count": len(structured_evidences),
                "total_retrieved": len(retrieved_nodes),
            },
        }
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="RAG 검색이 시간 초과되었습니다. (30초 초과)")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG 검색 중 오류가 발생했습니다: {str(e)}")


@router.get("/rag/diagnose", summary="RAG 시스템 진단", tags=["rag-test"])
async def rag_diagnose() -> Dict[str, Any]:
    """RAG 시스템 상태 진단 엔드포인트"""
    start_time = time.time()
    diagnosis: Dict[str, Any] = {
        "status": "checking",
        "timing": {},
        "index_info": {},
        "sample_query": {},
    }

    try:
        # 1. 엔진 초기화 시간 측정
        init_start = time.time()
        vector_search = await init_rag_engine(use_local_vector_db=True)
        diagnosis["timing"]["engine_init"] = round(time.time() - init_start, 3)

        if not vector_search:
            diagnosis["status"] = "error"
            diagnosis["error"] = "RAG 엔진 초기화 실패"
            return diagnosis

        # 2. 인덱스 정보
        diagnosis["index_info"] = {
            "type": "FAISSVectorSearch",
            "total_vectors": vector_search.index.ntotal,
            "dimension": vector_search.index.d,
            "docstore_size": len(vector_search.docstore),
        }

        # 3. 샘플 쿼리 실행
        sample_query = "건강검진이란 무엇인가요?"
        query_start = time.time()

        try:
            results = vector_search.search(sample_query, top_k=5)
            query_time = time.time() - query_start

            diagnosis["sample_query"] = {
                "query": sample_query,
                "execution_time": round(query_time, 3),
                "result_count": len(results),
                "top_score": results[0].get("score", 0.0) if results else 0.0,
                "top_file": results[0].get("metadata", {}).get("file_name", "N/A") if results else "N/A",
            }
        except Exception as e:
            diagnosis["sample_query"]["error"] = str(e)

        diagnosis["timing"]["total"] = round(time.time() - start_time, 3)
        diagnosis["status"] = "success"

        if diagnosis["timing"]["engine_init"] > 1.0:
            diagnosis["performance_issues"] = ["엔진 초기화가 느림 (>1초)"]

        return diagnosis

    except Exception as e:
        diagnosis["status"] = "error"
        diagnosis["error"] = str(e)
        diagnosis["timing"]["total"] = round(time.time() - start_time, 3)
        return diagnosis
