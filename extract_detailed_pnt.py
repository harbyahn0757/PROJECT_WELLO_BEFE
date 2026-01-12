
import asyncio
import os
import sys
import json

# 프로젝트 경로 추가
sys.path.append('/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend')

from app.services.checkup_design.rag_service import init_rag_engine

async def extract_detailed_pnt():
    query_engine = await init_rag_engine(use_local_vector_db=True)
    
    if not query_engine:
        print("❌ RAG 엔진 초기화 실패")
        return

    # 구체적인 세부 문항 추출을 위한 쿼리
    queries = [
        "PNT 부신 기능 설문지의 구체적인 문항들을 모두 알려줘.",
        "PNT 갑상샘 기능 설문지의 구체적인 문항들을 모두 알려줘.",
        "PNT 독성 및 해독 기능 설문지(자가 진단)의 구체적인 문항들을 모두 알려줘.",
        "PNT 영양 균형 및 결핍 평가를 위한 구체적인 질문 리스트를 알려줘."
    ]
    
    print("\n" + "="*50)
    print("🚀 PNT 세부 문항 추출 시작")
    print("="*50)
    
    for query in queries:
        print(f"\n📡 쿼리: {query}")
        response = await query_engine.aquery(query)
        print(f"✅ 응답:\n{str(response)}")

if __name__ == "__main__":
    asyncio.run(extract_detailed_pnt())
