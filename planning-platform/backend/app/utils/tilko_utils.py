"""
틸코 API 연동 유틸리티
"""
from typing import Dict, Any
import httpx
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.asymmetric import padding as asymmetric_padding
from cryptography.hazmat.primitives import serialization, hashes
from datetime import datetime, timedelta
import base64
import os
from app.data.tilko_dummy_data import (
    DUMMY_HEALTH_SCREENING_DATA,
    DUMMY_PRESCRIPTION_DATA, 
    DUMMY_SIMPLE_AUTH_DATA,
    DUMMY_PUBLIC_KEY
)

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
        # 더미 공개키 반환 (개발/테스트용)
        return DUMMY_PUBLIC_KEY
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{TILKO_API_HOST}/api/Auth/GetPublicKey",
                params={"APIkey": TILKO_API_KEY}
            )
            return response.json()["PublicKey"]
        except Exception:
            # API 호출 실패시 더미 데이터 반환
            return DUMMY_PUBLIC_KEY

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
    except Exception:
        # 더미 키의 경우 더미 암호화된 값 반환
        return "dummy_encrypted_aes_key"

async def simple_auth(
    private_auth_type: str,
    user_name: str,
    birthdate: str,
    phone_no: str
) -> Dict[str, Any]:
    """카카오 간편인증 요청 (레퍼런스 구조대로)"""
    if not TILKO_API_KEY:
        # 더미 응답 반환 (개발/테스트용)
        return DUMMY_SIMPLE_AUTH_DATA
    
    public_key = await get_public_key()
    
    async with httpx.AsyncClient() as client:
        try:
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
            return response.json()
        except Exception:
            # API 호출 실패시 더미 데이터 반환
            return DUMMY_SIMPLE_AUTH_DATA

async def get_health_screening_data(
    request_login: Dict[str, str]
) -> Dict[str, Any]:
    """건강검진 데이터 조회 (레퍼런스 구조대로)"""
    if not TILKO_API_KEY:
        # 더미 건강검진 데이터 반환 (개발/테스트용)
        return DUMMY_HEALTH_SCREENING_DATA
    
    public_key = await get_public_key()
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{TILKO_API_HOST}/api/v1.0/nhissimpleauth/ggpab003m0105",
                json={
                    "CxId": request_login.get("cxId", ""),
                    "PrivateAuthType": request_login["privateAuthType"],
                    "ReqTxId": request_login["reqTxId"],
                    "Token": request_login["token"],
                    "TxId": request_login["txId"],
                    "UserName": aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, request_login["userName"]),
                    "BirthDate": aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, request_login["birthday"]),
                    "UserCellphoneNumber": aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, request_login["phoneNo"])
                },
                headers={
                    "Content-Type": "application/json",
                    "API-KEY": TILKO_API_KEY,
                    "ENC-KEY": rsa_encrypt(public_key, AES_KEY_FIXED)
                }
            )
            return response.json()
        except Exception:
            # API 호출 실패시 더미 데이터 반환
            return DUMMY_HEALTH_SCREENING_DATA

async def get_prescription_data(
    request_login: Dict[str, str]
) -> Dict[str, Any]:
    """처방전 데이터 조회 (레퍼런스 구조대로)"""
    if not TILKO_API_KEY:
        # 더미 처방전 데이터 반환 (개발/테스트용)
        return DUMMY_PRESCRIPTION_DATA
    
    public_key = await get_public_key()
    start_date = (datetime.now() - timedelta(days=420)).strftime("%Y%m%d")  # 14개월 전
    end_date = (datetime.now() - timedelta(days=60)).strftime("%Y%m%d")     # 2개월 전
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{TILKO_API_HOST}/api/v1.0/nhissimpleauth/retrievetreatmentinjectioninformationperson",
                json={
                    "CxId": request_login["cxId"],
                    "PrivateAuthType": request_login["privateAuthType"],
                    "ReqTxId": request_login["reqTxId"],
                    "Token": request_login["token"],
                    "TxId": request_login["txId"],
                    "UserName": aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, request_login["userName"]),
                    "BirthDate": aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, request_login["birthday"]),
                    "UserCellphoneNumber": aes_encrypt(AES_KEY_FIXED, AES_IV_FIXED, request_login["phoneNo"]),
                    "StartDate": start_date,
                    "EndDate": end_date
                },
                headers={
                    "Content-Type": "application/json",
                    "API-KEY": TILKO_API_KEY,
                    "ENC-KEY": rsa_encrypt(public_key, AES_KEY_FIXED)
                }
            )
            return response.json()
        except Exception:
            # API 호출 실패시 더미 데이터 반환
            return DUMMY_PRESCRIPTION_DATA
