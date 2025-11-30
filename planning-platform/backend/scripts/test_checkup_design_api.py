#!/usr/bin/env python3
"""
검진 설계 API 테스트 스크립트
실제 데이터로 API 호출 테스트
"""
import asyncio
import json
import sys
import os
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import httpx
from datetime import datetime

# 테스트 데이터
TEST_UUID = "e3471a9a-2d67-4a23-8599-849963397d1c"
TEST_HOSPITAL_ID = "KIM_HW_CLINIC"
# API_BASE_URL = "http://localhost:8082"  # 개발 서버
API_BASE_URL = "http://localhost:9282"  # 실제 서버 포트

# 테스트용 염려 항목 (실제 데이터 기반)
TEST_SELECTED_CONCERNS = [
    {
        "type": "checkup",
        "id": "checkup-0",
        "name": "건강검진",
        "date": "2021/09/28",
        "location": "이루탄메디케어의원",
        "status": "abnormal",
        "abnormalCount": 2,
        "warningCount": 1
    }
]

# 테스트용 설문 응답
TEST_SURVEY_RESPONSES = {
    "weight_change": "increase_some",
    "exercise_frequency": "sometimes",
    "family_history": ["hypertension", "diabetes"],
    "smoking": "non_smoker",
    "drinking": "monthly_1_2",
    "sleep_hours": "6_7",
    "stress_level": "medium",
    "additional_concerns": "최근 두통이 자주 발생합니다."
}

async def test_checkup_design_api():
    """검진 설계 API 테스트"""
    print("=" * 80)
    print("검진 설계 API 테스트 시작")
    print("=" * 80)
    print(f"시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"환자 UUID: {TEST_UUID}")
    print(f"병원 ID: {TEST_HOSPITAL_ID}")
    print()
    
    # 요청 데이터 구성
    request_data = {
        "uuid": TEST_UUID,
        "hospital_id": TEST_HOSPITAL_ID,
        "selected_concerns": TEST_SELECTED_CONCERNS,
        "survey_responses": TEST_SURVEY_RESPONSES
    }
    
    print("📤 요청 데이터:")
    print(json.dumps(request_data, ensure_ascii=False, indent=2))
    print()
    
    # API 호출
    url = f"{API_BASE_URL}/wello-api/v1/checkup-design/create"
    print(f"🌐 API URL: {url}")
    print()
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            print("⏳ API 호출 중...")
            start_time = datetime.now()
            
            response = await client.post(
                url,
                json=request_data,
                headers={
                    "Content-Type": "application/json"
                }
            )
            
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            print(f"⏱️  응답 시간: {duration:.2f}초")
            print(f"📊 HTTP 상태 코드: {response.status_code}")
            print()
            
            if response.status_code == 200:
                result = response.json()
                print("✅ API 호출 성공!")
                print()
                print("📋 응답 데이터:")
                print(json.dumps(result, ensure_ascii=False, indent=2))
                print()
                
                # 응답 구조 검증
                if result.get("success") and result.get("data"):
                    data = result.get("data", {})
                    recommended_items = data.get("recommended_items", [])
                    analysis = data.get("analysis", "")
                    total_count = data.get("total_count", 0)
                    
                    print("✅ 응답 구조 검증:")
                    print(f"   - 성공 여부: {result.get('success')}")
                    print(f"   - 카테고리 수: {len(recommended_items)}")
                    print(f"   - 총 항목 수: {total_count}")
                    print(f"   - 분석 내용 길이: {len(analysis)}자")
                    print()
                    
                    # 카테고리별 상세 정보
                    if recommended_items:
                        print("📂 카테고리별 상세:")
                        for idx, category in enumerate(recommended_items, 1):
                            print(f"   {idx}. {category.get('category', 'N/A')}")
                            print(f"      - 항목 수: {category.get('itemCount', 0)}")
                            items = category.get('items', [])
                            if items:
                                print(f"      - 첫 번째 항목: {items[0].get('name', 'N/A')}")
                            if category.get('doctor_recommendation', {}).get('has_recommendation'):
                                print(f"      - 의사 추천: 있음")
                            print()
                    
                    return True
                else:
                    print("❌ 응답 구조가 올바르지 않음")
                    print(f"   응답: {result}")
                    return False
            else:
                print(f"❌ API 호출 실패: {response.status_code}")
                print(f"   응답: {response.text}")
                return False
                
    except httpx.TimeoutException:
        print("❌ API 호출 타임아웃 (120초 초과)")
        return False
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def test_without_survey():
    """설문 없이 테스트"""
    print("=" * 80)
    print("설문 없이 검진 설계 API 테스트")
    print("=" * 80)
    print()
    
    request_data = {
        "uuid": TEST_UUID,
        "hospital_id": TEST_HOSPITAL_ID,
        "selected_concerns": TEST_SELECTED_CONCERNS
    }
    
    url = f"{API_BASE_URL}/wello-api/v1/checkup-design/create"
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=request_data)
            
            if response.status_code == 200:
                result = response.json()
                print("✅ 설문 없이도 정상 동작")
                print(f"   카테고리 수: {len(result.get('data', {}).get('recommended_items', []))}")
                return True
            else:
                print(f"❌ 실패: {response.status_code}")
                print(response.text)
                return False
    except Exception as e:
        print(f"❌ 오류: {str(e)}")
        return False

async def main():
    """메인 테스트 함수"""
    print("\n" + "=" * 80)
    print("검진 설계 API 통합 테스트")
    print("=" * 80 + "\n")
    
    # 테스트 1: 설문 포함 전체 테스트
    print("🔬 테스트 1: 설문 포함 전체 테스트")
    print("-" * 80)
    result1 = await test_checkup_design_api()
    print()
    
    # 테스트 2: 설문 없이 테스트
    print("🔬 테스트 2: 설문 없이 테스트")
    print("-" * 80)
    result2 = await test_without_survey()
    print()
    
    # 결과 요약
    print("=" * 80)
    print("테스트 결과 요약")
    print("=" * 80)
    print(f"테스트 1 (설문 포함): {'✅ 통과' if result1 else '❌ 실패'}")
    print(f"테스트 2 (설문 없음): {'✅ 통과' if result2 else '❌ 실패'}")
    print()
    
    if result1 and result2:
        print("🎉 모든 테스트 통과!")
        return 0
    else:
        print("⚠️  일부 테스트 실패")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

