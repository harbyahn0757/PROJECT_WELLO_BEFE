
import asyncio
import os
import sys
import json

# 프로젝트 경로 추가
sys.path.append('/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend')

from app.services.checkup_design.rag_service import init_rag_engine

async def verify_pnt_test_mapping_round3():
    query_engine = await init_rag_engine(use_local_vector_db=True)
    
    if not query_engine:
        print("❌ RAG 엔진 초기화 실패")
        return

    # 3차 검증: 증상 기반 역매칭 + 종합 확인
    final_verification_queries = [
        "만성 피로 증상이 있는 환자에게 권장되는 모든 검사 항목을 PNT 기준으로 나열해줘. 부신, 갑상선, 미토콘드리아, 영양소 검사를 모두 포함해서.",
        "소화불량, 장 건강 문제가 있을 때 필요한 모든 검사 리스트를 알려줘. 유기산, 미생물, 소화효소, 위산 관련 검사 포함.",
        "원인 모를 통증과 만성 염증 환자에게 필요한 검사를 모두 알려줘. 염증 마커, 신경전도, 면역 검사 포함.",
        "체중 증가/감소, 대사 이상 환자에게 권장되는 검사를 종합적으로 알려줘. 호르몬, 혈당, 지질, 갑상선 모두 포함.",
        "피부 문제, 알레르기, 화학물질 민감성이 있는 환자에게 필요한 독성/면역 관련 검사를 모두 나열해줘.",
        "PNT 체계에서 사용하는 기능의학 검사의 전체 카테고리와 각 카테고리별 세부 검사 항목 리스트를 총망라해서 알려줘.",
        "혈액 검사 외에 타액, 소변, 모발을 이용한 PNT 검사 항목들을 모두 정리해줘.",
        "PNT에서 '기능적 범위(Functional Range)' 분석이 적용되는 검사 항목들을 모두 알려줘."
    ]
    
    print("\n" + "="*60)
    print("🔍 3차 최종 검증: 증상 기반 역매칭 + 종합 항목 확인")
    print("="*60)
    
    for query in final_verification_queries:
        print(f"\n📡 검증 쿼리: {query}")
        response = await query_engine.aquery(query)
        print(f"✅ 응답:\n{str(response)}\n")
        print("-" * 60)

if __name__ == "__main__":
    asyncio.run(verify_pnt_test_mapping_round3())
