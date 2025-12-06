"""
프롬프트 테스트 간단 예시
"""
import asyncio
from test_prompt import PromptTester, test_rag_search


async def example_1_simple_test():
    """예시 1: 간단한 프롬프트 테스트"""
    print("\n" + "="*80)
    print("📝 예시 1: 간단한 건강 검진 추천")
    print("="*80)
    
    tester = PromptTester()
    
    system_message = """당신은 건강 검진 전문가입니다. 
환자의 정보를 분석하여 적절한 검진 항목을 추천해주세요."""
    
    user_message = """
환자 정보:
- 나이: 45세
- 성별: 남성
- 과거 검진: 혈압 경계, 혈당 정상
- 가족력: 당뇨, 고혈압

위 환자에게 추천할 검진 항목 3가지를 설명과 함께 알려주세요.
"""
    
    result = await tester.test_prompt(
        system_message=system_message,
        user_message=user_message,
        model="gpt-4o-mini",
        temperature=0.7,
        max_tokens=1000,
        json_mode=False,
        save_log=True
    )
    
    return result


async def example_2_json_mode():
    """예시 2: JSON 응답 모드"""
    print("\n" + "="*80)
    print("📝 예시 2: JSON 형식으로 검진 항목 받기")
    print("="*80)
    
    tester = PromptTester()
    
    system_message = """당신은 건강 검진 전문가입니다. 
반드시 JSON 형식으로 응답해주세요."""
    
    user_message = """
환자 정보:
- 나이: 45세
- 성별: 남성
- 과거 검진: 혈압 경계
- 가족력: 당뇨

다음 JSON 형식으로 응답하세요:
{
  "recommended_items": [
    {
      "name": "검진 항목명",
      "reason": "추천 이유",
      "priority": 1
    }
  ],
  "summary": "종합 의견"
}
"""
    
    result = await tester.test_prompt(
        system_message=system_message,
        user_message=user_message,
        model="gpt-4o",
        temperature=0.5,
        max_tokens=2000,
        json_mode=True,
        save_log=True
    )
    
    return result


async def example_3_step1_analysis():
    """예시 3: STEP 1 분석 프롬프트 테스트"""
    print("\n" + "="*80)
    print("📝 예시 3: 검진 설계 STEP 1 (빠른 분석)")
    print("="*80)
    
    tester = PromptTester()
    
    system_message = """당신은 베테랑 헬스 큐레이터이자 건강 데이터 분석 전문가입니다."""
    
    user_message = """
## 환자 정보
- 이름: 홍길동
- 현재 날짜: 2024년 12월 06일
- 나이: 45세
- 성별: 남성

## 과거 건강검진 데이터 (최근 5년)
### 1. 2023년 09/15 - 서울대병원
**이상 항목:**
- 총콜레스테롤: 240 mg/dL (이상)

**경계 항목:**
- 혈압(수축기): 135 mmHg (경계)
- 공복혈당: 110 mg/dL (경계)

## 문진 응답
- 체중 변화: 최근 1년간 5kg 증가
- 운동 빈도: 주 1-2회
- 가족력: 당뇨, 고혈압
- 흡연: 현재 흡연 중 (하루 10개비)
- 음주: 주 2-3회 (소주 2병)

## 사용자가 선택한 염려 항목
1. 혈압 (2023-09-15): 135 mmHg [경계]
2. 혈당 (2023-09-15): 110 mg/dL [경계]

위 정보를 바탕으로 다음 JSON 형식으로 분석 결과를 작성하세요:

{
  "patient_summary": "환자 상태 3줄 요약",
  "analysis": "종합 분석 (과거 수치와 현재 생활습관의 연관성 중심)",
  "risk_profile": [
    {
      "organ_system": "심뇌혈관",
      "risk_level": "High",
      "reason": "판단 근거"
    }
  ],
  "survey_reflection": "문진 내용이 검진 설계에 어떻게 반영될지 예고",
  "selected_concerns_analysis": [
    {
      "concern_name": "혈압 (2023년 09/15) [경계]",
      "concern_type": "checkup",
      "trend_analysis": "과거 추이 분석",
      "reflected_in_design": "검진 설계 반영 방식"
    }
  ]
}
"""
    
    result = await tester.test_prompt(
        system_message=system_message,
        user_message=user_message,
        model="gpt-4o-mini",
        temperature=0.5,
        max_tokens=2000,
        json_mode=True,
        save_log=True,
        patient_uuid="test_hongkildong"
    )
    
    return result


async def example_4_rag_search():
    """예시 4: RAG 검색 테스트"""
    print("\n" + "="*80)
    print("📝 예시 4: LlamaIndex RAG 검색 테스트")
    print("="*80)
    
    result = await test_rag_search()
    
    return result


async def main():
    """메인 실행"""
    print("\n" + "="*80)
    print("🧪 프롬프트 테스트 예시 실행")
    print("="*80)
    print("\n실행할 예시를 선택하세요:")
    print("  1. 간단한 프롬프트 테스트")
    print("  2. JSON 응답 모드 테스트")
    print("  3. STEP 1 분석 프롬프트 테스트")
    print("  4. RAG 검색 테스트 (LlamaIndex)")
    print("  5. 모든 예시 순차 실행")
    
    choice = input("\n선택 (1-5): ").strip()
    
    if choice == "1":
        await example_1_simple_test()
    elif choice == "2":
        await example_2_json_mode()
    elif choice == "3":
        await example_3_step1_analysis()
    elif choice == "4":
        await example_4_rag_search()
    elif choice == "5":
        await example_1_simple_test()
        await example_2_json_mode()
        await example_3_step1_analysis()
        await example_4_rag_search()
    else:
        print("❌ 잘못된 선택입니다.")
        return
    
    print("\n" + "="*80)
    print("✅ 테스트 완료!")
    print("="*80)


if __name__ == "__main__":
    asyncio.run(main())

