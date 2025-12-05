"""
Phase 1A RAG 시스템 개선 테스트
- TODO-1: generate_specific_queries() 테스트
- TODO-2: extract_evidence_from_source_nodes() 테스트
- TODO-3: format_evidence_as_citation() 테스트
"""

import asyncio
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.services.checkup_design_prompt import (
    init_rag_engine,
    generate_specific_queries,
    get_medical_evidence_from_rag
)

async def test_phase1a():
    print("=" * 80)
    print("Phase 1A RAG 시스템 개선 테스트")
    print("=" * 80)
    
    # 테스트용 환자 컨텍스트
    patient_context = {
        "age": 44,
        "gender": "male",
        "family_history": ["diabetes", "hypertension"],
        "abnormal_items": [
            {"name": "허리둘레", "status": "경계"},
            {"name": "혈압", "status": "경계"}
        ]
    }
    
    # 테스트용 염려 항목
    concerns = [
        {"name": "혈당검사", "type": "checkup"},
        {"name": "위내시경", "type": "checkup"},
        {"name": "메트포르민", "type": "medication", "medication_name": "메트포르민"}
    ]
    
    print("\n" + "=" * 80)
    print("TEST 1: generate_specific_queries() - 구체적인 쿼리 생성")
    print("=" * 80)
    
    queries = generate_specific_queries(patient_context, concerns)
    
    print(f"\n✅ 생성된 쿼리 개수: {len(queries)}개")
    print("\n생성된 쿼리 목록:")
    for idx, q in enumerate(queries, 1):
        print(f"  {idx}. [{q['category']}] {q['query']}")
    
    print("\n" + "=" * 80)
    print("TEST 2: RAG 엔진 초기화 및 검색 테스트")
    print("=" * 80)
    
    try:
        query_engine = await init_rag_engine()
        
        if query_engine:
            print("✅ RAG 엔진 초기화 성공")
            
            print("\n" + "=" * 80)
            print("TEST 3: get_medical_evidence_from_rag() - 구조화된 에비던스 검색")
            print("=" * 80)
            
            rag_result = await get_medical_evidence_from_rag(
                query_engine=query_engine,
                patient_context=patient_context,
                concerns=concerns
            )
            
            context_text = rag_result.get("context_text", "")
            structured_evidences = rag_result.get("structured_evidences", [])
            
            print(f"\n✅ 검색 완료")
            print(f"   - 구조화된 에비던스 개수: {len(structured_evidences)}개")
            print(f"   - 컨텍스트 텍스트 길이: {len(context_text)}자")
            
            if structured_evidences:
                print("\n📄 구조화된 에비던스 샘플 (첫 3개):")
                for idx, ev in enumerate(structured_evidences[:3], 1):
                    print(f"\n  [{idx}] {ev.get('category', 'N/A')}")
                    print(f"      문서: {ev.get('source_document', 'N/A')}")
                    print(f"      조직: {ev.get('organization', 'N/A')}")
                    print(f"      연도: {ev.get('year', 'N/A')}")
                    print(f"      페이지: {ev.get('page', 'N/A')}")
                    print(f"      신뢰도: {ev.get('confidence_score', 0.0):.3f}")
                    citation = ev.get('citation', '')
                    if citation:
                        print(f"      인용구: {citation[:100]}..." if len(citation) > 100 else f"      인용구: {citation}")
            
            if context_text:
                print("\n📝 프롬프트용 컨텍스트 텍스트 샘플 (첫 500자):")
                print(context_text[:500])
                if len(context_text) > 500:
                    print("...")
            
            print("\n" + "=" * 80)
            print("TEST 4: 인용구 형식 검증")
            print("=" * 80)
            
            # 인용구 형식이 제대로 되어있는지 확인
            has_citation = False
            has_document_name = False
            
            for ev in structured_evidences:
                if ev.get('citation'):
                    has_citation = True
                if ev.get('source_document'):
                    has_document_name = True
            
            print(f"\n✅ 인용구 포함 여부: {has_citation}")
            print(f"✅ 문서명 포함 여부: {has_document_name}")
            
            if context_text:
                # 컨텍스트에 인용구 형식이 있는지 확인
                has_quotation = '"' in context_text or "'" in context_text
                has_year = any(year in context_text for year in ['2024', '2025', '2023', '2022'])
                
                print(f"✅ 컨텍스트에 인용구 형식 포함: {has_quotation}")
                print(f"✅ 컨텍스트에 연도 정보 포함: {has_year}")
            
            print("\n" + "=" * 80)
            print("✅ Phase 1A 테스트 완료!")
            print("=" * 80)
            
            # 요약
            print("\n📊 테스트 요약:")
            print(f"   - 쿼리 생성: {len(queries)}개 ✅")
            print(f"   - 에비던스 검색: {len(structured_evidences)}개 ✅")
            print(f"   - 컨텍스트 길이: {len(context_text)}자 ✅")
            print(f"   - 인용구 형식: {'✅' if has_citation and has_document_name else '❌'}")
            
        else:
            print("❌ RAG 엔진 초기화 실패 - API 키 또는 설정 확인 필요")
            
    except Exception as e:
        print(f"❌ 테스트 중 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_phase1a())

