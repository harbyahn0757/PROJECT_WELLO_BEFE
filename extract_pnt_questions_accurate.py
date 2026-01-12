"""
PNT 설문지 질문 정확 추출 (3회 반복)
실제 질문 형식을 정확하게 추출
"""
import os
import sys
import json
import asyncio
from datetime import datetime

sys.path.append('/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend')
from app.services.checkup_design.rag_service import init_rag_engine

OUTPUT_FILE = "/home/workspace/PROJECT_WELLO_BEFE/pnt_questions_accurate.json"


async def extract_adrenal_round1(engine):
    """부신 기능 설문지 - Round 1"""
    print("\n" + "="*80)
    print("부신 기능 설문지 - Round 1: 직접적 질문 추출")
    print("="*80)
    
    query = """
    부신 기능 설문지에서 환자가 직접 답변하는 질문 형식을 모두 나열해주세요.
    
    예시 형식:
    1. [질문] 아침에 일어나기 힘드신가요?
       답변: 예/아니오 또는 1-5점
    
    2. [질문] 오후에 피로감을 느끼시나요?
       답변: 전혀 그렇지 않다 / 가끔 / 자주 / 항상
    
    실제 설문지의 모든 질문을 이 형식으로 나열해주세요.
    """
    
    response = await engine.aquery(query)
    result = str(response)
    print(f"\n{result}\n")
    
    return {"round": 1, "category": "부신_기능", "response": result}


async def extract_adrenal_round2(engine):
    """부신 기능 설문지 - Round 2"""
    print("\n" + "="*80)
    print("부신 기능 설문지 - Round 2: 증상별 질문 추출")
    print("="*80)
    
    query = """
    부신 기능과 관련된 설문지에서:
    1. 피로/에너지 관련 질문들
    2. 스트레스 관련 질문들
    3. 수면 관련 질문들
    4. 감정 관련 질문들
    
    각 카테고리별로 실제 질문 텍스트를 나열해주세요.
    형식: "질문: [실제 질문 텍스트], 답변 방식: [예/아니오 또는 척도]"
    """
    
    response = await engine.aquery(query)
    result = str(response)
    print(f"\n{result}\n")
    
    return {"round": 2, "category": "부신_기능", "response": result}


async def extract_adrenal_round3(engine):
    """부신 기능 설문지 - Round 3"""
    print("\n" + "="*80)
    print("부신 기능 설문지 - Round 3: 점수 체계 포함 질문")
    print("="*80)
    
    query = """
    부신 기능 설문지의 점수 체계를 포함한 모든 질문을 나열해주세요.
    
    각 질문마다:
    - 질문 번호
    - 질문 내용
    - 답변 옵션 (점수 포함)
    - 해석 기준 (있다면)
    """
    
    response = await engine.aquery(query)
    result = str(response)
    print(f"\n{result}\n")
    
    return {"round": 3, "category": "부신_기능", "response": result}


async def extract_thyroid_round1(engine):
    """갑상샘 설문지 - Round 1"""
    print("\n" + "="*80)
    print("갑상샘 기능 설문지 - Round 1: 직접적 질문 추출")
    print("="*80)
    
    query = """
    갑상샘(갑상선) 기능 설문지에서 환자가 직접 답변하는 질문들을 모두 나열해주세요.
    
    형식:
    1. [질문 내용]
       답변 방식: [예/아니오, 척도, 또는 객관식]
    
    모든 질문을 빠짐없이 나열해주세요.
    """
    
    response = await engine.aquery(query)
    result = str(response)
    print(f"\n{result}\n")
    
    return {"round": 1, "category": "갑상샘_기능", "response": result}


async def extract_thyroid_round2(engine):
    """갑상샘 설문지 - Round 2"""
    print("\n" + "="*80)
    print("갑상샘 기능 설문지 - Round 2: 증상별 질문")
    print("="*80)
    
    query = """
    갑상샘 기능 설문지에서:
    1. 체중 변화 관련 질문
    2. 피로/활력 관련 질문
    3. 호르몬 관련 질문
    4. 기타 신체 증상 관련 질문
    
    각 질문의 실제 텍스트와 답변 방식을 나열해주세요.
    """
    
    response = await engine.aquery(query)
    result = str(response)
    print(f"\n{result}\n")
    
    return {"round": 2, "category": "갑상샘_기능", "response": result}


async def extract_thyroid_round3(engine):
    """갑상샘 설문지 - Round 3"""
    print("\n" + "="*80)
    print("갑상샘 기능 설문지 - Round 3: 전체 검증")
    print("="*80)
    
    query = """
    갑상샘 기능 설문지의 전체 질문 개수와 모든 질문을 순서대로 나열해주세요.
    누락된 질문이 없도록 완전하게 추출해주세요.
    """
    
    response = await engine.aquery(query)
    result = str(response)
    print(f"\n{result}\n")
    
    return {"round": 3, "category": "갑상샘_기능", "response": result}


async def extract_toxicity_round1(engine):
    """독성 설문지 - Round 1"""
    print("\n" + "="*80)
    print("독성 설문지 - Round 1: 직접적 질문 추출")
    print("="*80)
    
    query = """
    독성 설문지에서 환자가 답변하는 모든 질문을 나열해주세요.
    
    중금속, 독소 노출, 해독 관련 질문들을 포함하여:
    - 질문 내용
    - 답변 방식
    - 점수 체계 (있다면)
    """
    
    response = await engine.aquery(query)
    result = str(response)
    print(f"\n{result}\n")
    
    return {"round": 1, "category": "독성_설문", "response": result}


async def extract_toxicity_round2(engine):
    """독성 설문지 - Round 2"""
    print("\n" + "="*80)
    print("독성 설문지 - Round 2: 노출 경로별 질문")
    print("="*80)
    
    query = """
    독성 설문지에서:
    1. 식이 습관 관련 질문
    2. 생활 환경 노출 관련 질문
    3. 직업적 노출 관련 질문
    4. 증상 확인 질문
    
    각 카테고리별 실제 질문들을 나열해주세요.
    """
    
    response = await engine.aquery(query)
    result = str(response)
    print(f"\n{result}\n")
    
    return {"round": 2, "category": "독성_설문", "response": result}


async def extract_toxicity_round3(engine):
    """독성 설문지 - Round 3"""
    print("\n" + "="*80)
    print("독성 설문지 - Round 3: 전체 검증")
    print("="*80)
    
    query = """
    독성 설문지의 모든 질문을 번호와 함께 완전하게 나열해주세요.
    중금속 검사, 해독 필요성 평가와 관련된 모든 질문 포함.
    """
    
    response = await engine.aquery(query)
    result = str(response)
    print(f"\n{result}\n")
    
    return {"round": 3, "category": "독성_설문", "response": result}


async def main():
    print("="*80)
    print("PNT 설문지 질문 정확 추출 (3회 반복)")
    print("="*80)
    
    engine = await init_rag_engine(use_local_vector_db=True)
    if not engine:
        print("❌ RAG 엔진 초기화 실패")
        return
    
    results = {
        "extraction_date": datetime.now().isoformat(),
        "total_rounds": 9,
        "surveys": {}
    }
    
    # 부신 기능 설문지 (3회)
    print("\n" + "#"*80)
    print("# 부신 기능 설문지")
    print("#"*80)
    adrenal_results = []
    adrenal_results.append(await extract_adrenal_round1(engine))
    adrenal_results.append(await extract_adrenal_round2(engine))
    adrenal_results.append(await extract_adrenal_round3(engine))
    results["surveys"]["부신_기능"] = adrenal_results
    
    # 갑상샘 기능 설문지 (3회)
    print("\n" + "#"*80)
    print("# 갑상샘 기능 설문지")
    print("#"*80)
    thyroid_results = []
    thyroid_results.append(await extract_thyroid_round1(engine))
    thyroid_results.append(await extract_thyroid_round2(engine))
    thyroid_results.append(await extract_thyroid_round3(engine))
    results["surveys"]["갑상샘_기능"] = thyroid_results
    
    # 독성 설문지 (3회)
    print("\n" + "#"*80)
    print("# 독성 설문지")
    print("#"*80)
    toxicity_results = []
    toxicity_results.append(await extract_toxicity_round1(engine))
    toxicity_results.append(await extract_toxicity_round2(engine))
    toxicity_results.append(await extract_toxicity_round3(engine))
    results["surveys"]["독성_설문"] = toxicity_results
    
    # 영양상태평가는 이미 추출됨
    results["surveys"]["영양상태평가"] = "이미 16개 질문 추출 완료"
    
    # 결과 저장
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print("\n" + "="*80)
    print(f"✅ 질문 추출 완료: {OUTPUT_FILE}")
    print("="*80)


if __name__ == "__main__":
    asyncio.run(main())
