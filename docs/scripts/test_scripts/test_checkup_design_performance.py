#!/usr/bin/env python3
"""
검진 설계 API 성능 테스트 스크립트
기존 환자 데이터로 API 호출하여 응답 시간 측정
"""

import requests
import time
import json

# 테스트 설정
API_BASE_URL = "http://localhost:8082"
PATIENT_UUID = "707af3bb-e244-4efd-8bd1-4b01c6b85b90"  # 안광수 환자 UUID

# 간단한 테스트 데이터 (최소 필수 필드만)
test_payload = {
    "uuid": PATIENT_UUID,
    "patient_name": "안광수",
    "birth_date": "19800101",
    "gender": "M",
    "selected_concerns": [
        {
            "name": "혈압 (2021-09-28) [경계]",
            "type": "checkup",
            "date": "2021-09-28",
            "value": "140mmHg"
        }
    ],
    "survey_responses": {},
    "hospital_recommended_items": [],
    "hospital_external_checkup_items": [],
    "hospital_national_checkup_items": []
}

def test_api():
    """API 호출 및 성능 측정"""
    print("=" * 80)
    print("검진 설계 API 성능 테스트")
    print("=" * 80)
    print(f"환자: {test_payload['patient_name']}")
    print(f"UUID: {PATIENT_UUID}")
    print(f"URL: {API_BASE_URL}/api/v1/checkup-design/create")
    print("=" * 80)
    
    # API 호출
    start_time = time.time()
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/v1/checkup-design/create",
            json=test_payload,
            timeout=120  # 2분 타임아웃
        )
        
        elapsed_time = time.time() - start_time
        
        print(f"\n✅ API 호출 완료")
        print(f"⏱️  총 소요 시간: {elapsed_time:.2f}초")
        print(f"📊 HTTP 상태: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 응답 성공")
            print(f"📄 응답 키: {list(result.keys())}")
            
            # 상세 시간 분석 (로그에서 확인 필요)
            print("\n" + "=" * 80)
            print("⚠️  상세 시간 분석은 PM2 로그에서 확인하세요:")
            print("   pm2 logs WELLO_BE --lines 100 | grep 'TIMING'")
            print("=" * 80)
        else:
            print(f"❌ API 오류: {response.status_code}")
            print(f"응답: {response.text[:500]}")
            
    except requests.exceptions.Timeout:
        elapsed_time = time.time() - start_time
        print(f"⏱️  타임아웃! ({elapsed_time:.2f}초 초과)")
    except Exception as e:
        elapsed_time = time.time() - start_time
        print(f"❌ 오류 발생: {str(e)}")
        print(f"⏱️  경과 시간: {elapsed_time:.2f}초")

if __name__ == "__main__":
    test_api()
