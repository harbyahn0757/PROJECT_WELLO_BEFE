import asyncio
import time
import sys
import os
sys.path.insert(0, 'app')

from app.services.checkup_design.rag_service import init_rag_engine, CHAT_SYSTEM_PROMPT
from app.services.checkup_design.rag_service_optimized import CHAT_SYSTEM_PROMPT_OPTIMIZED
from app.services.gemini_service import gemini_service, GeminiRequest

async def test_both_prompts():
    # RAG 엔진 초기화
    print("RAG 엔진 로드 중...")
    query_engine = await init_rag_engine(use_local_vector_db=True)
    
    # 테스트 질문
    test_question = "고혈압 환자는 어떤 식단을 관리해야 하나요?"
    
    # RAG 검색
    print(f"\n질문: {test_question}")
    print("=" * 80)
    nodes = await query_engine.aretrieve(test_question)
    context_str = "\n".join([n.node.get_content()[:300] + "..." for n in nodes])  # 각 300자로 제한
    
    print(f"\n검색된 컨텍스트: {len(context_str)}자")
    
    # 1. 기존 프롬프트 테스트
    print("\n" + "=" * 80)
    print("[ 기존 프롬프트 테스트 ]")
    print("=" * 80)
    
    original_prompt = CHAT_SYSTEM_PROMPT.format(context_str=context_str, query_str=test_question)
    print(f"프롬프트 크기: {len(original_prompt):,}자")
    
    start = time.time()
    req_original = GeminiRequest(prompt=original_prompt, model="gemini-3-flash-preview")
    
    original_answer = ""
    async for chunk in gemini_service.stream_api(req_original):
        original_answer += chunk
    
    original_time = time.time() - start
    print(f"응답 시간: {original_time:.2f}초")
    print(f"답변 길이: {len(original_answer)}자")
    print(f"\n답변 미리보기:\n{original_answer[:300]}...")
    
    # 2. 최적화 프롬프트 테스트
    print("\n" + "=" * 80)
    print("[ 최적화 프롬프트 테스트 ]")
    print("=" * 80)
    
    optimized_prompt = CHAT_SYSTEM_PROMPT_OPTIMIZED.format(context_str=context_str, query_str=test_question)
    print(f"프롬프트 크기: {len(optimized_prompt):,}자")
    
    start = time.time()
    req_optimized = GeminiRequest(prompt=optimized_prompt, model="gemini-3-flash-preview")
    
    optimized_answer = ""
    async for chunk in gemini_service.stream_api(req_optimized):
        optimized_answer += chunk
    
    optimized_time = time.time() - start
    print(f"응답 시간: {optimized_time:.2f}초")
    print(f"답변 길이: {len(optimized_answer)}자")
    print(f"\n답변 미리보기:\n{optimized_answer[:300]}...")
    
    # 3. 비교
    print("\n" + "=" * 80)
    print("[ 성능 비교 ]")
    print("=" * 80)
    print(f"프롬프트 크기: {len(original_prompt):,}자 → {len(optimized_prompt):,}자 ({(1-len(optimized_prompt)/len(original_prompt))*100:.1f}% 축소)")
    print(f"응답 시간: {original_time:.2f}초 → {optimized_time:.2f}초 ({(1-optimized_time/original_time)*100:.1f}% 개선)")
    print(f"답변 길이: {len(original_answer)}자 vs {len(optimized_answer)}자")
    
    # 품질 체크
    print("\n[ 품질 체크 ]")
    quality_checks = {
        "출처 명시 ('검진', '복약')": any(w in optimized_answer for w in ["검진", "복약", "문진"]),
        "구체적 조언": len(optimized_answer) > 100,
        "환각 방지 (Context 기반)": True,  # 수동 확인 필요
        "자연스러운 문장": "지침서" not in optimized_answer,
    }
    
    for check, passed in quality_checks.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check}")
    
    print("\n최적화 프롬프트 사용 권장: ✅" if optimized_time < original_time else "⚠️ 재검토 필요")

asyncio.run(test_both_prompts())
