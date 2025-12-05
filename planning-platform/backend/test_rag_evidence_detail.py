#!/usr/bin/env python3
"""
RAG에서 경동맥 초음파 관련 상세 증거 추출 테스트
목적: 현재 evidence가 너무 단조로운 문제 해결
"""

import sys
import os
import asyncio

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.services.checkup_design_prompt import (
    init_rag_engine,
    generate_specific_queries,
    extract_evidence_from_source_nodes,
    format_evidence_as_citation
)


async def test_carotid_ultrasound_evidence():
    """경동맥 초음파 관련 상세 증거 추출"""
    
    print("\n" + "="*80)
    print("🔍 RAG 상세 증거 추출 테스트: 경동맥 초음파")
    print("="*80)
    
    # RAG 엔진 초기화
    print("\n[1단계] RAG 엔진 초기화...")
    query_engine = await init_rag_engine()
    
    if not query_engine:
        print("❌ RAG 엔진 초기화 실패!")
        return
    
    print("✅ RAG 엔진 초기화 완료")
    
    # 테스트 쿼리들
    queries = [
        "고혈압 환자에서 경동맥 초음파 검사의 임상적 의의와 뇌졸중 예방 효과",
        "경동맥 초음파로 발견 가능한 혈관 병변과 뇌졸중 위험도 평가 방법",
        "대한고혈압학회 진료지침 경동맥 초음파 권고사항 구체적 내용",
        "경동맥 내막 중막 두께 측정과 동맥경화반 평가의 임상적 가치"
    ]
    
    all_evidences = []
    
    for i, query in enumerate(queries, 1):
        print(f"\n[{i}단계] 쿼리 실행: {query[:50]}...")
        
        try:
            # RAG 검색 실행 (similarity_top_k=5로 더 많은 결과 요청)
            response = query_engine.query(query)
            
            # source_nodes 확인
            if hasattr(response, 'source_nodes') and response.source_nodes:
                print(f"   ✅ {len(response.source_nodes)}개의 소스 문서 발견")
                
                # 각 소스 노드에서 상세 정보 추출
                for j, node in enumerate(response.source_nodes, 1):
                    print(f"\n   📄 소스 {j}:")
                    
                    # 메타데이터 추출
                    metadata = node.metadata if hasattr(node, 'metadata') else {}
                    score = node.score if hasattr(node, 'score') else 0.0
                    text = node.text if hasattr(node, 'text') else node.get_content()
                    
                    doc_name = metadata.get('file_name', '문서명 없음')
                    page = metadata.get('page_label', '페이지 정보 없음')
                    
                    print(f"      문서명: {doc_name}")
                    print(f"      페이지: {page}")
                    print(f"      관련도: {score:.3f}")
                    print(f"      내용 길이: {len(text)}자")
                    print(f"      내용 미리보기:")
                    print(f"      {text[:300]}...")
                    
                    # 증거 저장
                    all_evidences.append({
                        'query': query,
                        'doc_name': doc_name,
                        'page': page,
                        'score': score,
                        'text': text
                    })
            else:
                print(f"   ⚠️ 소스 문서 없음 (응답만 있음)")
                print(f"   응답 내용: {str(response)[:200]}...")
        
        except Exception as e:
            print(f"   ❌ 오류 발생: {str(e)}")
    
    # 결과 요약
    print("\n" + "="*80)
    print("📊 수집된 증거 요약")
    print("="*80)
    print(f"총 {len(all_evidences)}개의 증거 발견")
    
    if all_evidences:
        # 관련도 순으로 정렬
        all_evidences.sort(key=lambda x: x['score'], reverse=True)
        
        print("\n🏆 상위 3개 증거:")
        for i, evidence in enumerate(all_evidences[:3], 1):
            print(f"\n{i}. [{evidence['doc_name']}] (페이지: {evidence['page']}, 관련도: {evidence['score']:.3f})")
            print(f"   쿼리: {evidence['query'][:60]}...")
            print(f"   내용:")
            print(f"   {evidence['text'][:400]}...")
            print()
        
        # 가장 상세한 증거로 citation 포맷 생성
        print("\n💡 권장 Evidence 텍스트:")
        print("-" * 80)
        
        best_evidence = all_evidences[0]
        
        # 실제 인용구 추출 (핵심 문장)
        text = best_evidence['text']
        
        # 경동맥 초음파, 고혈압, 뇌졸중 관련 문장 추출
        sentences = text.split('.')
        key_sentences = [s.strip() for s in sentences if any(keyword in s for keyword in ['경동맥', '초음파', '고혈압', '뇌졸중', '예방', '평가', '권고', '권장'])]
        
        if key_sentences:
            citation = '. '.join(key_sentences[:2]) + '.'
            print(f'"{citation}"')
            print(f"(출처: {best_evidence['doc_name']}, p.{best_evidence['page']})")
        else:
            print(f'"{text[:200]}..."')
            print(f"(출처: {best_evidence['doc_name']}, p.{best_evidence['page']})")
    else:
        print("\n⚠️ 증거를 찾지 못했습니다.")
    
    print("\n" + "="*80)
    print("테스트 완료!")
    print("="*80)


async def compare_with_perplexity():
    """Perplexity 응답과 비교"""
    
    print("\n" + "="*80)
    print("📊 RAG vs Perplexity 비교 분석")
    print("="*80)
    
    perplexity_evidence = """대한고혈압학회 가이드라인에 따르면, 경동맥 초음파는 뇌졸중 위험 평가에 중요합니다[3]."""
    
    current_rag_evidence = """대한고혈압학회 가이드라인에 따르면 '고혈압 환자에서 뇌졸중 위험 평가를 위해 경동맥 초음파 검사가 권장된다'고 명시되어 있습니다."""
    
    print("\n1️⃣ Perplexity 증거 (RAG 적용 전):")
    print("-" * 80)
    print(perplexity_evidence)
    print("\n장점:")
    print("  ✅ 간결하고 명확함")
    print("  ✅ 참고문헌 번호 포함 [3]")
    print("\n단점:")
    print("  ❌ 구체적인 내용 부족")
    print("  ❌ '왜 중요한지' 설명 없음")
    print("  ❌ 실제 가이드라인 인용 없음")
    
    print("\n2️⃣ 현재 RAG 증거:")
    print("-" * 80)
    print(current_rag_evidence)
    print("\n장점:")
    print("  ✅ 직접 인용 형식 (더 신뢰감)")
    print("  ✅ '고혈압 환자에서' 명시 (대상 명확)")
    print("\n단점:")
    print("  ❌ 여전히 단조로움")
    print("  ❌ 구체적인 수치나 연구 결과 없음")
    print("  ❌ 문서명, 페이지 정보 없음")
    
    print("\n3️⃣ 이상적인 증거 (목표):")
    print("-" * 80)
    print("""대한고혈압학회 2022 고혈압 진료지침(p.45)에 따르면, "고혈압 환자에서 경동맥 초음파 검사로 경동맥 내막-중막 두께(IMT) 1.0mm 이상 또는 동맥경화반이 발견되면 뇌졸중 위험이 2-3배 증가하므로, 적극적인 혈압 조절과 함께 경동맥 초음파를 통한 정기적 평가가 권장된다"고 명시되어 있습니다.""")
    
    print("\n장점:")
    print("  ✅ 구체적 수치 (IMT 1.0mm, 위험도 2-3배)")
    print("  ✅ 문서명과 페이지 명시")
    print("  ✅ 실제 임상적 의미 설명")
    print("  ✅ 직접 인용 형식으로 신뢰도 높음")


async def suggest_upselling_enhancement():
    """업셀링 메시지 강화 방안"""
    
    print("\n" + "="*80)
    print("💪 업셀링 메시지 강화 방안")
    print("="*80)
    
    current = "경동맥 초음파를 통해 뇌졸중 위험을 사전에 평가하세요."
    
    print("\n현재 메시지:")
    print("-" * 80)
    print(f'"{current}"')
    print("\n문제점:")
    print("  ❌ 너무 일반적이고 평범함")
    print("  ❌ 긴급성/필요성 부족")
    print("  ❌ 환자 개인화 없음")
    print("  ❌ 구체적 이점 설명 부족")
    
    print("\n" + "="*80)
    print("✨ 강화된 메시지 옵션들:")
    print("="*80)
    
    options = [
        {
            "title": "옵션 1: 위험 강조형 (긴급성)",
            "message": "가족력과 경계 혈압이 있으시니, 경동맥 초음파로 혈관 속 '보이지 않는 위험'을 미리 발견하세요."
        },
        {
            "title": "옵션 2: 이점 강조형 (예방)",
            "message": "경동맥 초음파 한 번으로 향후 10년간의 뇌졸중 위험도를 예측하고, 맞춤 예방 전략을 세울 수 있습니다."
        },
        {
            "title": "옵션 3: 개인화형 (맥락)",
            "message": "혈압 수치만으로는 알 수 없는 혈관 노화 정도를 확인하여, 뇌졸중을 사전에 예방하세요."
        },
        {
            "title": "옵션 4: 행동 유도형 (구체적)",
            "message": "10분 검사로 혈관 나이를 측정하고, 뇌졸중 위험을 2-3단계 낮출 수 있는 맞춤 관리법을 받아보세요."
        },
        {
            "title": "옵션 5: 통계 강조형 (신뢰)",
            "message": "경동맥 초음파로 동맥경화반을 조기 발견하면 뇌졸중 예방 성공률이 70% 이상 높아집니다."
        },
        {
            "title": "옵션 6: 브리지 연결형 (논리적)",
            "message": "혈압은 정상이어도 혈관 속은 다를 수 있습니다. 경동맥 초음파로 '진짜 혈관 건강'을 확인하세요."
        }
    ]
    
    for i, option in enumerate(options, 1):
        print(f"\n{i}. {option['title']}")
        print("-" * 80)
        print(f'"{option["message"]}"')
        print()
        
        # 분석
        if "가족력" in option["message"] or "혈압" in option["message"]:
            print("  ✅ 개인화됨")
        if "10년" in option["message"] or "70%" in option["message"] or "2-3" in option["message"]:
            print("  ✅ 구체적 수치 포함")
        if "위험" in option["message"] or "예방" in option["message"]:
            print("  ✅ 긴급성/필요성 있음")
        if "10분" in option["message"] or "한 번" in option["message"]:
            print("  ✅ 실행 용이성 강조")


async def main():
    """메인 실행"""
    
    # 1. RAG 상세 증거 추출
    await test_carotid_ultrasound_evidence()
    
    # 2. Perplexity 비교
    await compare_with_perplexity()
    
    # 3. 업셀링 메시지 강화
    await suggest_upselling_enhancement()


if __name__ == "__main__":
    asyncio.run(main())

