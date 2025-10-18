"""
틸코 API 연동 유틸리티
"""
from typing import Dict, Any
import httpx
import json
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.asymmetric import padding as asymmetric_padding
from cryptography.hazmat.primitives import serialization, hashes
from datetime import datetime, timedelta
import base64
import os
# 더미 데이터 import 제거 - 실제 API만 사용

# .env 파일에서 환경변수 로드
from dotenv import load_dotenv
load_dotenv()

TILKO_API_HOST = os.getenv("TILKO_API_HOST", "https://api.tilko.net")
TILKO_API_KEY = os.getenv("TILKO_API_KEY")
TILKO_AES_KEY = os.getenv("TILKO_AES_KEY")
TILKO_AES_IV = os.getenv("TILKO_AES_IV")

# 레퍼런스 코드와 동일한 AES 설정 (고정 16바이트 0값)
AES_KEY_FIXED = b'\x00' * 16
AES_IV_FIXED = b'\x00' * 16

async def get_public_key() -> str:
    """틸코 공개키 조회"""
    if not TILKO_API_KEY:
        raise ValueError("TILKO_API_KEY 환경변수가 설정되지 않았습니다.")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(
            f"{TILKO_API_HOST}/api/Auth/GetPublicKey",
            params={"APIkey": TILKO_API_KEY}
        )
        response.raise_for_status()
        return response.json()["PublicKey"]

def aes_encrypt(key: bytes, iv: bytes, plain_text: str) -> str:
    """AES 암호화"""
    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(plain_text.encode()) + padder.finalize()
    
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    encryptor = cipher.encryptor()
    encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
    
    return base64.b64encode(encrypted_data).decode()

def rsa_encrypt(public_key: str, aes_key: bytes) -> str:
    """RSA 암호화 (레퍼런스 구조대로 pkcs1 패딩)"""
    try:
        key = serialization.load_pem_public_key(
            f"-----BEGIN PUBLIC KEY-----\n{public_key}\n-----END PUBLIC KEY-----".encode()
        )
        encrypted = key.encrypt(
            aes_key,
            asymmetric_padding.PKCS1v15()
        )
        return base64.b64encode(encrypted).decode()
    except Exception as e:
        print(f"❌ RSA 암호화 실패: {e}")
        raise ValueError(f"RSA 암호화 실패: {e}")

async def simple_auth(
    private_auth_type: str,
    user_name: str,
    birthdate: str,
    phone_no: str
) -> Dict[str, Any]:
    """카카오 간편인증 요청 (레퍼런스 구조대로)"""
    if not TILKO_API_KEY:
        raise ValueError("TILKO_API_KEY 환경변수가 설정되지 않았습니다.")
    
    print(f"🔍 [틸코API] simple_auth 호출 시작 - 사용자: {user_name}")
    
    public_key = await get_public_key()
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{TILKO_API_HOST}/api/v1.0/nhissimpleauth/simpleauthrequest",
            json={
                "PrivateAuthType": private_auth_type,
                "UserName": aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, user_name),
                "BirthDate": aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, birthdate),
                "UserCellphoneNumber": aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, phone_no)
            },
            headers={
                "Content-Type": "application/json",
                "API-KEY": TILKO_API_KEY,
                "ENC-KEY": rsa_encrypt(public_key, AES_KEY_FIXED)
            }
        )
        response.raise_for_status()
        result = response.json()
        print(f"🔍 [틸코API] simple_auth 실제 응답: {result}")
        return result

async def get_health_screening_data(
    request_login: Dict[str, str]
) -> Dict[str, Any]:
    """건강검진 데이터 조회 (레퍼런스 구조대로)"""
    if not TILKO_API_KEY:
        raise ValueError("TILKO_API_KEY 환경변수가 설정되지 않았습니다.")
    
    print(f"🏥 [건강검진API] 시작 - CxId: {request_login.get('cxId', '')[:10]}...")
    print(f"🏥 [건강검진API] 사용자: {request_login.get('userName', 'Unknown')}")
    print(f"🏥 [건강검진API] 엔드포인트: /api/v1.0/NhisSimpleAuth/Ggpab003M0105")
    
    public_key = await get_public_key()
    
    request_data = {
        "CxId": request_login.get("CxId", ""),
        "PrivateAuthType": request_login.get("PrivateAuthType", "0"),
        "ReqTxId": request_login.get("ReqTxId", ""),
        "Token": request_login.get("Token", ""),
        "TxId": request_login.get("TxId", ""),
        "UserName": aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, request_login.get("UserName", "")),
        "BirthDate": aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, request_login.get("BirthDate", "")),
        "UserCellphoneNumber": aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, request_login.get("UserCellphoneNumber", ""))
    }
    
    print(f"🏥 [건강검진API] 요청 파라미터 수: {len(request_data)}")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{TILKO_API_HOST}/api/v1.0/NhisSimpleAuth/Ggpab003M0105",
            json=request_data,
            headers={
                "Content-Type": "application/json",
                "API-KEY": TILKO_API_KEY,
                "ENC-KEY": rsa_encrypt(public_key, AES_KEY_FIXED)
            }
        )
        
        print(f"🏥 [건강검진API] 응답 상태: {response.status_code}")
        print(f"🏥 [건강검진API] 응답 Content-Type: {response.headers.get('content-type', 'Unknown')}")
        
        response.raise_for_status()
        
        # HTML 응답 체크 (NHIS 로그인 페이지 등)
        content_type = response.headers.get('content-type', '').lower()
        if 'text/html' in content_type:
            print(f"⚠️ [건강검진API] HTML 응답 감지 - 인증 미완료 상태")
            return {
                "Status": "Error",
                "ResultCode": "AUTH_PENDING", 
                "ErrMsg": "간편인증 로그인 요청이 실패했습니다. (사용자가 아직 카카오톡에서 인증하지 않음)",
                "Message": "인증 대기 중"
            }
        
        result = response.json()
        
        print(f"🏥 [건강검진API] 응답 Status: {result.get('Status', 'Unknown')}")
        
        # Status가 Error인 경우 상세 정보 출력
        if result.get('Status') == 'Error':
            print(f"❌ [건강검진API] 에러 발생!")
            print(f"   - ResultCode: {result.get('ResultCode', 'Unknown')}")
            print(f"   - ErrMsg: {result.get('ErrMsg', 'Unknown')}")
            print(f"   - 전체 응답: {result}")
        
        if result.get("ResultList"):
            print(f"🏥 [건강검진API] 검진 기록 수: {len(result['ResultList'])}")
        
        return result

async def get_prescription_data(
    request_login: Dict[str, str]
) -> Dict[str, Any]:
    """처방전 데이터 조회 (레퍼런스 구조대로)"""
    if not TILKO_API_KEY:
        raise ValueError("TILKO_API_KEY 환경변수가 설정되지 않았습니다.")
    
    print(f"💊 [처방전API] 시작 - CxId: {request_login.get('cxId', '')[:10]}...")
    print(f"💊 [처방전API] 사용자: {request_login.get('userName', 'Unknown')}")
    print(f"💊 [처방전API] 엔드포인트: /api/v1.0/NhisSimpleAuth/RetrieveTreatmentInjectionInformationPerson")
    
    public_key = await get_public_key()
    start_date = (datetime.now() - timedelta(days=420)).strftime("%Y%m%d")  # 14개월 전
    end_date = (datetime.now() - timedelta(days=60)).strftime("%Y%m%d")     # 2개월 전
    
    print(f"💊 [처방전API] 조회 기간: {start_date} ~ {end_date} (14개월 전 ~ 2개월 전)")
    
    request_data = {
        "CxId": request_login.get("CxId", ""),
        "PrivateAuthType": request_login.get("PrivateAuthType", "0"),
        "ReqTxId": request_login.get("ReqTxId", ""),
        "Token": request_login.get("Token", ""),
        "TxId": request_login.get("TxId", ""),
        "UserName": aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, request_login.get("UserName", "")),
        "BirthDate": aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, request_login.get("BirthDate", "")),
        "UserCellphoneNumber": aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, request_login.get("UserCellphoneNumber", "")),
        "StartDate": start_date,
        "EndDate": end_date
    }
    
    print(f"💊 [처방전API] 요청 파라미터 수: {len(request_data)} (기간 파라미터 포함)")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{TILKO_API_HOST}/api/v1.0/NhisSimpleAuth/RetrieveTreatmentInjectionInformationPerson",
            json=request_data,
            headers={
                "Content-Type": "application/json",
                "API-KEY": TILKO_API_KEY,
                "ENC-KEY": rsa_encrypt(public_key, AES_KEY_FIXED)
            }
        )
        
        print(f"💊 [처방전API] 응답 상태: {response.status_code}")
        print(f"💊 [처방전API] 응답 Content-Type: {response.headers.get('content-type', 'Unknown')}")
        
        response.raise_for_status()
        
        # HTML 응답 체크 (NHIS 로그인 페이지 등)
        content_type = response.headers.get('content-type', '').lower()
        if 'text/html' in content_type:
            print(f"⚠️ [처방전API] HTML 응답 감지 - 인증 미완료 상태")
            return {
                "Status": "Error",
                "ResultCode": "AUTH_PENDING", 
                "ErrMsg": "간편인증 로그인 요청이 실패했습니다. (사용자가 아직 카카오톡에서 인증하지 않음)",
                "Message": "인증 대기 중"
            }
        
        result = response.json()
        
        print(f"💊 [처방전API] 응답 Status: {result.get('Status', 'Unknown')}")
        
        # Status가 Error인 경우 상세 정보 출력
        if result.get('Status') == 'Error':
            print(f"❌ [처방전API] 에러 발생!")
            print(f"   - ResultCode: {result.get('ResultCode', 'Unknown')}")
            print(f"   - ErrMsg: {result.get('ErrMsg', 'Unknown')}")
            print(f"   - 전체 응답: {result}")
        
        if result.get("ResultList"):
            print(f"💊 [처방전API] 처방전 기록 수: {len(result['ResultList'])}")
        
        return result

async def check_auth_status(cx_id: str, tx_id: str) -> Dict[str, Any]:
    """
    틸코 인증 완료 여부 확인
    실제로는 별도 인증 상태 확인 API가 없으므로 대기 상태 반환
    """
    try:
        print(f"🔍 [틸코인증확인] 인증 대기 중 - CxId: {cx_id}")
        
        # 틸코에는 별도 인증 상태 확인 API가 없음
        # 실제로는 건강검진 API 호출로 인증 완료 여부를 판단해야 함
        return {"Status": "Pending", "Message": "인증 대기 중"}
            
    except Exception as e:
        print(f"❌ [틸코인증확인] 실패: {e}")
        return {"Status": "Error", "Message": f"인증 상태 확인 실패: {str(e)}"}

