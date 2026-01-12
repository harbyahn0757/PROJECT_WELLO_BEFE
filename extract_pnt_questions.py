
import asyncio
import os
import sys
import json

# 프로젝트 경로 추가
sys.path.append('/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend')

from app.services.checkup_design.rag_service import init_rag_engine

async def extract_pnt_questions():
    print("🔍 [PNT 추출] RAG 엔진 초기화 중...")
    query_engine = await init_rag_engine(use_local_vector_db=True)
    
    if not query_engine:
        print("❌ RAG 엔진 초기화 실패")
        return

    # PNT 문진 항목을 모두 추출하기 위한 쿼리
    queries = [
        "PNT 정밀 영양 문진의 모든 질문 항목과 선택지를 리스트로 나열해줘.",
        "정밀 영양 치료를 위한 문진표(PNT)에 포함된 질문들을 카테고리별로 모두 알려줘.",
        "내 몸에 맞는 맞춤 영양 치료 문진(PNT)의 구체적인 문항들을 모두 출력해줘."
    ]
    
    all_results = []
    for query in queries:
        print(f"📡 쿼리 전송: {query}")
        response = await query_engine.aquery(query)
        print(f"✅ 응답 수신 완료")
        all_results.append(str(response))
        
        # 소스 노드 확인
        if hasattr(response, 'source_nodes'):
            print(f"📄 참조 문서: {[node.metadata.get('file_name') for node in response.source_nodes]}")

    print("\n" + "="*50)
    print("🚀 추출된 PNT 문진 결과")
    print("="*50)
    for i, res in enumerate(all_results):
        print(f"\n[결과 {i+1}]\n{res}")
    print("="*50)

if __name__ == "__main__":
    asyncio.run(extract_pnt_questions())
