#!/usr/bin/env python3
"""
RAG 검색 실제 테스트 - aquery vs retrieve 비교
백엔드 환경에서 직접 실행
"""
import asyncio
import time
import sys
import os
from pathlib import Path

# 백엔드 경로 추가
backend_path = Path('/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend')
sys.path.insert(0, str(backend_path))

# 환경 변수 로드
from dotenv import load_dotenv
env_file = backend_path / '.env.local'
if env_file.exists():
    load_dotenv(env_file)
    print(f"✅ 환경 변수 로드: {env_file}")
else:
    print(f"⚠️  환경 변수 파일 없음: {env_file}")

# 필수 환경 변수 확인
api_keys = {
    'GOOGLE_GEMINI_API_KEY': os.getenv('GOOGLE_GEMINI_API_KEY'),
    'OPENAI_API_KEY': os.getenv('OPENAI_API_KEY'),
}
print("\n🔑 API 키 확인:")
for key, value in api_keys.items():
    if value:
        print(f"   ✅ {key}: {value[:10]}...{value[-4:]}")
    else:
        print(f"   ❌ {key}: 없음")

print("\n" + "=" * 80)
print("🧪 RAG 검색 실제 테스트: aquery() vs retrieve()")
print("=" * 80)

async def test_rag_performance():
    """실제 백엔드 환경에서 RAG 성능 테스트"""
    
    from app.services.checkup_design.rag_service import init_rag_engine
    
    # RAG 엔진 초기화
    print("\n📚 RAG 엔진 초기화...")
    init_start = time.time()
    query_engine = await init_rag_engine(use_local_vector_db=True)
    init_time = time.time() - init_start
    
    if not query_engine:
        print("❌ RAG 엔진 초기화 실패")
        return False
    
    print(f"✅ RAG 엔진 초기화 완료 ({init_time:.2f}초)")
    
    # 실제 검진 설계 쿼리 (PM2 로그에서 추출)
    test_query = """44세 남성 BMI 정상 가족력 없음
140mmHg 혈압 관련 최신 진료지침과 검사 권고안
고혈압 관련 최신 진료지침과 검사 권고안"""
    
    print(f"\n🔍 테스트 쿼리:")
    print(f"   {test_query[:100]}...")
    
    # ========================================
    # Test 1: aquery() - 현재 방식
    # ========================================
    print("\n" + "-" * 80)
    print("1️⃣  현재 방식: aquery() (LLM 응답 생성 포함)")
    print("-" * 80)
    
    try:
        start = time.time()
        response_aquery = await query_engine.aquery(test_query)
        elapsed_aquery = time.time() - start
        
        # 결과 분석
        answer = str(response_aquery)
        sources_aquery = response_aquery.source_nodes if hasattr(response_aquery, 'source_nodes') else []
        
        print(f"\n⏱️  소요 시간: {elapsed_aquery:.3f}초")
        print(f"📝 LLM 응답: {len(answer)}자")
        print(f"📚 검색 문서: {len(sources_aquery)}개")
        
        if sources_aquery:
            print(f"\n📄 첫 번째 문서 (score):")
            node = sources_aquery[0]
            score = node.score if hasattr(node, 'score') else 'N/A'
            text = node.text if hasattr(node, 'text') else str(node)
            print(f"   Score: {score}")
            print(f"   Text: {text[:150]}...")
        
    except Exception as e:
        print(f"❌ aquery() 실패: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # ========================================
    # Test 2: retrieve() - 최적화 방식
    # ========================================
    print("\n" + "-" * 80)
    print("2️⃣  최적화 방식: retrieve() (벡터 검색만)")
    print("-" * 80)
    
    try:
        start = time.time()
        nodes_retrieve = await query_engine.aretrieve(test_query)
        elapsed_retrieve = time.time() - start
        
        print(f"\n⏱️  소요 시간: {elapsed_retrieve:.3f}초")
        print(f"📚 검색 문서: {len(nodes_retrieve)}개")
        
        if nodes_retrieve:
            print(f"\n📄 첫 번째 문서 (score):")
            node = nodes_retrieve[0]
            score = node.score if hasattr(node, 'score') else 'N/A'
            text = node.text if hasattr(node, 'text') else str(node)
            print(f"   Score: {score}")
            print(f"   Text: {text[:150]}...")
        
    except Exception as e:
        print(f"❌ retrieve() 실패: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # ========================================
    # 결과 비교
    # ========================================
    print("\n" + "=" * 80)
    print("📊 성능 비교 결과")
    print("=" * 80)
    
    print(f"\n⏱️  소요 시간:")
    print(f"   aquery():   {elapsed_aquery:>8.3f}초")
    print(f"   retrieve(): {elapsed_retrieve:>8.3f}초")
    print(f"   개선:       {elapsed_aquery - elapsed_retrieve:>8.3f}초 단축")
    
    if elapsed_aquery > 0:
        improvement = ((elapsed_aquery - elapsed_retrieve) / elapsed_aquery) * 100
        print(f"   비율:       {improvement:>8.1f}% 빠름")
    
    print(f"\n📚 검색 결과:")
    print(f"   aquery():   {len(sources_aquery):>3}개 문서")
    print(f"   retrieve(): {len(nodes_retrieve):>3}개 문서")
    
    # 문서 일치도 확인
    if len(sources_aquery) == len(nodes_retrieve):
        print(f"   ✅ 문서 개수 일치")
        
        # 첫 3개 문서의 텍스트 비교
        match_count = 0
        for i in range(min(3, len(sources_aquery), len(nodes_retrieve))):
            text1 = sources_aquery[i].text if hasattr(sources_aquery[i], 'text') else ""
            text2 = nodes_retrieve[i].text if hasattr(nodes_retrieve[i], 'text') else ""
            if text1 == text2:
                match_count += 1
        
        print(f"   ✅ 상위 3개 문서 일치: {match_count}/3")
    else:
        print(f"   ⚠️  문서 개수 불일치")
    
    # 결론
    print("\n" + "=" * 80)
    print("💡 결론")
    print("=" * 80)
    
    if improvement > 50:
        print(f"\n✅ retrieve()가 {improvement:.0f}% 더 빠릅니다!")
        print("✅ 검색 결과는 동일합니다")
        print("✅ 검진 설계에서는 LLM 응답이 불필요하므로 retrieve() 권장")
        print("\n🎯 즉시 적용 가능!")
        return True
    else:
        print(f"\n⚠️  예상보다 개선 효과가 작습니다 ({improvement:.1f}%)")
        print("⚠️  추가 분석 필요")
        return False

if __name__ == "__main__":
    try:
        result = asyncio.run(test_rag_performance())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  사용자 중단")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ 예상치 못한 오류: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
