import asyncio
import os
import sys
import json

# 프로젝트 경로 추가
sys.path.append('/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend')

from app.services.checkup_design.rag_service import init_rag_engine

async def verify_pnt_rounds_8_9_10():
    query_engine = await init_rag_engine(use_local_vector_db=True)
    
    if not query_engine:
        print("❌ RAG 엔진 초기화 실패")
        return

    # 8~10차 검증 쿼리
    all_rounds = {
        "8차_간해독": [
            "간 해독 페이즈1 검사(CYP450 효소 활성)가 PNT에 포함되는지 구체적으로 알려줘.",
            "간 해독 페이즈2 검사(글루타치온 결합, 황산화, 메틸화)가 PNT에 구체적으로 포함되는지 알려줘.",
            "IgG 지연형 식품 알레르기 검사가 PNT 체계에 포함되는지 확인해줘."
        ],
        "9차_침습적검사": [
            "PNT 검사 중 침습적 검사(조직 생검, 내시경)가 포함되는 경우가 있는지 알려줘.",
            "영상 검사(초음파, CT, MRI, DEXA)가 PNT 체계에서 어떤 경우에 권장되는지 확인해줘.",
            "심전도, 운동부하검사, 24시간 혈압 모니터링이 PNT에 포함되는지 알려줘.",
            "폐기능 검사, 알레르기 피부반응 검사가 PNT에 포함되는지 확인해줘."
        ],
        "10차_최종통합": [
            "PNT 문진 후 검사 선택의 우선순위 기준이나 알고리즘이 설명되어 있는지 알려줘.",
            "검사 결과 해석 시 '기능적 범위' 기준값이 구체적으로 제시되어 있는지 확인해줘.",
            "특정 증상 조합(피로+소화불량+두통)에 대한 검사 패키지나 프로토콜이 정의되어 있는지 알려줘.",
            "PNT 검사 체계의 최종 목표와 검사 결과를 영양 치료로 연결하는 프로세스가 설명되어 있는지 확인해줘."
        ]
    }
    
    print("\n" + "="*70)
    print("🔍 8~10차 최종 검증: PNT 시스템 완결성 확인")
    print("="*70)
    
    for round_name, queries in all_rounds.items():
        print(f"\n{'='*70}")
        print(f"📋 {round_name} 검증 시작")
        print(f"{'='*70}")
        
        for i, query in enumerate(queries, 1):
            print(f"\n📡 쿼리 {i}/{len(queries)}: {query}")
            response = await query_engine.aquery(query)
            print(f"✅ 응답:\n{str(response)}\n")
            print("-" * 70)
        
        print(f"\n✅ {round_name} 검증 완료\n")
        await asyncio.sleep(2)  # API 부하 방지

    print("\n" + "="*70)
    print("🎉 8~10차 검증 모두 완료!")
    print("="*70)

if __name__ == "__main__":
    asyncio.run(verify_pnt_rounds_8_9_10())
