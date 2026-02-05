"""
로컬 FAISS vs LlamaCloud 성능 비교 테스트 스크립트
"""

import os
import sys
import time
import asyncio
from pathlib import Path
from typing import Dict, Any

# 프로젝트 루트를 sys.path에 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from app.core.config import settings
from app.services.checkup_design.rag_service import init_rag_engine, search_checkup_knowledge


async def test_performance():
    """로컬 FAISS vs LlamaCloud 성능 비교"""
    
    print("=" * 100)
    print("RAG 엔진 성능 비교 테스트")
    print("=" * 100)
    print()
    
    # 테스트 쿼리
    test_queries = [
        "고혈압 환자는 어떤 검진을 받아야 하나요?",
        "간 기능 검사 항목은 무엇인가요?",
        "당뇨병 선별 검사는 몇 살부터 받아야 하나요?",
    ]
    
    results = []
    
    for i, query in enumerate(test_queries, 1):
        print(f"\n{'=' * 100}")
        print(f"테스트 {i}/{len(test_queries)}: {query}")
        print(f"{'=' * 100}\n")
        
        # 1. 로컬 FAISS 테스트
        print("🏠 [로컬 FAISS]")
        start_time = time.time()
        
        try:
            local_response = await search_checkup_knowledge(query, use_local_vector_db=True)
            local_time = time.time() - start_time
            
            if local_response['success']:
                print(f"✅ 응답 시간: {local_time:.3f}초")
                print(f"📄 답변: {local_response['answer'][:200]}...")
                print(f"📚 소스 개수: {len(local_response['sources'])}개")
            else:
                print(f"❌ 오류: {local_response['error']}")
                local_time = None
        
        except Exception as e:
            print(f"❌ 예외 발생: {e}")
            local_time = None
        
        print()
        
        # 2. LlamaCloud 테스트
        print("☁️  [LlamaCloud API]")
        start_time = time.time()
        
        try:
            cloud_response = await search_checkup_knowledge(query, use_local_vector_db=False)
            cloud_time = time.time() - start_time
            
            if cloud_response['success']:
                print(f"✅ 응답 시간: {cloud_time:.3f}초")
                print(f"📄 답변: {cloud_response['answer'][:200]}...")
                print(f"📚 소스 개수: {len(cloud_response['sources'])}개")
            else:
                print(f"❌ 오류: {cloud_response['error']}")
                cloud_time = None
        
        except Exception as e:
            print(f"❌ 예외 발생: {e}")
            cloud_time = None
        
        print()
        
        # 결과 저장
        results.append({
            'query': query,
            'local_time': local_time,
            'cloud_time': cloud_time,
            'speedup': (cloud_time / local_time) if (local_time and cloud_time) else None
        })
    
    # 요약 통계
    print("\n" + "=" * 100)
    print("📊 성능 비교 요약")
    print("=" * 100)
    
    print(f"\n{'쿼리':<50} {'로컬 (초)':<15} {'클라우드 (초)':<15} {'속도 향상':<10}")
    print("-" * 100)
    
    total_local = 0
    total_cloud = 0
    count = 0
    
    for result in results:
        local_str = f"{result['local_time']:.3f}" if result['local_time'] else "N/A"
        cloud_str = f"{result['cloud_time']:.3f}" if result['cloud_time'] else "N/A"
        speedup_str = f"{result['speedup']:.2f}x" if result['speedup'] else "N/A"
        
        print(f"{result['query'][:47]+'...':<50} {local_str:<15} {cloud_str:<15} {speedup_str:<10}")
        
        if result['local_time'] and result['cloud_time']:
            total_local += result['local_time']
            total_cloud += result['cloud_time']
            count += 1
    
    print("-" * 100)
    
    if count > 0:
        avg_local = total_local / count
        avg_cloud = total_cloud / count
        avg_speedup = avg_cloud / avg_local if avg_local > 0 else 0
        
        print(f"{'평균':<50} {avg_local:.3f}{'':<10} {avg_cloud:.3f}{'':<10} {avg_speedup:.2f}x")
        
        # 비용 절감 계산
        print("\n" + "=" * 100)
        print("💰 비용 절감 예상")
        print("=" * 100)
        
        queries_per_day = 100  # 하루 100개 쿼리 가정
        queries_per_month = queries_per_day * 30
        cost_per_query = 0.02  # LlamaCloud API 비용 가정 ($0.02/query)
        
        monthly_cloud_cost = queries_per_month * cost_per_query
        monthly_local_cost = 0  # 로컬은 무료
        monthly_savings = monthly_cloud_cost - monthly_local_cost
        
        print(f"\n월 예상 쿼리 수: {queries_per_month:,}개")
        print(f"LlamaCloud 월 비용: ${monthly_cloud_cost:,.2f}")
        print(f"로컬 FAISS 월 비용: ${monthly_local_cost:,.2f}")
        print(f"월 절감액: ${monthly_savings:,.2f}")
        
        print(f"\n연 절감액: ${monthly_savings * 12:,.2f}")
    
    print("\n" + "=" * 100)
    print("✅ 테스트 완료!")
    print("=" * 100)


if __name__ == "__main__":
    asyncio.run(test_performance())
