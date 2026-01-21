#!/usr/bin/env python3
"""
RAG 검색 최적화 테스트
aquery() vs aretrieve() 결과 비교
"""
import asyncio
import time
import sys
import os
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv('/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/.env')
load_dotenv('/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/.env.local')

# 프로젝트 경로 추가
sys.path.insert(0, '/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend')

from app.services.checkup_design.rag_service import init_rag_engine

async def test_rag_methods():
    """aquery vs aretrieve 비교 테스트"""
    
    print("=" * 80)
    print("🧪 RAG 검색 최적화 테스트")
    print("=" * 80)
    print()
    
    # RAG 엔진 초기화
    print("📚 RAG 엔진 초기화 중...")
    query_engine = await init_rag_engine(use_local_vector_db=True)
    
    if not query_engine:
        print("❌ RAG 엔진 초기화 실패")
        return
    
    print("✅ RAG 엔진 초기화 완료")
    print()
    
    # 테스트 쿼리 (실제 검진 설계에서 사용되는 쿼리)
    test_query = "44세 남성에게 권장되는 핵심 건강검진 항목과 혈압 관리 지침"
    
    print(f"🔍 테스트 쿼리: {test_query}")
    print()
    
    # ========================================
    # Method 1: aquery() - 현재 방식
    # ========================================
    print("-" * 80)
    print("1️⃣  현재 방식: aquery() (LLM 응답 생성 포함)")
    print("-" * 80)
    
    start_time = time.time()
    try:
        response_aquery = await query_engine.aquery(test_query)
        elapsed_aquery = time.time() - start_time
        
        # 결과 추출
        answer_text = str(response_aquery)
        source_nodes_aquery = []
        if hasattr(response_aquery, 'source_nodes'):
            source_nodes_aquery = response_aquery.source_nodes
        
        print(f"⏱️  소요 시간: {elapsed_aquery:.3f}초")
        print(f"📄 응답 길이: {len(answer_text)}자")
        print(f"📚 검색된 문서: {len(source_nodes_aquery)}개")
        print()
        print("응답 샘플 (처음 200자):")
        print(answer_text[:200] + "...")
        print()
        
    except Exception as e:
        print(f"❌ 오류: {e}")
        return
    
    # ========================================
    # Method 2: aretrieve() - 최적화 방식
    # ========================================
    print("-" * 80)
    print("2️⃣  최적화 방식: aretrieve() (벡터 검색만)")
    print("-" * 80)
    
    # aretrieve()는 query_engine이 아닌 retriever에서 호출
    # as_retriever()로 retriever 생성
    retriever = query_engine._retriever if hasattr(query_engine, '_retriever') else None
    
    if not retriever:
        # retriever가 없으면 index에서 직접 생성
        try:
            # query_engine에서 index 추출
            if hasattr(query_engine, '_index'):
                index = query_engine._index
            else:
                print("⚠️  retriever를 찾을 수 없습니다. index.as_retriever() 사용")
                # VectorStoreIndex에서 retriever 생성
                from llama_index.core import VectorStoreIndex
                # query_engine이 VectorStoreIndex.as_query_engine()으로 생성되었다면
                # _index 속성을 통해 접근 가능
                print("⚠️  대체 방법으로 테스트 진행")
        except Exception as e:
            print(f"⚠️  retriever 생성 실패: {e}")
    
    start_time = time.time()
    try:
        # aretrieve() 호출
        if retriever:
            nodes_aretrieve = await retriever.aretrieve(test_query)
        else:
            # retriever가 없으면 query_engine의 retrieve 메서드 사용
            if hasattr(query_engine, 'aretrieve'):
                nodes_aretrieve = await query_engine.aretrieve(test_query)
            else:
                # 동기 retrieve 사용
                print("⚠️  aretrieve가 없어서 retrieve 사용")
                nodes_aretrieve = query_engine.retrieve(test_query)
        
        elapsed_aretrieve = time.time() - start_time
        
        print(f"⏱️  소요 시간: {elapsed_aretrieve:.3f}초")
        print(f"📚 검색된 문서: {len(nodes_aretrieve)}개")
        print()
        
        # 노드 정보 출력
        print("검색된 문서 샘플:")
        for idx, node in enumerate(nodes_aretrieve[:3], 1):
            text = node.text if hasattr(node, 'text') else str(node)
            score = node.score if hasattr(node, 'score') else 'N/A'
            print(f"[{idx}] Score: {score:.4f} | {text[:100]}...")
        print()
        
    except Exception as e:
        print(f"❌ 오류: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # ========================================
    # 비교 분석
    # ========================================
    print("=" * 80)
    print("📊 결과 비교")
    print("=" * 80)
    print()
    
    print(f"⏱️  속도 비교:")
    print(f"   aquery():    {elapsed_aquery:.3f}초")
    print(f"   aretrieve(): {elapsed_aretrieve:.3f}초")
    print(f"   개선:        {elapsed_aquery - elapsed_aretrieve:.3f}초 단축 ({(1 - elapsed_aretrieve/elapsed_aquery)*100:.1f}%)")
    print()
    
    print(f"📚 검색 결과 비교:")
    print(f"   aquery():    {len(source_nodes_aquery)}개 문서")
    print(f"   aretrieve(): {len(nodes_aretrieve)}개 문서")
    print()
    
    # 동일한 문서가 검색되었는지 확인
    print("🔍 문서 일치도 확인:")
    if len(source_nodes_aquery) == len(nodes_aretrieve):
        print(f"   ✅ 문서 개수 동일: {len(source_nodes_aquery)}개")
        
        # 텍스트 비교
        match_count = 0
        for i in range(min(len(source_nodes_aquery), len(nodes_aretrieve))):
            text1 = source_nodes_aquery[i].text if hasattr(source_nodes_aquery[i], 'text') else ""
            text2 = nodes_aretrieve[i].text if hasattr(nodes_aretrieve[i], 'text') else ""
            
            if text1 == text2:
                match_count += 1
        
        match_rate = (match_count / len(source_nodes_aquery)) * 100 if source_nodes_aquery else 0
        print(f"   ✅ 텍스트 일치: {match_count}/{len(source_nodes_aquery)}개 ({match_rate:.1f}%)")
    else:
        print(f"   ⚠️  문서 개수 다름")
    
    print()
    print("=" * 80)
    print("✅ 테스트 완료")
    print("=" * 80)
    print()
    
    print("💡 결론:")
    if elapsed_aretrieve < elapsed_aquery * 0.3:  # 70% 이상 개선
        print(f"   ✅ aretrieve()가 {(1 - elapsed_aretrieve/elapsed_aquery)*100:.0f}% 빠릅니다!")
        print(f"   ✅ 검진 설계에서는 LLM 응답이 필요 없으므로 aretrieve() 사용 권장")
    else:
        print(f"   ⚠️  개선 효과가 예상보다 작습니다 ({(1 - elapsed_aretrieve/elapsed_aquery)*100:.1f}%)")

if __name__ == "__main__":
    asyncio.run(test_rag_methods())
