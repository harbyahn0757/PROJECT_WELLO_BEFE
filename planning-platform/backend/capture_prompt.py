import asyncio
import sys
import os
sys.path.insert(0, 'app')

from app.services.welno_rag_chat_service import WelnoRagChatService
from app.services.checkup_design.rag_service import init_rag_engine, CHAT_SYSTEM_PROMPT

async def capture_prompt():
    service = WelnoRagChatService()
    
    uuid = "test-prompt"
    hospital_id = "default"
    message = "고혈압 관리 방법은?"
    
    # RAG 검색
    query_engine = await init_rag_engine(use_local_vector_db=True)
    nodes = await query_engine.aretrieve(message)
    context_str = "\n".join([n.node.get_content() for n in nodes])
    
    # 시스템 프롬프트 크기
    print("=" * 70)
    print("프롬프트 구조 분석")
    print("=" * 70)
    
    print(f"\n1. 시스템 프롬프트 (CHAT_SYSTEM_PROMPT):")
    print(f"   - 길이: {len(CHAT_SYSTEM_PROMPT):,}자")
    print(f"   - 줄 수: {CHAT_SYSTEM_PROMPT.count(chr(10))}줄")
    
    # 컨텍스트 (RAG 검색 결과)
    print(f"\n2. RAG 검색 컨텍스트:")
    print(f"   - 길이: {len(context_str):,}자")
    print(f"   - 노드 수: {len(nodes)}개")
    
    # 추가 지침들
    context_instruction = "\n**답변 구조 지침**: 먼저 사용자 질문에 대한 직접 답변을 제공하고, 그 다음 [Context]에 있는 과거 검진/복약/문진 내역과의 연관성을 의학 지식 문서에 연관성이 있을 때만 자연스럽게 연결하여 언급하세요. 데이터 출처를 명확히 표시하고(예: '2021년 검진 결과를 보면', '이전 문진에서', '복약 내역을 확인해보니'), 데이터와 사용자 말이 위배될 때는 시스템이 직접 확인 질문을 하세요. 너무 의학적으로 접근하지 말고, 필요시 상담사 연결이나 PNT 문진을 자연스럽게 유도하세요.\n"
    
    stage_instruction = "\n이 정보를 바탕으로 다각도로 분석하여 상담을 시작하세요. 추이, 패턴, 위험도를 종합적으로 언급하되, 너무 의학적으로 접근하지 말고 상담사 연결을 자연스럽게 유도하세요."
    
    suggestions_instruction = "\n\n**중요**: 답변이 끝난 후 반드시 빈 줄을 하나 두고, 사용자가 이어서 물어볼 법한 짧은 질문 2~3개를 '[SUGGESTIONS] 질문1, 질문2, 질문3 [/SUGGESTIONS]' 형식으로 포함하세요."
    
    print(f"\n3. 추가 지침들:")
    print(f"   - 답변 구조 지침: {len(context_instruction):,}자")
    print(f"   - 상담 단계 지침: {len(stage_instruction):,}자")
    print(f"   - 제안 질문 지침: {len(suggestions_instruction):,}자")
    
    # 최종 프롬프트
    enhanced_prompt = CHAT_SYSTEM_PROMPT + context_instruction + stage_instruction + suggestions_instruction
    final_prompt = enhanced_prompt.format(context_str=context_str, query_str=message)
    
    print(f"\n4. 최종 프롬프트:")
    print(f"   - 총 길이: {len(final_prompt):,}자")
    print(f"   - 예상 토큰: ~{len(final_prompt) // 4:,}개 (한글 기준)")
    
    print("\n" + "=" * 70)
    print("프롬프트 세부 분석")
    print("=" * 70)
    
    # CHAT_SYSTEM_PROMPT 섹션별 분석
    sections = {
        "환각 방지 규칙": CHAT_SYSTEM_PROMPT[CHAT_SYSTEM_PROMPT.find("⚠️ **환각 방지"):CHAT_SYSTEM_PROMPT.find("💡 **답변 스타일")],
        "답변 스타일": CHAT_SYSTEM_PROMPT[CHAT_SYSTEM_PROMPT.find("💡 **답변 스타일"):CHAT_SYSTEM_PROMPT.find("🔗 **맥락 연결")],
        "맥락 연결 구조": CHAT_SYSTEM_PROMPT[CHAT_SYSTEM_PROMPT.find("🔗 **맥락 연결"):CHAT_SYSTEM_PROMPT.find("📋 **데이터 불일치")],
        "데이터 불일치 감지": CHAT_SYSTEM_PROMPT[CHAT_SYSTEM_PROMPT.find("📋 **데이터 불일치"):CHAT_SYSTEM_PROMPT.find("🔍 **의학 지식")],
        "의학 지식 기반 연관성": CHAT_SYSTEM_PROMPT[CHAT_SYSTEM_PROMPT.find("🔍 **의학 지식"):CHAT_SYSTEM_PROMPT.find("💬 **자연스러운")],
        "자연스러운 연결": CHAT_SYSTEM_PROMPT[CHAT_SYSTEM_PROMPT.find("💬 **자연스러운"):CHAT_SYSTEM_PROMPT.find("👨‍⚕️ **상담사")],
        "상담사 연결": CHAT_SYSTEM_PROMPT[CHAT_SYSTEM_PROMPT.find("👨‍⚕️ **상담사"):CHAT_SYSTEM_PROMPT.find("[Context]")],
    }
    
    print("\n시스템 프롬프트 섹션별 크기:")
    for name, content in sections.items():
        print(f"   - {name}: {len(content):,}자")
    
    print("\n" + "=" * 70)
    print("개선 포인트")
    print("=" * 70)
    
    total = len(final_prompt)
    system = len(CHAT_SYSTEM_PROMPT)
    context = len(context_str)
    additions = len(context_instruction + stage_instruction + suggestions_instruction)
    
    print(f"\n비율:")
    print(f"   - 시스템 프롬프트: {system:,}자 ({system/total*100:.1f}%)")
    print(f"   - RAG 컨텍스트: {context:,}자 ({context/total*100:.1f}%)")
    print(f"   - 추가 지침: {additions:,}자 ({additions/total*100:.1f}%)")
    
    # 샘플 출력
    print("\n" + "=" * 70)
    print("샘플 프롬프트 (처음 500자)")
    print("=" * 70)
    print(final_prompt[:500])
    print("...")

asyncio.run(capture_prompt())
