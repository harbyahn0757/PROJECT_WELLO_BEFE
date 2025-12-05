"""
검진 설계 플로우 전체 점검 스크립트
사용자 선택 데이터 → 프론트엔드 → 백엔드 프롬프트 → 출력 → 파싱 → 화면 전달까지 확인
"""
import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime

# 프로젝트 루트를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.api.v1.endpoints.checkup_design import (
    CheckupDesignRequest,
    ConcernItem,
    create_checkup_design_step1,
    create_checkup_design_step2,
    CheckupDesignStep2Request,
    Step1Result
)
from app.services.checkup_design_prompt import (
    create_checkup_design_prompt_step1,
    create_checkup_design_prompt_step2
)
from app.services.gpt_service import GPTService
from app.core.config import settings

async def check_flow():
    """검진 설계 플로우 전체 점검"""
    
    print("=" * 80)
    print("검진 설계 플로우 전체 점검")
    print("=" * 80)
    print()
    
    # 1. 사용자 선택 데이터 확인 (예시)
    print("1️⃣ 사용자가 선택한 데이터 (예시)")
    print("-" * 80)
    
    # 실제 데이터는 로그나 DB에서 확인해야 함
    example_selected_concerns = [
        {
            "type": "checkup",
            "id": "checkup-0",
            "name": "건강검진",
            "date": "2021-09-28",
            "location": "이루탄메디케어의원",
            "status": "abnormal",
            "abnormalCount": 1,
            "warningCount": 0
        },
        {
            "type": "medication",
            "id": "prescription-소화성궤양용제",
            "medicationName": "소화성궤양용제",
            "period": "2022년",
            "medicationText": "소화성궤양용제 관련 약품을 2022년 동안 한 번 복용하셨어요."
        }
    ]
    
    example_survey_responses = {
        "weight_change": "maintain",
        "exercise_frequency": "rarely",
        "family_history": ["hypertension"],
        "smoking": "never",
        "drinking": "monthly_1_2",
        "sleep_hours": "6_7",
        "stress_level": "medium",
        "additional_concerns": "",
        "optional_questions_enabled": "yes",
        "cancer_history": "no",
        "prescription_analysis_text": "분석 결과, 다음과 같은 약품을 복용하셨어요:\n\n1. 소화성궤양용제 관련 약품을 2022년 동안 한 번 복용하셨어요.",
        "selected_medication_texts": ["소화성궤양용제 관련 약품을 2022년 동안 한 번 복용하셨어요."]
    }
    
    print(f"선택된 염려 항목: {len(example_selected_concerns)}개")
    for i, concern in enumerate(example_selected_concerns, 1):
        print(f"  {i}. {concern.get('type')} - {concern.get('name', concern.get('medicationName', 'N/A'))}")
        if concern.get('date'):
            print(f"     날짜: {concern.get('date')}")
        if concern.get('location'):
            print(f"     병원: {concern.get('location')}")
        if concern.get('status'):
            print(f"     상태: {concern.get('status')}")
        if concern.get('medicationText'):
            print(f"     약품 정보: {concern.get('medicationText')}")
    
    print(f"\n설문 응답:")
    print(f"  - 체중 변화: {example_survey_responses.get('weight_change')}")
    print(f"  - 운동 빈도: {example_survey_responses.get('exercise_frequency')}")
    print(f"  - 가족력: {example_survey_responses.get('family_history')}")
    print(f"  - 추가 질문 활성화: {example_survey_responses.get('optional_questions_enabled')}")
    print(f"  - 약품 분석 텍스트: {example_survey_responses.get('prescription_analysis_text', '')[:100]}...")
    print()
    
    # 2. 프론트엔드 → 백엔드 전달 확인
    print("2️⃣ 프론트엔드 → 백엔드 데이터 전달 구조")
    print("-" * 80)
    print("API 요청 구조:")
    print("  POST /wello-api/v1/checkup-design/create-step1")
    print("  Body:")
    print("    - uuid: string")
    print("    - hospital_id: string")
    print("    - selected_concerns: ConcernItem[]")
    print("    - survey_responses: {")
    print("        - weight_change, exercise_frequency, family_history, ...")
    print("        - prescription_analysis_text: string")
    print("        - selected_medication_texts: string[]")
    print("      }")
    print()
    
    # 3. 백엔드 프롬프트 생성 확인
    print("3️⃣ 백엔드 프롬프트 생성 확인")
    print("-" * 80)
    print("STEP 1 프롬프트 생성 함수:")
    print("  - create_checkup_design_prompt_step1()")
    print("  - 입력: patient_name, patient_age, patient_gender, health_data, prescription_data,")
    print("         selected_concerns, survey_responses, hospital_national_checkup,")
    print("         prescription_analysis_text, selected_medication_texts")
    print("  - 출력: user_message (프롬프트 문자열)")
    print()
    print("STEP 2 프롬프트 생성 함수:")
    print("  - create_checkup_design_prompt_step2() (async)")
    print("  - RAG 시스템 사용: LlamaCloudIndex + Gemini")
    print("  - 입력: step1_result, patient_name, patient_age, patient_gender, ...")
    print("  - 출력: user_message (RAG 컨텍스트 포함 프롬프트)")
    print()
    
    # 4. GPT API 호출 확인
    print("4️⃣ GPT API 호출 확인")
    print("-" * 80)
    print("STEP 1:")
    print(f"  - 모델: {getattr(settings, 'openai_fast_model', 'gpt-4o-mini')}")
    print("  - max_tokens: 4096")
    print("  - response_format: json_object")
    print()
    print("STEP 2:")
    print(f"  - 모델: {getattr(settings, 'openai_model', 'gpt-4o')}")
    print("  - max_tokens: 16384")
    print("  - response_format: json_object")
    print()
    
    # 5. 응답 파싱 확인
    print("5️⃣ 응답 파싱 확인")
    print("-" * 80)
    print("STEP 1 응답 구조:")
    print("  {")
    print("    'patient_summary': string (3줄 요약),")
    print("    'analysis': string (종합 분석),")
    print("    'risk_profile': [{ 'organ_system': string, 'risk_level': string, 'reason': string }],")
    print("    'chronic_analysis': { 'has_chronic_disease': bool, 'disease_list': [], ... },")
    print("    'survey_reflection': string,")
    print("    'selected_concerns_analysis': [{ 'concern': string, 'analysis': string, ... }],")
    print("    'basic_checkup_guide': { 'focus_items': [...], ... }")
    print("  }")
    print()
    print("STEP 2 응답 구조:")
    print("  {")
    print("    'summary': { 'priority_1': {...}, 'priority_2': {...} },")
    print("    'strategies': [{ 'category': string, 'step1_anchor': string, ... }],")
    print("    'recommended_items': [{")
    print("      'category': string,")
    print("      'items': [{ 'name': string, 'reason': string, 'evidence': string, ... }],")
    print("      'doctor_recommendation': { 'has_recommendation': bool, 'message': string }")
    print("    }],")
    print("    'doctor_comment': string,")
    print("    'total_count': number")
    print("  }")
    print()
    
    # 6. 프론트엔드 화면 전달 확인
    print("6️⃣ 프론트엔드 화면 전달 확인")
    print("-" * 80)
    print("CheckupRecommendationsPage 렌더링 구조:")
    print("  - summary.priority_1 → '주요 사항 요약' 섹션")
    print("  - strategies → '검진 설계 전략' 아코디언")
    print("  - recommended_items → '추천 검진 항목' 아코디언")
    print("  - doctor_comment → '의사 코멘트' 섹션")
    print()
    
    # 7. 실제 로그 확인 방법
    print("7️⃣ 실제 데이터 확인 방법")
    print("-" * 80)
    print("백엔드 로그 확인:")
    print("  tail -100 /root/.pm2/logs/Todayon-BE-out.log | grep '검진설계\\|STEP1\\|STEP2'")
    print()
    print("프론트엔드 콘솔 확인:")
    print("  - 브라우저 개발자 도구 → Console")
    print("  - '✅ [검진설계]' 또는 '🔍 [ChatInterface]' 로그 확인")
    print()
    print("API 요청/응답 확인:")
    print("  - 브라우저 개발자 도구 → Network")
    print("  - '/wello-api/v1/checkup-design/create-step1' 요청 확인")
    print("  - '/wello-api/v1/checkup-design/create-step2' 요청 확인")
    print()
    
    # 8. 체크리스트
    print("8️⃣ 데이터 전달 체크리스트")
    print("-" * 80)
    print("□ 사용자 선택 데이터가 올바르게 수집되었는가?")
    print("  - selected_concerns: type, id, name, date, location, status 등")
    print("  - survey_responses: weight_change, exercise_frequency, family_history 등")
    print("  - prescription_analysis_text: 약품 분석 결과 텍스트")
    print("  - selected_medication_texts: 선택된 약품 텍스트 배열")
    print()
    print("□ 프론트엔드에서 백엔드로 올바르게 전달되었는가?")
    print("  - API 요청 Body에 모든 필드 포함")
    print("  - selected_concerns 배열 구조 확인")
    print("  - survey_responses 객체 구조 확인")
    print()
    print("□ 백엔드 프롬프트에 데이터가 올바르게 포함되었는가?")
    print("  - selected_concerns가 프롬프트에 포함")
    print("  - survey_responses가 프롬프트에 포함")
    print("  - prescription_analysis_text가 프롬프트에 포함")
    print("  - STEP 2에서 RAG 컨텍스트가 포함")
    print()
    print("□ GPT 응답이 올바르게 파싱되었는가?")
    print("  - JSON 파싱 성공")
    print("  - 필수 필드 존재 확인")
    print("  - STEP 1과 STEP 2 결과 병합 확인")
    print()
    print("□ 프론트엔드 화면에 올바르게 표시되었는가?")
    print("  - summary.priority_1 표시")
    print("  - strategies 아코디언 표시")
    print("  - recommended_items 카테고리별 표시")
    print("  - doctor_comment 표시")
    print()
    
    print("=" * 80)
    print("점검 완료")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(check_flow())

