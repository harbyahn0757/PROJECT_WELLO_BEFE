#!/usr/bin/env python3
"""
RAG 시스템 직접 테스트 스크립트
- RAG 엔진 초기화 확인
- 검색 쿼리 테스트
- 벡터 DB 내용 확인
- 프롬프트 점검
"""
import asyncio
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.services.checkup_design import (
    init_rag_engine,
    get_medical_evidence_from_rag
)
from app.core.config import settings

async def test_rag_system():
    """RAG 시스템 전체 테스트"""
    
    print("=" * 80)
    print("RAG 시스템 점검 리포트")
    print("=" * 80)
    print()
    
    # 1. 환경 설정 확인
    print("1️⃣ 환경 설정 확인")
    print("-" * 80)
    
    llamaindex_api_key = settings.llamaindex_api_key
    gemini_api_key = settings.google_gemini_api_key
    
    print(f"LlamaIndex API Key: {'✅ 설정됨' if llamaindex_api_key and not llamaindex_api_key.startswith('dev-') else '❌ 미설정'}")
    print(f"Gemini API Key: {'✅ 설정됨' if gemini_api_key and not gemini_api_key.startswith('dev-') else '❌ 미설정'}")
    print(f"LlamaCloud Index ID: cb77bf6b-02a9-486f-9718-4ffac0d30e73")
    print(f"LlamaCloud Project ID: 45c4d9d4-ce6b-4f62-ad88-9107fe6de8cc")
    print()
    
    # 2. RAG 엔진 초기화 테스트
    print("2️⃣ RAG 엔진 초기화 테스트")
    print("-" * 80)
    
    try:
        query_engine = await init_rag_engine()
        if query_engine:
            print("✅ RAG 엔진 초기화 성공")
        else:
            print("❌ RAG 엔진 초기화 실패 (None 반환)")
            return
    except Exception as e:
        print(f"❌ RAG 엔진 초기화 중 오류: {str(e)}")
        return
    
    print()
    
    # 3. 검색 쿼리 테스트
    print("3️⃣ 검색 쿼리 테스트")
    print("-" * 80)
    
    test_queries = [
        {
            "name": "기본 검색 - 환자 위험 요인",
            "query": "가족력으로 인해 심혈관 질환 위험이 높은 50대 남성의 검진 가이드라인"
        },
        {
            "name": "심층 검색 - 혈압 관련",
            "query": "고혈압 진단 기준 및 혈압 측정 가이드라인"
        },
        {
            "name": "심층 검색 - 혈당 관련",
            "query": "당뇨병 전단계 진단 기준 및 공복혈당 검사 가이드라인"
        },
        {
            "name": "업셀링 검사 - 경동맥 초음파",
            "query": "경동맥 초음파 검사의 필요성 및 뇌졸중 예방 가이드라인"
        },
        {
            "name": "업셀링 검사 - 뇌 MRA",
            "query": "뇌 MRA 검사의 필요성 및 뇌졸중 위험 평가 가이드라인"
        },
        {
            "name": "액체생검 - 캔서파인드",
            "query": "캔서파인드 검사의 원리 및 다중암 조기진단 키트"
        },
        {
            "name": "통계 자료 - 연령별 질환 통계",
            "query": "50대 남성 사망 원인 및 심혈관 질환 통계"
        },
        {
            "name": "치료 비용 - 예방 vs 치료",
            "query": "뇌졸중 예방 검사 비용 vs 뇌졸중 치료 비용 비교"
        }
    ]
    
    test_results = []
    
    for test in test_queries:
        try:
            print(f"\n📋 테스트: {test['name']}")
            print(f"   쿼리: {test['query']}")
            
            response = query_engine.query(test['query'])
            
            if response and hasattr(response, 'response'):
                response_text = response.response
                response_length = len(response_text)
                
                print(f"   ✅ 검색 성공 - 응답 길이: {response_length}자")
                
                # 응답 내용 일부 출력 (처음 200자)
                preview = response_text[:200].replace('\n', ' ')
                print(f"   내용 미리보기: {preview}...")
                
                test_results.append({
                    "name": test['name'],
                    "query": test['query'],
                    "success": True,
                    "length": response_length,
                    "has_content": response_length > 0,
                    "preview": preview
                })
            else:
                print(f"   ❌ 검색 실패 - 응답 없음")
                test_results.append({
                    "name": test['name'],
                    "query": test['query'],
                    "success": False,
                    "length": 0,
                    "has_content": False,
                    "preview": ""
                })
        except Exception as e:
            print(f"   ❌ 검색 중 오류: {str(e)}")
            test_results.append({
                "name": test['name'],
                "query": test['query'],
                "success": False,
                "error": str(e),
                "length": 0,
                "has_content": False,
                "preview": ""
            })
    
    print()
    
    # 4. 실제 시나리오 테스트
    print("4️⃣ 실제 시나리오 테스트")
    print("-" * 80)
    
    # 시나리오: 가족력으로 심혈관 질환 위험이 높은 50대 남성, 최근 검진 이력 없음
    patient_summary = "50대 남성, 가족력으로 심혈관 질환 위험이 높음. 최근 검진 이력 확인 불가."
    concerns = [
        {"type": "checkup", "name": "건강검진", "date": "2020-09-28", "status": "abnormal"},
        {"type": "medication", "name": "소화성궤양용제", "medicationName": "소화성궤양용제"}
    ]
    
    print(f"환자 요약: {patient_summary}")
    print(f"염려 항목: {len(concerns)}개")
    print()
    
    try:
        rag_evidence = await get_medical_evidence_from_rag(
            query_engine=query_engine,
            patient_summary=patient_summary,
            concerns=concerns
        )
        
        if rag_evidence:
            print(f"✅ RAG 검색 완료 - 전체 컨텍스트 길이: {len(rag_evidence)}자")
            print(f"\n검색 결과 미리보기 (처음 500자):")
            print("-" * 80)
            print(rag_evidence[:500])
            print("-" * 80)
        else:
            print("❌ RAG 검색 결과 없음")
    except Exception as e:
        print(f"❌ RAG 검색 중 오류: {str(e)}")
    
    print()
    
    # 5. 결과 요약 테이블
    print("5️⃣ 검색 결과 요약 테이블")
    print("=" * 80)
    print(f"{'검색 항목':<30} {'성공':<8} {'응답 길이':<12} {'내용 있음':<10}")
    print("-" * 80)
    
    for result in test_results:
        success = "✅" if result.get('success', False) else "❌"
        length = f"{result.get('length', 0)}자" if result.get('length', 0) > 0 else "0자"
        has_content = "✅" if result.get('has_content', False) else "❌"
        
        print(f"{result['name']:<30} {success:<8} {length:<12} {has_content:<10}")
    
    print()
    
    # 6. 문제점 진단
    print("6️⃣ 문제점 진단")
    print("=" * 80)
    
    failed_tests = [r for r in test_results if not r.get('success', False)]
    empty_tests = [r for r in test_results if r.get('success', False) and not r.get('has_content', False)]
    
    if failed_tests:
        print(f"❌ 검색 실패 항목: {len(failed_tests)}개")
        for test in failed_tests:
            print(f"   - {test['name']}: {test.get('error', '응답 없음')}")
    else:
        print("✅ 모든 검색 쿼리 성공")
    
    if empty_tests:
        print(f"\n⚠️  응답 내용 부족 항목: {len(empty_tests)}개")
        print("   (벡터 DB에 해당 자료가 부족할 가능성)")
        for test in empty_tests:
            print(f"   - {test['name']}")
    else:
        print("\n✅ 모든 검색에 충분한 응답 내용")
    
    print()
    
    # 7. 권장 사항
    print("7️⃣ 권장 사항")
    print("=" * 80)
    
    if empty_tests:
        print("📌 벡터 DB에 추가 필요:")
        print("   1. 업셀링 검사 설명 자료 (경동맥 초음파, 뇌 MRA 등)")
        print("   2. 액체생검 자료 (캔서파인드, 아이캔서치 등)")
        print("   3. 통계 자료 (연령별 질환 통계, 치료 비용 비교)")
        print("   4. 기능 의학 검사 가이드")
    
    print("\n📌 프롬프트 개선 필요:")
    print("   1. Bridge Strategy (Anchor-Gap-Offer) 명시적 적용")
    print("   2. 데이터 부재 처리 로직 강화")
    print("   3. 의학적 근거 인용 형식 명확화")
    print("   4. 업셀링 논리 구조화")
    
    print()
    print("=" * 80)
    print("테스트 완료")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(test_rag_system())

