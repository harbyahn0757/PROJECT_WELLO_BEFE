"""
영양상태평가 16개 질문별 추천 항목 추출 (3회 반복)
각 질문에 대한 추천 검사, 건기식, 식품을 벡터 DB에서 추출
"""
import os
import sys
import json
import asyncio
from datetime import datetime

# 백엔드 디렉토리로 이동하여 .env 자동 로드
backend_dir = '/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend'
os.chdir(backend_dir)
sys.path.append(backend_dir)

# .env 로드 (tilko_utils.py 방식)
from dotenv import load_dotenv
load_dotenv()

# type: ignore - sys.path에 추가된 경로에서 import
from app.services.checkup_design.rag_service import init_rag_engine  # type: ignore

OUTPUT_FILE = "/home/workspace/PROJECT_WELLO_BEFE/pnt_nutrition_recommendations.json"

# 영양상태평가 16개 질문
NUTRITION_QUESTIONS = [
    # 체중조절 평가
    {"id": "q1", "text": "나는 나의 건강체중을 알고 일정하게 유지할 수 있다", "group": "체중조절"},
    {"id": "q2", "text": "나는 체중조절에 도움이 되는 식품을 선택할 수 있다", "group": "체중조절"},
    {"id": "q3", "text": "나는 건강체중을 위한 균형 잡힌 상차림을 할 수 있다", "group": "체중조절"},
    {"id": "q4", "text": "나는 나에게 맞는 적정 식사섭취량을 조절할 수 있다", "group": "체중조절"},
    {"id": "q5", "text": "나는 올바른 외식 방법을 실천할 수 있다", "group": "체중조절"},
    {"id": "q6", "text": "나는 정기적인 신체활동을 통하여 체중관리를 할 수 있다", "group": "체중조절"},
    {"id": "q7", "text": "나는 과식이나 폭식 하기 쉬운 상황을 피할 수 있다", "group": "체중조절"},
    {"id": "q8", "text": "나는 건강기능식품을 올바로 이용할 수 있다", "group": "체중조절"},
    # 건강식생활 평가
    {"id": "q9", "text": "나는 건강한 식생활을 실천할 수 있다", "group": "건강식생활"},
    {"id": "q10", "text": "나는 균형 잡힌 상차림을 할 수 있다", "group": "건강식생활"},
    {"id": "q11", "text": "나는 식품을 위생적으로 다룰 수 있다", "group": "건강식생활"},
    {"id": "q12", "text": "나는 체중을 건강하게 유지할 수 있다", "group": "건강식생활"},
    {"id": "q13", "text": "나는 영양불량을 예방하는 식사법을 실천할 수 있다", "group": "건강식생활"},
    {"id": "q14", "text": "나는 필요할 때 영양보충음료를 이용할 수 있다", "group": "건강식생활"},
    {"id": "q15", "text": "나는 건강기능식품을 올바로 이용할 수 있다", "group": "건강식생활"},
    {"id": "q16", "text": "나는 나의 영양상태를 좋게 유지할 수 있다", "group": "건강식생활"}
]


async def extract_round1(engine):
    """Round 1: 질문 1-5 추천 항목"""
    print("\n" + "="*80)
    print("Round 1: 질문 1-5 추천 검사/건기식/식품 추출")
    print("="*80)
    
    results = []
    for q in NUTRITION_QUESTIONS[0:5]:
        query = f"""
        "{q['text']}" 항목에서 "매우 자신 없다" 또는 낮은 점수를 받은 사람에게 추천할 수 있는:
        
        1. 관련 검사 항목 (예: 체성분 검사, 혈액 검사 등)
        2. 도움이 되는 건강기능식품 (구체적 성분명)
        3. 권장 식품 (구체적 식품명)
        
        각각 3-5개씩 추천해주세요.
        """
        
        print(f"\n질문 {q['id']}: {q['text']}")
        response = await engine.aquery(query)
        result = str(response)
        print(f"응답: {result[:200]}...\n")
        
        results.append({
            "question_id": q['id'],
            "question_text": q['text'],
            "recommendations": result
        })
    
    return {"round": 1, "results": results}


async def extract_round2(engine):
    """Round 2: 질문 6-11 추천 항목"""
    print("\n" + "="*80)
    print("Round 2: 질문 6-11 추천 검사/건기식/식품 추출")
    print("="*80)
    
    results = []
    for q in NUTRITION_QUESTIONS[5:11]:
        query = f"""
        "{q['text']}" 항목에서 "매우 자신 없다" 또는 낮은 점수를 받은 사람에게:
        
        1. 추천 검사: 어떤 검사로 현재 상태를 확인할 수 있나요?
        2. 추천 건기식: 어떤 영양소나 건기식이 도움이 될까요?
        3. 추천 식품: 어떤 식품을 섭취하면 좋을까요?
        
        구체적으로 3-5개씩 나열해주세요.
        """
        
        print(f"\n질문 {q['id']}: {q['text']}")
        response = await engine.aquery(query)
        result = str(response)
        print(f"응답: {result[:200]}...\n")
        
        results.append({
            "question_id": q['id'],
            "question_text": q['text'],
            "recommendations": result
        })
    
    return {"round": 2, "results": results}


async def extract_round3(engine):
    """Round 3: 질문 12-16 추천 항목 + 전체 검증"""
    print("\n" + "="*80)
    print("Round 3: 질문 12-16 추천 검사/건기식/식품 추출 + 전체 검증")
    print("="*80)
    
    results = []
    for q in NUTRITION_QUESTIONS[11:16]:
        query = f"""
        "{q['text']}" 능력이 부족한 사람에게 필요한:
        
        1. 기능의학 검사 또는 일반 검사
        2. 영양소 보충제 (구체적 성분과 용량)
        3. 식이요법 (구체적 식품과 섭취 방법)
        
        각 항목별로 구체적으로 추천해주세요.
        """
        
        print(f"\n질문 {q['id']}: {q['text']}")
        response = await engine.aquery(query)
        result = str(response)
        print(f"응답: {result[:200]}...\n")
        
        results.append({
            "question_id": q['id'],
            "question_text": q['text'],
            "recommendations": result
        })
    
    return {"round": 3, "results": results}


async def main():
    print("="*80)
    print("영양상태평가 16개 질문별 추천 항목 추출 (3회 반복)")
    print("="*80)
    
    engine = await init_rag_engine(use_local_vector_db=True)
    if not engine:
        print("❌ RAG 엔진 초기화 실패")
        return
    
    all_results = {
        "extraction_date": datetime.now().isoformat(),
        "total_questions": 16,
        "rounds": []
    }
    
    # 3회 반복 추출
    round1 = await extract_round1(engine)
    all_results["rounds"].append(round1)
    
    round2 = await extract_round2(engine)
    all_results["rounds"].append(round2)
    
    round3 = await extract_round3(engine)
    all_results["rounds"].append(round3)
    
    # 결과 저장
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    
    print("\n" + "="*80)
    print(f"✅ 추출 완료: {OUTPUT_FILE}")
    print("="*80)


if __name__ == "__main__":
    asyncio.run(main())
