"""
PNT 전체 질문 완전 추출 스크립트
'당신만을 위한 맞춤 영양 치료' 벡터 소스에서 7가지 설문지의 모든 질문 추출

5회 반복 전략:
- Round 1: 부신 기능 설문지 전체 질문
- Round 2: 통증평가도표, 현재 불편함 설문 전체 질문
- Round 3: 일반 문진표 전체 질문
- Round 4: 영양상태평가 전체 질문
- Round 5: 독성설문지, 갑상샘 기능 설문지 전체 질문
"""
import os
import sys
import json
import asyncio
from datetime import datetime

sys.path.append('/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend')

from app.services.checkup_design.rag_service import init_rag_engine

OUTPUT_FILE = "/home/workspace/PROJECT_WELLO_BEFE/pnt_all_questions_extracted.json"


async def extract_round_1(query_engine):
    """Round 1: 부신 기능 설문지"""
    print("\n" + "="*80)
    print("Round 1: 부신 기능 설문지 - 모든 질문 추출")
    print("="*80)
    
    query = """
    '당신만을 위한 맞춤 영양 치료' 문서에서 "부신 기능 설문지"의 모든 질문을 빠짐없이 나열해주세요.
    
    다음 형식으로 출력:
    
    ## 부신 기능 설문지
    
    1. [질문 텍스트]
       - 답변 옵션: [옵션1, 옵션2, ...]
    
    2. [질문 텍스트]
       - 답변 옵션: [옵션1, 옵션2, ...]
    
    (모든 질문을 빠짐없이 나열)
    """
    
    response = await query_engine.aquery(query)
    result = str(response)
    print(f"\n응답:\n{result}\n")
    
    return {
        "round": 1,
        "category": "부신_기능_설문지",
        "query": query,
        "response": result,
        "timestamp": datetime.now().isoformat()
    }


async def extract_round_2(query_engine):
    """Round 2: 통증평가도표, 현재 불편함 설문"""
    print("\n" + "="*80)
    print("Round 2: 통증평가도표, 현재 불편함 설문 - 모든 질문 추출")
    print("="*80)
    
    query = """
    '당신만을 위한 맞춤 영양 치료' 문서에서 다음 설문지들의 모든 질문을 빠짐없이 나열해주세요:
    
    1. 통증평가도표
    2. 현재 불편함에 대한 성찰과 기록
    
    각 설문지별로 다음 형식으로 출력:
    
    ## [설문지명]
    
    1. [질문 텍스트]
       - 답변 옵션/형식: [설명]
    
    2. [질문 텍스트]
       - 답변 옵션/형식: [설명]
    
    (모든 질문을 빠짐없이 나열)
    """
    
    response = await query_engine.aquery(query)
    result = str(response)
    print(f"\n응답:\n{result}\n")
    
    return {
        "round": 2,
        "categories": ["통증평가도표", "현재_불편함_설문"],
        "query": query,
        "response": result,
        "timestamp": datetime.now().isoformat()
    }


async def extract_round_3(query_engine):
    """Round 3: 일반 문진표"""
    print("\n" + "="*80)
    print("Round 3: 일반 문진표 - 모든 질문 추출")
    print("="*80)
    
    query = """
    '당신만을 위한 맞춤 영양 치료' 문서에서 "일반 문진표"의 모든 질문을 빠짐없이 나열해주세요.
    
    다음 형식으로 출력:
    
    ## 일반 문진표
    
    ### [카테고리명 (있는 경우)]
    
    1. [질문 텍스트]
       - 답변 옵션: [옵션1, 옵션2, ...]
    
    2. [질문 텍스트]
       - 답변 옵션: [옵션1, 옵션2, ...]
    
    (모든 카테고리와 질문을 빠짐없이 나열)
    """
    
    response = await query_engine.aquery(query)
    result = str(response)
    print(f"\n응답:\n{result}\n")
    
    return {
        "round": 3,
        "category": "일반_문진표",
        "query": query,
        "response": result,
        "timestamp": datetime.now().isoformat()
    }


async def extract_round_4(query_engine):
    """Round 4: 영양상태평가"""
    print("\n" + "="*80)
    print("Round 4: 영양상태평가 - 모든 질문 추출")
    print("="*80)
    
    query = """
    '당신만을 위한 맞춤 영양 치료' 문서에서 "영양상태평가"의 모든 질문을 빠짐없이 나열해주세요.
    
    다음 형식으로 출력:
    
    ## 영양상태평가
    
    ### [그룹명 (있는 경우)]
    
    1. [질문 텍스트]
       - 답변 옵션: [옵션1, 옵션2, ...]
       - 점수: [점수 체계 설명]
    
    2. [질문 텍스트]
       - 답변 옵션: [옵션1, 옵션2, ...]
       - 점수: [점수 체계 설명]
    
    (모든 그룹과 질문을 빠짐없이 나열)
    """
    
    response = await query_engine.aquery(query)
    result = str(response)
    print(f"\n응답:\n{result}\n")
    
    return {
        "round": 4,
        "category": "영양상태평가",
        "query": query,
        "response": result,
        "timestamp": datetime.now().isoformat()
    }


async def extract_round_5(query_engine):
    """Round 5: 독성설문지, 갑상샘 기능 설문지"""
    print("\n" + "="*80)
    print("Round 5: 독성설문지, 갑상샘 기능 설문지 - 모든 질문 추출")
    print("="*80)
    
    query = """
    '당신만을 위한 맞춤 영양 치료' 문서에서 다음 설문지들의 모든 질문을 빠짐없이 나열해주세요:
    
    1. 독성설문지
    2. 갑상샘 기능 설문지
    
    각 설문지별로 다음 형식으로 출력:
    
    ## [설문지명]
    
    ### [그룹/카테고리명 (있는 경우)]
    
    1. [질문 텍스트]
       - 답변 옵션: [옵션1, 옵션2, ...]
    
    2. [질문 텍스트]
       - 답변 옵션: [옵션1, 옵션2, ...]
    
    (모든 질문을 빠짐없이 나열)
    """
    
    response = await query_engine.aquery(query)
    result = str(response)
    print(f"\n응답:\n{result}\n")
    
    return {
        "round": 5,
        "categories": ["독성설문지", "갑상샘_기능_설문지"],
        "query": query,
        "response": result,
        "timestamp": datetime.now().isoformat()
    }


async def main():
    print("="*80)
    print("PNT 전체 질문 완전 추출 시작")
    print("목표: 7가지 설문지의 모든 질문 빠짐없이 추출")
    print("="*80)
    
    # RAG 엔진 초기화
    print("\nRAG 엔진 초기화 중...")
    query_engine = await init_rag_engine(use_local_vector_db=True)
    
    if not query_engine:
        print("❌ RAG 엔진 초기화 실패")
        return
    
    print("✅ RAG 엔진 초기화 완료\n")
    
    # 5회 반복 추출
    all_results = []
    
    # Round 1
    result1 = await extract_round_1(query_engine)
    all_results.append(result1)
    
    # Round 2
    result2 = await extract_round_2(query_engine)
    all_results.append(result2)
    
    # Round 3
    result3 = await extract_round_3(query_engine)
    all_results.append(result3)
    
    # Round 4
    result4 = await extract_round_4(query_engine)
    all_results.append(result4)
    
    # Round 5
    result5 = await extract_round_5(query_engine)
    all_results.append(result5)
    
    # 결과 저장
    output_data = {
        "extraction_date": datetime.now().isoformat(),
        "source": "당신만을 위한 맞춤 영양 치료",
        "total_rounds": 5,
        "survey_types": [
            "부신 기능 설문지",
            "통증평가도표",
            "현재 불편함에 대한 성찰과 기록",
            "일반 문진표",
            "영양상태평가",
            "독성설문지",
            "갑상샘 기능 설문지"
        ],
        "rounds": all_results
    }
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print("\n" + "="*80)
    print(f"✅ 전체 추출 완료!")
    print(f"결과 파일: {OUTPUT_FILE}")
    print("="*80)


if __name__ == "__main__":
    asyncio.run(main())
