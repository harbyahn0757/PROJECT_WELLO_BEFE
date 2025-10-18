#!/usr/bin/env python3
"""
틸코 API 직접 테스트
"""
import requests
import json
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding, serialization
from cryptography.hazmat.primitives.asymmetric import padding as asymmetric_padding
import base64

# 고정 AES 키 (레퍼런스와 동일)
AES_KEY_FIXED = b'\x00' * 16
AES_IV_FIXED = b'\x00' * 16

def aes_encrypt(key: bytes, iv: bytes, plain_text: str) -> str:
    """AES 암호화"""
    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(plain_text.encode()) + padder.finalize()
    
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    encryptor = cipher.encryptor()
    encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
    
    return base64.b64encode(encrypted_data).decode()

def rsa_encrypt(public_key_str: str, aes_key: bytes) -> str:
    """RSA 암호화"""
    try:
        key = serialization.load_pem_public_key(
            f"-----BEGIN PUBLIC KEY-----\n{public_key_str}\n-----END PUBLIC KEY-----".encode()
        )
        encrypted = key.encrypt(
            aes_key,
            asymmetric_padding.PKCS1v15()
        )
        return base64.b64encode(encrypted).decode()
    except Exception as e:
        print(f"RSA 암호화 실패: {e}")
        return "dummy_encrypted_aes_key"

def test_tilko_simple_auth():
    """틸코 간편인증 직접 테스트"""
    
    # 1. 공개키 조회
    print("🔍 1. 틸코 공개키 조회...")
    public_key_response = requests.get(
        "https://api.tilko.net/api/Auth/GetPublicKey",
        params={"APIkey": "8d5421c1ebfb42f38a6aac24c02db894"}
    )
    
    print(f"   공개키 응답: {public_key_response.status_code}")
    public_key_data = public_key_response.json()
    print(f"   Status: {public_key_data.get('Status')}")
    
    if public_key_data.get("Status") != "OK":
        print("❌ 공개키 조회 실패")
        return
    
    # 2. 간편인증 요청
    print("\n🔍 2. 간편인증 요청...")
    
    # 실제 안광수 정보
    user_name = "안광수-웰로"
    birth_date = "19810927"
    phone_no = "01056180757"
    
    # 데이터 암호화
    encrypted_name = aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, user_name)
    encrypted_birth = aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, birth_date)
    encrypted_phone = aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, phone_no)
    
    print(f"   사용자: {user_name}")
    print(f"   생년월일: {birth_date}")
    print(f"   전화번호: {phone_no}")
    
    # 간편인증 API 호출
    auth_response = requests.post(
        "https://api.tilko.net/api/v1.0/nhissimpleauth/simpleauthrequest",
        json={
            "PrivateAuthType": "0",
            "UserName": encrypted_name,
            "BirthDate": encrypted_birth,
            "UserCellphoneNumber": encrypted_phone
        },
        headers={
            "Content-Type": "application/json",
            "API-KEY": "8d5421c1ebfb42f38a6aac24c02db894",
            "ENC-KEY": rsa_encrypt(public_key_data["PublicKey"], AES_KEY_FIXED)
        },
        timeout=30
    )
    
    print(f"\n📊 간편인증 응답:")
    print(f"   상태코드: {auth_response.status_code}")
    
    try:
        auth_data = auth_response.json()
        print(f"   응답 내용: {json.dumps(auth_data, indent=2, ensure_ascii=False)}")
        
        # 핵심 필드 분석
        print(f"\n🔍 핵심 필드 분석:")
        print(f"   Status: {auth_data.get('Status')}")
        print(f"   Message: {auth_data.get('Message')}")
        print(f"   ErrorCode: {auth_data.get('ErrorCode')}")
        
        if auth_data.get("Status") == "OK":
            print("✅ 틸코 간편인증 요청 성공!")
            print("📱 카카오톡 메시지가 발송되었어야 합니다.")
        else:
            print("❌ 틸코 간편인증 요청 실패")
            
    except Exception as e:
        print(f"   JSON 파싱 실패: {e}")
        print(f"   원본 응답: {auth_response.text}")

if __name__ == "__main__":
    test_tilko_simple_auth()
