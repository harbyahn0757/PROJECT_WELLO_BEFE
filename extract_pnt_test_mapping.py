
import asyncio
import os
import sys
import json

# 프로젝트 경로 추가
sys.path.append('/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend')

from app.services.checkup_design.rag_service import init_rag_engine

async def extract_pnt_test_mapping():
    query_engine = await init_rag_engine(use_local_vector_db=True)
    
    if not query_engine:
        print("❌ RAG 엔진 초기화 실패")
        return

    # PNT 문진 결과에 따른 검사 매칭 정보 추출
    queries = [
        "PNT 부신 기능 설문 결과가 나쁠 경우 권장되는 검사 항목이나 혈액 검사를 모두 알려줘.",
        "PNT 독성 설문 결과에 따라 추천되는 해독 관련 검사나 바이오마커를 알려줘.",
        "PNT 갑상샘 기능 설문 이상 시 확인해야 할 검사 항목(TSH, T3, T4 등)을 알려줘.",
        "PNT 영양 결핍 설문 결과에 따라 확인이 필요한 영양소 혈액 검사 리스트를 알려줘.",
        "PNT 문진 후 기능의학 검사로 어떤 항목들을 측정하는지 전체 리스트를 알려줘.",
        "특정 증상(만성 피로, 소화불량, 피부염)과 연결되는 PNT 권장 검사 항목을 매칭해서 알려줘."
    ]
    
    print("\n" + "="*50)
    print("🚀 PNT 문진 → 검사 매칭 정보 추출 시작")
    print("="*50)
    
    for query in queries:
        print(f"\n📡 쿼리: {query}")
        response = await query_engine.aquery(query)
        print(f"✅ 응답:\n{str(response)}")
        
        # 소스 문서도 확인
        if hasattr(response, 'source_nodes') and len(response.source_nodes) > 0:
            print(f"📄 참조 문서: {[node.metadata.get('file_name') for node in response.source_nodes[:3]]}")

if __name__ == "__main__":
    asyncio.run(extract_pnt_test_mapping())
