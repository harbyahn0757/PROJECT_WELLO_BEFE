"""
RAG (LlamaCloud) 테스트용 간단 엔드포인트
- 새 Index ID / Project ID 적용 후 동작 확인용
- 사용자 질문을 그대로 벡터 인덱스에 물어봄 (복잡한 변환 없이)
"""
import asyncio
import time
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any

from app.services.checkup_design import init_rag_engine
from app.services.checkup_design.rag_service import extract_evidence_from_source_nodes

router = APIRouter()


@router.get("/rag/test", summary="RAG 테스트용 쿼리 실행", tags=["rag-test"])
async def rag_test(
    q: str = Query(..., description="RAG 테스트용 질문 (그대로 벡터 인덱스에 전달)"),
):
    """
    간단한 RAG 테스트 엔드포인트.

    - LlamaCloudIndex (새 Index ID)로 RAG 엔진을 초기화한 뒤
    - 사용자 질문을 그대로 query_engine에 전달 (복잡한 변환 없이)
    """
    start_time = time.time()
    timing: Dict[str, float] = {}
    
    # 1. RAG 엔진 초기화 (로컬 FAISS 사용 - 테스트용)
    init_start = time.time()
    query_engine = await init_rag_engine(use_local_vector_db=True)  # ✅ 로컬 FAISS 사용
    timing['engine_init'] = time.time() - init_start
    
    if not query_engine:
        raise HTTPException(status_code=503, detail="RAG 엔진을 초기화할 수 없습니다. (API 키 또는 LlamaIndex 설정 확인 필요)")

    # 2. RAG 검색: 먼저 에비던스를 검색하고, 이를 프롬프트에 포함
    try:
        query_start = time.time()
        
        # 2-1. 질문 의도 파악 및 검색 쿼리 생성 (LLM 사용 - 하드코딩 없이)
        from app.services.checkup_design.rag_service import GeminiLLM
        from app.core.config import settings
        import os
        
        gemini_api_key = os.environ.get("GOOGLE_GEMINI_API_KEY") or settings.google_gemini_api_key
        query_llm = None
        if gemini_api_key:
            query_llm = GeminiLLM(api_key=gemini_api_key, model="gemini-3-flash-preview")
            
            # 질문 의도 파악 및 검색 쿼리 생성 프롬프트
            query_understanding_prompt = f"""사용자의 건강 관련 질문을 분석하여 의료 문서 검색에 적합한 검색 쿼리를 생성해주세요.

**규칙:**
1. 사용자 질문의 핵심 의도를 정확히 파악하세요
2. 시간 표현(14일, 1주일 등)은 사용자가 플랜이나 행동 계획을 원하는 의도이므로 유지하세요
3. "방법", "해야", "어떻게", "개선" 같은 표현은 사용자의 행동 계획 의도를 나타내므로 유지하세요
4. 의료 용어와 검사 항목명은 정확히 유지하세요
5. 정말 불필요한 감탄사나 접속사만 제거하세요 (예: "그런데", "아", "음", "그래서" 등)
6. 검색 쿼리는 사용자의 의도를 최대한 보존하면서 간결하게 작성하세요

**사용자 질문:**
{q}

**검색 쿼리만 출력하세요 (설명 없이):**
"""
            
            query_understanding_response = await query_llm.acomplete(query_understanding_prompt)
            search_query = query_understanding_response.text.strip() if hasattr(query_understanding_response, 'text') else str(query_understanding_response).strip()
            
            # 응답이 비어있거나 너무 길면 원본 질문 사용
            if not search_query or len(search_query) > 100:
                search_query = q
                print(f"[INFO] 검색 쿼리 생성 실패, 원본 질문 사용: {q}")
            else:
                print(f"[INFO] 검색 쿼리 생성: '{q}' → '{search_query}'")
        else:
            # Gemini API 키가 없으면 원본 질문 사용
            search_query = q
            print(f"[WARN] Gemini API 키 없음, 원본 질문 사용: {q}")
        
        # 2-2. Query Engine을 사용하여 관련 문서 검색 (에비던스 포함)
        # ✅ LlamaIndex는 이미 관련성 높은 순서대로 정렬하여 반환합니다
        # - similarity_top_k=5 설정으로 벡터 유사도가 높은 상위 5개만 가져옵니다
        # - source_nodes는 이미 score가 높은 순서대로 정렬되어 있습니다
        temp_response = await asyncio.wait_for(
            query_engine.aquery(search_query),
            timeout=30.0
        )
        retrieved_nodes = temp_response.source_nodes if hasattr(temp_response, 'source_nodes') else []
        
        # 검색 결과 품질 체크: 비만 관련 파일이 과도하게 많으면 경고
        obesity_count = sum(1 for node in retrieved_nodes 
                           if hasattr(node, 'metadata') and 
                           node.metadata.get('file_name', '').find('비만') != -1)
        if obesity_count >= len(retrieved_nodes) * 0.6:  # 60% 이상이 비만 관련이면
            print(f"[WARN] 검색 결과의 {obesity_count}/{len(retrieved_nodes)}개가 비만 관련입니다. 검색 쿼리 개선 필요.")
        
        # 2-3. 검색된 에비던스를 프롬프트에 포함 (관련성 높은 것만 사용)
        # ✅ LlamaIndex가 이미 관련성 높은 순서대로 반환했지만,
        # 추가로 최소 관련성 점수 기준으로 필터링 (너무 낮은 것은 제외)
        # - 이미 상위 5개만 가져왔지만, 그 중에서도 0.3 미만은 제외
        MIN_RELEVANCE_SCORE = 0.3
        
        # 2-3-1. 검색된 문서들이 질문과 관련이 있는지 LLM으로 판단 (하드코딩 없이)
        if retrieved_nodes and query_llm:
            # 검색된 문서들의 파일명과 질문을 LLM에 보내서 관련성 판단
            file_names = []
            for node in retrieved_nodes[:5]:
                metadata = node.metadata if hasattr(node, 'metadata') else {}
                file_name = metadata.get('file_name', 'Unknown')
                file_names.append(file_name)
            
            relevance_check_prompt = f"""다음 문서들이 사용자 질문과 관련이 있는지 판단해주세요.

**사용자 질문:**
{q}

**검색된 문서들:**
{chr(10).join([f"{i+1}. {name}" for i, name in enumerate(file_names)])}

**판단 규칙:**
- 질문과 직접적으로 관련이 있는 문서는 "관련"으로 표시
- 질문과 무관한 문서는 "무관"으로 표시
- 각 문서에 대해 한 줄씩 "관련" 또는 "무관"만 출력하세요 (설명 없이)

**출력 형식:**
관련
무관
관련
...
"""
            
            try:
                relevance_response = await query_llm.acomplete(relevance_check_prompt)
                relevance_results = relevance_response.text.strip().split('\n') if hasattr(relevance_response, 'text') else []
                
                # 관련성 판단 결과를 노드에 매핑
                relevant_indices = set()
                for i, result in enumerate(relevance_results):
                    if '관련' in result and '무관' not in result:
                        relevant_indices.add(i)
                
                print(f"[INFO] LLM 관련성 판단: {len(relevant_indices)}/{len(file_names)}개 문서가 관련 있음")
            except Exception as e:
                print(f"[WARN] 관련성 판단 실패: {str(e)}, 모든 문서 사용")
                relevant_indices = set(range(len(retrieved_nodes[:5])))
        else:
            # LLM이 없거나 검색 결과가 없으면 모든 문서 사용
            relevant_indices = set(range(len(retrieved_nodes[:5]))) if retrieved_nodes else set()
        
        evidence_texts = []
        filtered_nodes = []
        for idx, node in enumerate(retrieved_nodes):
            score = node.score if hasattr(node, 'score') else 0.0
            
            # 관련성 점수 필터링
            if score < MIN_RELEVANCE_SCORE:
                continue
            
            # LLM 판단 결과 필터링 (하드코딩 없이)
            if idx not in relevant_indices:
                metadata = node.metadata if hasattr(node, 'metadata') else {}
                file_name = metadata.get('file_name', 'Unknown')
                print(f"[INFO] LLM 판단으로 제외: {file_name} (질문과 무관)")
                continue
            
            filtered_nodes.append(node)
        
        # 필터링된 노드만 사용 (최대 5개)
        for i, node in enumerate(filtered_nodes[:5], 1):
            node_text = node.text if hasattr(node, 'text') else str(node)
            metadata = node.metadata if hasattr(node, 'metadata') else {}
            file_name = metadata.get('file_name', 'Unknown')
            page = metadata.get('page_label', 'Unknown')
            score = node.score if hasattr(node, 'score') else 0.0
            
            # HTML 태그 정제
            from app.services.checkup_design.rag_service import clean_html_content
            node_text = clean_html_content(node_text)
            
            # 에비던스 길이를 1000자로 증가 (중요한 정보 누락 방지)
            evidence_texts.append(f"[참고 자료 {i}] {file_name} (페이지 {page}, 관련도: {score:.2f})\n{node_text[:1000]}...")
        
        # 필터링된 노드 수 로깅
        excluded_count = len(retrieved_nodes) - len(filtered_nodes)
        if excluded_count > 0:
            print(f"[INFO] 관련성 낮은 에비던스 {excluded_count}개 제외 (기준: {MIN_RELEVANCE_SCORE} 이상)")
        
        # 검색 품질 체크: 최고 점수가 너무 낮으면 경고
        max_score = max([node.score if hasattr(node, 'score') else 0.0 for node in retrieved_nodes]) if retrieved_nodes else 0.0
        if max_score < 0.4:
            print(f"[WARN] 검색 결과의 최고 관련성 점수가 낮습니다 (최고: {max_score:.2f}). 검색 쿼리나 인덱스 내용을 확인하세요.")
        
        # 2-3. 에비던스를 포함한 상세 프롬프트 작성
        # 필터링된 에비던스가 없거나 모두 관련이 낮을 때 처리
        if not evidence_texts:
            # 에비던스가 없으면 원본 질문으로 재검색 시도 (필터링 없이)
            print(f"[INFO] 필터링 후 에비던스가 없어 원본 검색 결과 사용 (총 {len(retrieved_nodes)}개)")
            for i, node in enumerate(retrieved_nodes[:3], 1):  # 상위 3개만 사용
                node_text = node.text if hasattr(node, 'text') else str(node)
                metadata = node.metadata if hasattr(node, 'metadata') else {}
                file_name = metadata.get('file_name', 'Unknown')
                page = metadata.get('page_label', 'Unknown')
                score = node.score if hasattr(node, 'score') else 0.0
                
                from app.services.checkup_design.rag_service import clean_html_content
                node_text = clean_html_content(node_text)
                evidence_texts.append(f"[참고 자료 {i}] {file_name} (페이지 {page}, 관련도: {score:.2f})\n{node_text[:1000]}...")
        
        if evidence_texts:
            enhanced_prompt = f"""당신은 전문 건강상담사입니다. 아래 제공된 참고 자료를 바탕으로 사용자의 질문에 대해 한글로 상세하고 정확하게 답변해주세요.

**답변 요구사항 (반드시 준수):**
1. 반드시 한글로만 답변하세요.
2. 참고 자료에 구체적인 검사 항목, 수치, 기준, 가이드라인이 있으면 반드시 포함하세요.
3. 참고 자료가 질문과 직접적으로 관련이 없는 경우:
   - 참고 자료의 내용을 억지로 연결하지 마세요
   - "참고 자료에는 해당 정보가 없지만, 일반적으로..."로 시작하여 일반적인 건강 정보를 제공하세요
   - 검색된 자료가 관련이 없어도, 건강상담사로서의 지식을 바탕으로 도움이 되는 정보를 제공하세요
4. 검사 항목이 나열되어 있으면 그대로 나열하고, 각 검사의 목적과 필요성을 설명하세요.
5. 수치나 기준이 있으면 정확히 인용하세요 (예: "혈압 140/90mmHg 이상", "LDL 콜레스테롤 100mg/dL 미만" 등).
6. 일반적인 조언보다는 참고 자료의 구체적인 내용을 우선적으로 답변하세요. 단, 자료가 관련이 없으면 일반적인 건강 정보를 제공하세요.
7. 최소 4-6문단 이상의 상세한 답변을 작성하세요.
8. 각 문단에서 참고 자료의 구체적인 내용을 인용하세요. 자료가 관련이 없으면 일반적인 건강 지식을 바탕으로 답변하세요.

**참고 자료:**
{chr(10).join(evidence_texts)}

**사용자 질문:**
{q}

위 질문에 대해 참고 자료의 구체적인 내용을 반드시 포함하여 상세하고 정확하게 한글로 답변해주세요. 참고 자료에 검사 항목, 수치, 기준 등이 있으면 반드시 포함하세요."""
        else:
            enhanced_prompt = f"다음 질문에 대해 한글로 상세하고 전문적으로 답변해주세요:\n\n{q}"
        
        # 2-4. LLM에 직접 전달 (GeminiLLM 사용)
        from app.services.checkup_design.rag_service import GeminiLLM
        from app.core.config import settings
        import os
        
        gemini_api_key = os.environ.get("GOOGLE_GEMINI_API_KEY") or settings.google_gemini_api_key
        response = None  # 디버깅용 변수 초기화
        
        if gemini_api_key:
            llm = GeminiLLM(api_key=gemini_api_key, model="gemini-3-flash-preview")
            llm_response = await llm.acomplete(enhanced_prompt)
            context_text = llm_response.text if hasattr(llm_response, 'text') else str(llm_response)
            # 디버깅용: temp_response 사용
            response = temp_response
        else:
            # Gemini API 키가 없으면 query_engine 사용 (기존 방식)
            response = await asyncio.wait_for(
                query_engine.aquery(enhanced_prompt),
                timeout=30.0
            )
            context_text = str(response)
        
        timing['query_execution'] = time.time() - query_start
        
        # 결과 처리
        process_start = time.time()
        
        # 에비던스 구조화 (관련성 높은 것만 사용)
        # node.score는 LlamaIndex가 계산한 벡터 유사도 점수입니다
        # - 벡터 임베딩 기반 의미적 유사도 (0.0 ~ 1.0)
        # - 쿼리와 문서의 의미적 거리를 코사인 유사도로 계산
        # - 높을수록 쿼리와 더 관련이 있다는 의미
        # 최소 관련성 점수 기준: 0.3 이상만 사용
        MIN_RELEVANCE_SCORE = 0.3
        
        structured_evidences = []
        filtered_nodes_for_display = [node for node in retrieved_nodes if (node.score if hasattr(node, 'score') else 0.0) >= MIN_RELEVANCE_SCORE]
        
        for idx, node in enumerate(filtered_nodes_for_display[:5], 1):
            metadata = node.metadata if hasattr(node, 'metadata') else {}
            text = node.text if hasattr(node, 'text') else ""
            
            from app.services.checkup_design.rag_service import clean_html_content
            text = clean_html_content(text)
            
            # 벡터 유사도 점수 (LlamaIndex가 자동 계산)
            score = node.score if hasattr(node, 'score') else 0.0
            file_name = metadata.get('file_name', 'Unknown')
            page_label = metadata.get('page_label', 'Unknown')
            
            # 핵심 내용 추출 (첫 2-3문장 또는 300자)
            citation = text[:300] + "..." if len(text) > 300 else text
            # 첫 문장 추출 (요약용)
            first_sentence = text.split('.')[0] + '.' if '.' in text else text[:100]
            
            # 파일명에서 카테고리 추출
            category = "일반"
            if "비만" in file_name:
                category = "비만 관리"
            elif "구강" in file_name or "저작" in text[:200]:
                category = "구강 건강"
            elif "영양" in file_name:
                category = "영양 상태"
            elif "검진" in file_name or "건강검진" in text[:200]:
                category = "건강검진"
            elif "암" in file_name or "암" in text[:200]:
                category = "암 예방"
            elif "고혈압" in file_name or "혈압" in text[:200]:
                category = "고혈압 관리"
            
            structured_evidences.append({
                "source_document": file_name,
                "page": page_label,
                "citation": citation,
                "summary": first_sentence,  # 간단한 요약
                "full_text": text,
                "confidence_score": score,
                # 관련성 레벨: 벡터 유사도 점수 기반 (LlamaIndex가 계산)
                # score는 0.0 ~ 1.0 사이의 값으로, 쿼리와 문서의 의미적 유사도를 나타냄
                # 기준: 0.5 이상(높음), 0.35 이상(보통), 그 외(낮음)
                "relevance": "높음" if score >= 0.5 else "보통" if score >= 0.35 else "낮음",
                "relevance_threshold": {
                    "high": 0.5,
                    "medium": 0.35,
                    "low": 0.0
                },
                "category": category,  # 카테고리
                "organization": "의학회",
                "year": "2024",
                "order": idx  # 순서
            })
        
        # 디버깅: 응답 타입 및 속성 확인
        debug_info = {
            "response_type": type(temp_response).__name__ if temp_response else "None",
            "has_source_nodes": hasattr(temp_response, 'source_nodes') if temp_response else False,
            "source_nodes_count": len(temp_response.source_nodes) if (temp_response and hasattr(temp_response, 'source_nodes')) else 0,
            "response_length": len(context_text),
            "response_preview": context_text[:200] if context_text else ""
        }
        
        # 각 에비던스에 원본 쿼리 추가
        for ev in structured_evidences:
            ev['query'] = q
            ev['category'] = 'Health Consultation'
        timing['result_processing'] = time.time() - process_start
        
        timing['total'] = time.time() - start_time
        
        return {
            "context_text": context_text,
            "structured_evidences": structured_evidences,
            "original_query": q,
            "timing": timing,
            "debug": debug_info,
            "performance": {
                "total_seconds": round(timing['total'], 2),
                "engine_init_seconds": round(timing['engine_init'], 2),
                "query_execution_seconds": round(timing['query_execution'], 2),
                "result_processing_seconds": round(timing['result_processing'], 2),
                "evidence_count": len(structured_evidences),
                "total_retrieved": len(retrieved_nodes),
                "filtered_out": len(retrieved_nodes) - len(filtered_nodes_for_display),
                "min_relevance_threshold": MIN_RELEVANCE_SCORE
            }
        }
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="RAG 검색이 시간 초과되었습니다. (30초 초과)")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG 검색 중 오류가 발생했습니다: {str(e)}")


@router.get("/rag/diagnose", summary="RAG 시스템 진단", tags=["rag-test"])
async def rag_diagnose() -> Dict[str, Any]:
    """
    RAG 시스템 상태 진단 엔드포인트
    - 인덱스 상태 확인
    - 엔진 초기화 시간 측정
    - 샘플 쿼리 실행 시간 측정
    """
    start_time = time.time()
    diagnosis: Dict[str, Any] = {
        "status": "checking",
        "timing": {},
        "index_info": {},
        "sample_query": {}
    }
    
    try:
        # 1. 엔진 초기화 시간 측정
        init_start = time.time()
        query_engine = await init_rag_engine(use_local_vector_db=True)  # ✅ 로컬 FAISS 사용
        diagnosis["timing"]["engine_init"] = round(time.time() - init_start, 3)
        
        if not query_engine:
            diagnosis["status"] = "error"
            diagnosis["error"] = "RAG 엔진 초기화 실패"
            return diagnosis
        
        # 2. 인덱스 정보 확인 (가능한 경우)
        try:
            # LlamaCloudIndex의 속성 확인
            if hasattr(query_engine, 'retriever'):
                retriever = query_engine.retriever
                if hasattr(retriever, 'index'):
                    index = retriever.index
                    diagnosis["index_info"] = {
                        "type": type(index).__name__,
                        "has_metadata": hasattr(index, 'metadata'),
                    }
        except Exception as e:
            diagnosis["index_info"]["error"] = str(e)
        
        # 3. 샘플 쿼리 실행 시간 측정
        sample_query = "건강검진이란 무엇인가요?"
        query_start = time.time()
        
        try:
            response = await asyncio.wait_for(
                query_engine.aquery(sample_query),
                timeout=15.0
            )
            query_time = time.time() - query_start
            
            diagnosis["sample_query"] = {
                "query": sample_query,
                "execution_time": round(query_time, 3),
                "response_length": len(str(response)),
                "has_source_nodes": hasattr(response, 'source_nodes'),
                "source_node_count": len(response.source_nodes) if hasattr(response, 'source_nodes') else 0
            }
        except asyncio.TimeoutError:
            diagnosis["sample_query"]["error"] = "타임아웃 (15초 초과)"
        except Exception as e:
            diagnosis["sample_query"]["error"] = str(e)
        
        diagnosis["timing"]["total"] = round(time.time() - start_time, 3)
        diagnosis["status"] = "success"
        
        # 4. 성능 분석
        if diagnosis["timing"]["engine_init"] > 1.0:
            diagnosis["performance_issues"] = ["엔진 초기화가 느림 (>1초)"]
        
        if "execution_time" in diagnosis["sample_query"]:
            if diagnosis["sample_query"]["execution_time"] > 5.0:
                if "performance_issues" not in diagnosis:
                    diagnosis["performance_issues"] = []
                diagnosis["performance_issues"].append("쿼리 실행이 느림 (>5초)")
        
        return diagnosis
        
    except Exception as e:
        diagnosis["status"] = "error"
        diagnosis["error"] = str(e)
        diagnosis["timing"]["total"] = round(time.time() - start_time, 3)
        return diagnosis


