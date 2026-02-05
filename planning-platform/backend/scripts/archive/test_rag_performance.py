"""
RAG 채팅 성능 테스트 스크립트 - 각 단계별 시간 측정
"""
import asyncio
import time
import sys
import os

# 경로 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.services.welno_rag_chat_service import WelnoRagChatService

async def test_rag_performance():
    """각 단계별 성능 측정"""
    
    service = WelnoRagChatService()
    
    uuid = "test-perf-user"
    hospital_id = "default"
    message = "고혈압 관리 방법은?"
    session_id = f"test-perf-{int(time.time())}"
    
    print("=" * 60)
    print("RAG 채팅 성능 분석 시작")
    print("=" * 60)
    
    start_total = time.time()
    
    # 1. 첫 메시지 저장
    t1 = time.time()
    service.chat_manager.add_message(uuid, hospital_id, "user", message)
    print(f"[{time.time() - start_total:.3f}s] 1. 메시지 저장: {time.time() - t1:.3f}초")
    
    # 2. 히스토리 조회
    t2 = time.time()
    history = service.chat_manager.get_history(uuid, hospital_id)
    print(f"[{time.time() - start_total:.3f}s] 2. 히스토리 조회: {time.time() - t2:.3f}초")
    
    # 3. Redis 메타데이터 조회
    t3 = time.time()
    meta_key = f"welno:rag_chat:metadata:{uuid}:{hospital_id}:{session_id}"
    metadata_json = service.redis_client.get(meta_key) if service.redis_client else None
    print(f"[{time.time() - start_total:.3f}s] 3. Redis 조회: {time.time() - t3:.3f}초")
    
    # 4. 키워드 감지
    t4 = time.time()
    keywords = service._detect_health_keywords(message)
    print(f"[{time.time() - start_total:.3f}s] 4. 키워드 감지: {time.time() - t4:.3f}초, 키워드: {keywords}")
    
    # 5. 환자 건강 데이터 로드 (첫 메시지만)
    t5 = time.time()
    try:
        health_info = await service.welno_data_service.get_patient_health_data(uuid, hospital_id)
        print(f"[{time.time() - start_total:.3f}s] 5. 건강 데이터 로드: {time.time() - t5:.3f}초")
    except Exception as e:
        print(f"[{time.time() - start_total:.3f}s] 5. 건강 데이터 로드 실패: {time.time() - t5:.3f}초 - {e}")
    
    # 6. RAG 엔진 초기화
    t6 = time.time()
    from app.services.checkup_design.rag_service import init_rag_engine
    query_engine = await init_rag_engine(use_local_vector_db=True)
    print(f"[{time.time() - start_total:.3f}s] 6. RAG 엔진 초기화: {time.time() - t6:.3f}초")
    
    # 7. 벡터 검색
    t7 = time.time()
    search_query = f"{', '.join(keywords)} 관련: {message}" if keywords else message
    nodes = await query_engine.aretrieve(search_query)
    print(f"[{time.time() - start_total:.3f}s] 7. 벡터 검색: {time.time() - t7:.3f}초, 노드 수: {len(nodes)}")
    
    # 8. 컨텍스트 구성
    t8 = time.time()
    context_str = "\n".join([n.node.get_content() for n in nodes])
    print(f"[{time.time() - start_total:.3f}s] 8. 컨텍스트 구성: {time.time() - t8:.3f}초, 길이: {len(context_str)}")
    
    # 9. 프롬프트 생성
    t9 = time.time()
    from app.services.checkup_design.rag_service import CHAT_SYSTEM_PROMPT
    prompt = CHAT_SYSTEM_PROMPT.format(context_str=context_str, query_str=message)
    print(f"[{time.time() - start_total:.3f}s] 9. 프롬프트 생성: {time.time() - t9:.3f}초, 길이: {len(prompt)}")
    
    # 10. LLM 스트리밍 (첫 chunk까지만)
    t10 = time.time()
    from app.services.gemini_service import gemini_service, GeminiRequest
    gemini_req = GeminiRequest(prompt=prompt, model="gemini-3-flash-preview", chat_history=None)
    
    first_chunk = False
    async for chunk in gemini_service.stream_api(gemini_req, session_id=session_id):
        if not first_chunk:
            print(f"[{time.time() - start_total:.3f}s] 10. LLM 첫 chunk 생성: {time.time() - t10:.3f}초")
            first_chunk = True
            break
    
    total_time = time.time() - start_total
    print("=" * 60)
    print(f"총 소요 시간 (첫 chunk까지): {total_time:.3f}초")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_rag_performance())
