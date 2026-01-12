
import asyncio
import os
import sys
import json

# 프로젝트 경로 추가
sys.path.append('/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend')

from app.services.checkup_design.rag_service import init_rag_engine

async def analyze_pnt_groups():
    query_engine = await init_rag_engine(use_local_vector_db=True)
    
    if not query_engine:
        print("❌ RAG 엔진 초기화 실패")
        return

    # PNT 문진의 그룹화 및 상황별 매칭 로직 추출을 위한 쿼리
    queries = [
        "PNT 문진표가 어떤 증상이나 상황(케이스)별로 그룹화되어 있는지 상세히 알려줘.",
        "특정 증상(예: 피로, 소화불량, 피부염)에 따라 어떤 PNT 설문지를 우선적으로 사용하는지 매칭 기준을 알려줘.",
        "PNT 문진의 카테고리 구성과 각 카테고리가 타겟으로 하는 건강 상태(상황)를 리스트로 정리해줘."
    ]
    
    print("\n" + "="*50)
    print("🚀 PNT 상황별 그룹 매칭 분석 시작")
    print("="*50)
    
    for query in queries:
        print(f"\n📡 쿼리: {query}")
        response = await query_engine.aquery(query)
        print(f"✅ 응답:\n{str(response)}")

if __name__ == "__main__":
    asyncio.run(analyze_pnt_groups())
