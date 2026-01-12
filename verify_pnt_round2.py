
import asyncio
import os
import sys
import json

# 프로젝트 경로 추가
sys.path.append('/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend')

from app.services.checkup_design.rag_service import init_rag_engine

async def verify_pnt_test_mapping_round2():
    query_engine = await init_rag_engine(use_local_vector_db=True)
    
    if not query_engine:
        print("❌ RAG 엔진 초기화 실패")
        return

    # 2차 검증: 각 PNT 그룹별로 누락된 검사 항목 재확인
    verification_queries = [
        "부신 기능 저하 평가를 위해 코티솔 검사나 DHEA 검사, 또는 타액 코티솔 일주기 검사가 필요한지 알려줘.",
        "독성 해독 평가에서 중금속 검사(납, 수은, 카드뮴), 유기산 검사, 또는 글루타치온 수치 측정이 포함되는지 확인해줘.",
        "갑상샘 기능 평가에서 TPO 항체, Tg 항체 같은 자가면역 갑상선염 검사가 필요한지 알려줘.",
        "영양 균형 평가에서 비타민 D, 비타민 B12, 엽산, 마그네슘, 아연, 오메가3 지수 같은 구체적 영양소 검사 리스트를 확인해줘.",
        "만성 염증 평가를 위해 hs-CRP(고감도 CRP), ESR(적혈구침강속도), IL-6 같은 염증 마커 검사가 포함되는지 알려줘.",
        "장 건강 평가를 위한 유기산 검사, 장내 미생물 검사(마이크로바이옴), 장누수 검사가 PNT에 포함되는지 확인해줘.",
        "미토콘드리아 기능 평가나 산화 스트레스 검사(8-OHdG, MDA)가 PNT 체계에 있는지 알려줘.",
        "호르몬 균형 평가에서 성호르몬(에스트로겐, 프로게스테론, 테스토스테론), SHBG 검사가 필요한지 확인해줘."
    ]
    
    print("\n" + "="*60)
    print("🔍 2차 검증: PNT 검사 항목 누락 여부 정밀 확인")
    print("="*60)
    
    for query in verification_queries:
        print(f"\n📡 검증 쿼리: {query}")
        response = await query_engine.aquery(query)
        print(f"✅ 응답:\n{str(response)}\n")
        print("-" * 60)

if __name__ == "__main__":
    asyncio.run(verify_pnt_test_mapping_round2())
