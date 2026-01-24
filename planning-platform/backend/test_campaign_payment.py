#!/usr/bin/env python3
"""
질병예측 리포트 시스템 통합 테스트
- 암호화/복호화 테스트
- API 엔드포인트 테스트
- 데이터베이스 연결 테스트
"""

import base64
import json
import requests
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

# 설정
API_BASE = "http://localhost:8082/api/v1/campaigns"
PARTNER_AES_KEY = b"kindhabit_disease_predict_key_32"
PARTNER_AES_IV = b"kindhabit_iv_16 "  # 공백 포함!

def encrypt_user_data(data_dict):
    """사용자 데이터 AES-256-CBC 암호화"""
    cipher = AES.new(PARTNER_AES_KEY, AES.MODE_CBC, PARTNER_AES_IV)
    json_str = json.dumps(data_dict).encode('utf-8')
    encrypted = cipher.encrypt(pad(json_str, AES.block_size))
    return base64.b64encode(encrypted).decode('utf-8')

def decrypt_user_data(encrypted_base64):
    """사용자 데이터 AES-256-CBC 복호화"""
    encrypted_data = base64.b64decode(encrypted_base64)
    cipher = AES.new(PARTNER_AES_KEY, AES.MODE_CBC, PARTNER_AES_IV)
    decrypted_raw = cipher.decrypt(encrypted_data)
    decrypted_data = unpad(decrypted_raw, AES.block_size)
    return json.loads(decrypted_data.decode('utf-8'))

def test_encryption():
    """암호화/복호화 테스트"""
    print("=" * 60)
    print("1. 암호화/복호화 테스트")
    print("=" * 60)
    
    test_data = {
        "name": "홍길동",
        "birth": "1990-01-01",
        "gender": "1",
        "email": "test@example.com",
        "height": "175",
        "weight": "70",
        "waist": "85",
        "bphigh": "120",
        "bplwst": "80",
        "blds": "95",
        "totchole": "180",
        "triglyceride": "150",
        "hdlchole": "50",
        "ldlchole": "100"
    }
    
    print(f"\n원본 데이터:")
    print(json.dumps(test_data, ensure_ascii=False, indent=2))
    
    # 암호화
    encrypted = encrypt_user_data(test_data)
    print(f"\n암호화된 데이터 (Base64):")
    print(encrypted[:80] + "..." if len(encrypted) > 80 else encrypted)
    
    # 복호화
    decrypted = decrypt_user_data(encrypted)
    print(f"\n복호화된 데이터:")
    print(json.dumps(decrypted, ensure_ascii=False, indent=2))
    
    # 검증
    if test_data == decrypted:
        print("\n✅ 암호화/복호화 성공!")
        return encrypted, test_data
    else:
        print("\n❌ 암호화/복호화 실패!")
        return None, None

def test_init_payment_api(encrypted_data, user_data):
    """결제 초기화 API 테스트"""
    print("\n" + "=" * 60)
    print("2. 결제 초기화 API 테스트")
    print("=" * 60)
    
    url = f"{API_BASE}/disease-prediction/init-payment/"
    payload = {
        "data": encrypted_data,
        "uuid": "test-user-001"
    }
    
    print(f"\nAPI 호출: POST {url}")
    print(f"Payload: {json.dumps(payload, indent=2)[:200]}...")
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"\n응답 상태: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n응답 데이터:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            
            if data.get('success'):
                print("\n✅ 결제 초기화 성공!")
                return data.get('P_OID')
            else:
                print(f"\n❌ 결제 초기화 실패: {data.get('error')}")
        else:
            print(f"\n❌ API 호출 실패: {response.text}")
    
    except Exception as e:
        print(f"\n❌ 오류 발생: {str(e)}")
    
    return None

def test_update_email_api(oid):
    """이메일 업데이트 API 테스트"""
    print("\n" + "=" * 60)
    print("3. 이메일 업데이트 API 테스트")
    print("=" * 60)
    
    if not oid:
        print("⚠️ OID가 없어 테스트를 건너뜁니다.")
        return
    
    url = f"{API_BASE}/disease-prediction/update-email/"
    payload = {
        "oid": oid,
        "email": "updated-test@example.com"
    }
    
    print(f"\nAPI 호출: POST {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"\n응답 상태: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n응답 데이터:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            
            if data.get('success'):
                print("\n✅ 이메일 업데이트 성공!")
            else:
                print(f"\n⚠️ {data.get('message')}")
        else:
            print(f"\n❌ API 호출 실패: {response.text}")
    
    except Exception as e:
        print(f"\n❌ 오류 발생: {str(e)}")

def generate_sample_url(encrypted_data):
    """샘플 연동 URL 생성"""
    print("\n" + "=" * 60)
    print("4. 외부 파트너 연동 URL 샘플")
    print("=" * 60)
    
    base_url = "https://xogxog.com/welno/campaigns/disease-prediction"
    sample_url = f"{base_url}/?data={encrypted_data}&uuid=partner-user-001"
    
    print(f"\n연동 URL:")
    print(sample_url)
    
    print(f"\n로컬 테스트 URL:")
    local_url = f"http://localhost:9283/welno/campaigns/disease-prediction/?data={encrypted_data}&uuid=test-user-001"
    print(local_url)

def main():
    print("\n" + "🔬 질병예측 리포트 시스템 통합 테스트 시작" + "\n")
    
    # 1. 암호화/복호화 테스트
    encrypted_data, user_data = test_encryption()
    
    if not encrypted_data:
        print("\n❌ 암호화 테스트 실패로 중단합니다.")
        return
    
    # 2. 결제 초기화 API 테스트
    oid = test_init_payment_api(encrypted_data, user_data)
    
    # 3. 이메일 업데이트 API 테스트
    if oid:
        test_update_email_api(oid)
    
    # 4. 샘플 URL 생성
    generate_sample_url(encrypted_data)
    
    print("\n" + "=" * 60)
    print("✅ 통합 테스트 완료")
    print("=" * 60)
    print("\n다음 단계:")
    print("1. Frontend 빌드: cd frontend && npm run build")
    print("2. Backend 재시작: pm2 restart Welno_BE")
    print("3. 브라우저에서 로컬 테스트 URL 접속")
    print("4. 이니시스 테스트 결제 진행\n")

if __name__ == "__main__":
    main()
