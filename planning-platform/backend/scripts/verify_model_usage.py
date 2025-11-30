#!/usr/bin/env python3
"""
모델 사용 여부 확인 스크립트
실제로 Perplexity 또는 OpenAI 모델이 사용되었는지 확인
"""
import asyncio
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import httpx
import json
from datetime import datetime

TEST_UUID = "e3471a9a-2d67-4a23-8599-849963397d1c"
TEST_HOSPITAL_ID = "KIM_HW_CLINIC"
API_BASE_URL = "http://localhost:9282"

async def verify_model_usage():
    """모델 사용 여부 확인"""
    print("=" * 80)
    print("모델 사용 여부 확인")
    print("=" * 80)
    print()
    
    # 간단한 요청으로 테스트
    request_data = {
        "uuid": TEST_UUID,
        "hospital_id": TEST_HOSPITAL_ID,
        "selected_concerns": [
            {
                "type": "checkup",
                "id": "test-1",
                "name": "건강검진",
                "date": "2021/09/28",
                "location": "테스트 병원",
                "status": "abnormal"
            }
        ],
        "survey_responses": {
            "weight_change": "maintain",
            "exercise_frequency": "sometimes",
            "family_history": ["hypertension"],
            "smoking": "non_smoker",
            "drinking": "monthly_1_2",
            "sleep_hours": "6_7",
            "stress_level": "medium"
        }
    }
    
    url = f"{API_BASE_URL}/wello-api/v1/checkup-design/create"
    
    print(f"📤 API 호출: {url}")
    print(f"⏳ 모델 응답 대기 중...")
    print()
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            start_time = datetime.now()
            
            response = await client.post(
                url,
                json=request_data,
                headers={"Content-Type": "application/json"}
            )
            
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            print(f"⏱️  응답 시간: {duration:.2f}초")
            print(f"📊 HTTP 상태: {response.status_code}")
            print()
            
            if response.status_code == 200:
                result = response.json()
                
                if result.get("success") and result.get("data"):
                    data = result.get("data", {})
                    recommended_items = data.get("recommended_items", [])
                    
                    print("✅ 모델 응답 수신 성공!")
                    print()
                    print(f"📋 응답 구조:")
                    print(f"   - 카테고리 수: {len(recommended_items)}")
                    print(f"   - 총 항목 수: {data.get('total_count', 0)}")
                    print(f"   - 분석 내용: {'있음' if data.get('analysis') else '없음'}")
                    print()
                    
                    # 첫 번째 카테고리 상세 확인
                    if recommended_items:
                        first_cat = recommended_items[0]
                        print(f"📂 첫 번째 카테고리:")
                        print(f"   - 이름: {first_cat.get('category', 'N/A')}")
                        print(f"   - 항목 수: {len(first_cat.get('items', []))}")
                        
                        if first_cat.get('items'):
                            first_item = first_cat['items'][0]
                            print(f"   - 첫 번째 항목:")
                            print(f"     * 이름: {first_item.get('name', 'N/A')}")
                            print(f"     * 설명: {first_item.get('description', 'N/A')[:50]}...")
                            print(f"     * 추천 이유: {first_item.get('reason', 'N/A')[:50]}...")
                        print()
                    
                    # 응답 시간으로 모델 추정
                    if duration > 10:
                        print("🤖 추정 모델: Perplexity (응답 시간이 10초 이상)")
                    elif duration > 5:
                        print("🤖 추정 모델: OpenAI GPT-4 (응답 시간이 5-10초)")
                    else:
                        print("🤖 추정 모델: OpenAI GPT-4o-mini (빠른 응답)")
                    
                    print()
                    print("💡 실제 사용된 모델을 확인하려면 백엔드 로그를 확인하세요:")
                    print("   tail -f /root/.pm2/logs/Todayon-BE-out.log | grep '검진설계'")
                    
                    return True
                else:
                    print("❌ 응답 구조가 올바르지 않음")
                    return False
            else:
                print(f"❌ API 호출 실패: {response.status_code}")
                print(f"   응답: {response.text[:200]}")
                return False
                
    except Exception as e:
        print(f"❌ 오류: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    asyncio.run(verify_model_usage())

