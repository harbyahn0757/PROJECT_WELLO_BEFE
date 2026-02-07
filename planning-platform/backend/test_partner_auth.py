#!/usr/bin/env python3
"""
파트너 API Key 인증 테스트 스크립트

사용법:
python test_partner_auth.py
"""

import requests
import json
import time

# 테스트 설정
BASE_URL = "http://localhost:8082"
TEST_API_KEY = "test_pk_12345678901234567890123456789012"

def test_api_key_auth():
    """API Key 인증 테스트"""
    
    print("🧪 파트너 API Key 인증 테스트 시작")
    print("=" * 50)
    
    # 테스트 데이터
    test_message = {
        "uuid": "test_user_123",
        "hospital_id": "test_hospital",
        "message": "안녕하세요, 건강 상담을 받고 싶습니다."
    }
    
    # 1. API Key 없이 요청 (401 에러 예상)
    print("\n1️⃣ API Key 없이 요청 테스트")
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/welno-rag-chat/message",
            json=test_message,
            timeout=10
        )
        print(f"   상태 코드: {response.status_code}")
        print(f"   응답: {response.text[:100]}...")
        
        if response.status_code == 401:
            print("   ✅ 예상대로 401 에러 발생 (인증 필요)")
        else:
            print("   ❌ 예상과 다른 응답")
            
    except Exception as e:
        print(f"   ❌ 요청 실패: {e}")
    
    # 2. 잘못된 API Key로 요청 (403 에러 예상)
    print("\n2️⃣ 잘못된 API Key로 요청 테스트")
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/welno-rag-chat/message",
            json=test_message,
            headers={"Authorization": f"Bearer invalid_api_key"},
            timeout=10
        )
        print(f"   상태 코드: {response.status_code}")
        print(f"   응답: {response.text[:100]}...")
        
        if response.status_code == 403:
            print("   ✅ 예상대로 403 에러 발생 (유효하지 않은 API Key)")
        else:
            print("   ❌ 예상과 다른 응답")
            
    except Exception as e:
        print(f"   ❌ 요청 실패: {e}")
    
    # 3. 유효한 API Key로 요청 (정상 처리 예상)
    print("\n3️⃣ 유효한 API Key로 요청 테스트")
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/welno-rag-chat/message",
            json=test_message,
            headers={"Authorization": f"Bearer {TEST_API_KEY}"},
            timeout=30,
            stream=True  # 스트리밍 응답
        )
        print(f"   상태 코드: {response.status_code}")
        
        if response.status_code == 200:
            print("   ✅ 인증 성공! 스트리밍 응답 수신 중...")
            
            # 스트리밍 응답 일부만 읽기
            chunk_count = 0
            for chunk in response.iter_content(chunk_size=1024, decode_unicode=True):
                if chunk:
                    print(f"   📦 청크 {chunk_count + 1}: {chunk[:50]}...")
                    chunk_count += 1
                    if chunk_count >= 3:  # 처음 3개 청크만 확인
                        break
            
            print(f"   ✅ 스트리밍 응답 정상 수신 ({chunk_count}개 청크)")
        else:
            print(f"   ❌ 예상과 다른 응답: {response.text[:100]}...")
            
    except Exception as e:
        print(f"   ❌ 요청 실패: {e}")
    
    # 4. X-API-Key 헤더로 요청 테스트
    print("\n4️⃣ X-API-Key 헤더로 요청 테스트")
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/welno-rag-chat/check-survey-trigger",
            json={
                "uuid": "test_user_123",
                "hospital_id": "test_hospital", 
                "session_id": "test_session"
            },
            headers={"X-API-Key": TEST_API_KEY},
            timeout=10
        )
        print(f"   상태 코드: {response.status_code}")
        
        if response.status_code == 200:
            print("   ✅ X-API-Key 헤더 인증 성공!")
            result = response.json()
            print(f"   응답: {json.dumps(result, ensure_ascii=False, indent=2)}")
        else:
            print(f"   ❌ 예상과 다른 응답: {response.text[:100]}...")
            
    except Exception as e:
        print(f"   ❌ 요청 실패: {e}")
    
    print("\n" + "=" * 50)
    print("🎯 테스트 완료!")
    print("\n💡 참고사항:")
    print("   - 서버가 실행 중이어야 합니다: python -m uvicorn app.main:app --host 0.0.0.0 --port 8082")
    print("   - 데이터베이스에 테스트 파트너가 등록되어 있어야 합니다")
    print(f"   - 테스트 API Key: {TEST_API_KEY}")


def test_rate_limiting():
    """Rate Limiting 테스트"""
    
    print("\n🚦 Rate Limiting 테스트 시작")
    print("=" * 30)
    
    # 빠른 연속 요청으로 Rate Limiting 테스트
    for i in range(5):
        try:
            response = requests.post(
                f"{BASE_URL}/api/v1/welno-rag-chat/check-survey-trigger",
                json={
                    "uuid": f"test_user_{i}",
                    "hospital_id": "test_hospital",
                    "session_id": f"test_session_{i}"
                },
                headers={"Authorization": f"Bearer {TEST_API_KEY}"},
                timeout=5
            )
            print(f"   요청 {i+1}: {response.status_code}")
            
            if response.status_code == 429:
                print("   🚦 Rate Limit 적용됨!")
                break
                
        except Exception as e:
            print(f"   요청 {i+1} 실패: {e}")
        
        time.sleep(0.1)  # 100ms 간격


if __name__ == "__main__":
    test_api_key_auth()
    # test_rate_limiting()  # 필요시 주석 해제