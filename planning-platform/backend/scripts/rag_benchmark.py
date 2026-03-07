"""
RAG 채팅 응답 속도 벤치마크

서버에서 실행:
  cd /home/welno/workspace/PROJECT_WELNO_BEFE/planning-platform/backend
  python3 -m scripts.rag_benchmark

테스트 시나리오:
  A) baseline: top_k=5, system_instruction 분리 (현재 코드)
  B) top_k=10 (이전 설정) vs top_k=5 비교용

각 시나리오 × 3회 반복 → TTFB, 전체 시간, 토큰 수 기록
"""
import asyncio
import json
import os
import sys
import time
from pathlib import Path

# 프로젝트 루트를 path에 추가
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# 환경변수 로드
from dotenv import load_dotenv
for env_file in [".env.local", "config.env", ".env"]:
    env_path = backend_dir / env_file
    if env_path.exists():
        load_dotenv(env_path)
        break


async def run_single_benchmark(
    query: str,
    top_k: int = 5,
    use_system_instruction: bool = True,
    label: str = "",
):
    """단일 벤치마크 실행 — FAISS 검색 + Gemini 스트리밍"""
    from app.services.gemini_service import gemini_service, GeminiRequest
    from app.services.checkup_design.rag_service import (
        init_rag_engine,
        CHAT_SYSTEM_PROMPT_TEMPLATE,
    )

    result = {"label": label, "query": query, "top_k": top_k}

    # 1) RAG 엔진 초기화
    t0 = time.time()
    vector_search = await init_rag_engine(use_local_vector_db=True)
    result["rag_init_ms"] = round((time.time() - t0) * 1000, 1)

    if not vector_search:
        result["error"] = "FAISS 초기화 실패"
        return result

    # 2) FAISS 검색
    t1 = time.time()
    nodes = vector_search.search(query, top_k=top_k)
    result["rag_search_ms"] = round((time.time() - t1) * 1000, 1)
    result["retrieved_nodes"] = len(nodes)

    context_str = "\n".join([r["text"] for r in nodes])
    result["context_chars"] = len(context_str)

    # 3) 프롬프트 구성
    persona_name = "검진 결과 에이전트"

    if use_system_instruction:
        # 분리 모드: system_instruction + user prompt
        rules_part = CHAT_SYSTEM_PROMPT_TEMPLATE.split("[Context]")[0].rstrip()
        system_instruction = rules_part.format(
            persona_name=persona_name, context_str="", query_str=""
        )
        system_instruction += "\n\n**중요**: 답변이 끝난 후 반드시 빈 줄을 하나 두고, 사용자가 이어서 물어볼 법한 짧은 질문 2~3개를 '[SUGGESTIONS] 질문1, 질문2, 질문3 [/SUGGESTIONS]' 형식으로 포함하세요."

        prompt = f"[의학 지식 문서 (참고 문헌)]\n{context_str}\n\n사용자 질문: {query}\n도우미 답변:"
        result["system_instruction_chars"] = len(system_instruction)
        result["system_instruction_tokens_est"] = len(system_instruction) // 4
    else:
        # 통합 모드: 모든 것이 prompt에 포함 (이전 방식)
        system_instruction = None
        full_prompt = CHAT_SYSTEM_PROMPT_TEMPLATE.format(
            persona_name=persona_name,
            context_str=context_str,
            query_str=query,
        )
        full_prompt += "\n\n**중요**: 답변이 끝난 후 반드시 빈 줄을 하나 두고, 사용자가 이어서 물어볼 법한 짧은 질문 2~3개를 '[SUGGESTIONS] 질문1, 질문2, 질문3 [/SUGGESTIONS]' 형식으로 포함하세요."
        prompt = full_prompt

    result["prompt_chars"] = len(prompt)

    # 4) Gemini 스트리밍 호출
    gemini_req = GeminiRequest(
        prompt=prompt,
        model="gemini-3-flash-preview",
        system_instruction=system_instruction,
        chat_history=None,
    )

    await gemini_service.initialize()

    t2 = time.time()
    first_token_time = None
    full_answer = ""

    try:
        async for chunk in gemini_service.stream_api(
            gemini_req, session_id=f"bench_{int(time.time())}"
        ):
            if first_token_time is None:
                first_token_time = time.time()
            full_answer += chunk
    except Exception as e:
        result["error"] = str(e)
        return result

    t3 = time.time()
    result["ttfb_ms"] = round((first_token_time - t2) * 1000, 1) if first_token_time else None
    result["total_gemini_ms"] = round((t3 - t2) * 1000, 1)
    result["answer_chars"] = len(full_answer)
    result["answer_tokens_est"] = len(full_answer) // 4

    return result


async def main():
    queries = [
        "콜레스테롤 수치가 높으면 어떻게 해야 하나요?",
        "혈압이 높은데 생활습관으로 개선할 수 있나요?",
        "간 수치 GGT가 높다는데 어떤 의미인가요?",
    ]

    scenarios = [
        {"label": "A_baseline", "top_k": 5, "use_si": True},
        {"label": "B_top_k_10", "top_k": 10, "use_si": True},
        {"label": "C_no_cache", "top_k": 5, "use_si": False},
    ]

    results = []
    for scenario in scenarios:
        for i, query in enumerate(queries):
            label = f"{scenario['label']}_q{i+1}"
            print(f"\n{'='*60}")
            print(f"Running: {label} (top_k={scenario['top_k']}, system_instruction={scenario['use_si']})")
            print(f"Query: {query}")
            print(f"{'='*60}")

            r = await run_single_benchmark(
                query=query,
                top_k=scenario["top_k"],
                use_system_instruction=scenario["use_si"],
                label=label,
            )
            results.append(r)

            # 핵심 수치 출력
            if "error" not in r:
                print(f"  TTFB: {r['ttfb_ms']}ms")
                print(f"  Total Gemini: {r['total_gemini_ms']}ms")
                print(f"  RAG search: {r['rag_search_ms']}ms")
                print(f"  Context: {r['context_chars']} chars")
                print(f"  Answer: {r['answer_chars']} chars")
                if r.get("system_instruction_chars"):
                    print(f"  System instruction: {r['system_instruction_chars']} chars (~{r['system_instruction_tokens_est']} tokens)")
            else:
                print(f"  ERROR: {r['error']}")

    # 결과 요약 테이블
    print(f"\n\n{'='*80}")
    print("BENCHMARK RESULTS SUMMARY")
    print(f"{'='*80}")
    print(f"{'Label':<20} {'TTFB(ms)':>10} {'Total(ms)':>10} {'RAG(ms)':>10} {'Ctx(ch)':>10} {'Ans(ch)':>10}")
    print(f"{'-'*80}")
    for r in results:
        if "error" not in r:
            print(f"{r['label']:<20} {r['ttfb_ms']:>10} {r['total_gemini_ms']:>10} {r['rag_search_ms']:>10} {r['context_chars']:>10} {r['answer_chars']:>10}")
        else:
            print(f"{r['label']:<20} {'ERROR':>10}")

    # 시나리오별 평균
    print(f"\n{'='*80}")
    print("AVERAGES BY SCENARIO")
    print(f"{'='*80}")
    for scenario in scenarios:
        prefix = scenario["label"]
        scenario_results = [r for r in results if r["label"].startswith(prefix) and "error" not in r]
        if scenario_results:
            avg_ttfb = sum(r["ttfb_ms"] for r in scenario_results) / len(scenario_results)
            avg_total = sum(r["total_gemini_ms"] for r in scenario_results) / len(scenario_results)
            avg_ctx = sum(r["context_chars"] for r in scenario_results) / len(scenario_results)
            print(f"{prefix:<20} avg TTFB: {avg_ttfb:>8.1f}ms  avg Total: {avg_total:>8.1f}ms  avg Context: {avg_ctx:>6.0f} chars")

    # JSON 파일로 저장
    out_path = backend_dir / "scripts" / "rag_benchmark_results.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\nResults saved to: {out_path}")


if __name__ == "__main__":
    asyncio.run(main())
