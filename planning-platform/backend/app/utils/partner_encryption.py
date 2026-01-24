import base64
import json
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad, pad
from ..config.payment_config import AES_SECRET_KEY, AES_IV

def decrypt_user_data(encrypted_data_base64):
    """
    AES-256-CBC 방식으로 암호화된 데이터를 복호화하여 JSON 객체로 반환
    """
    try:
        # Base64 디코딩
        encrypted_data = base64.b64decode(encrypted_data_base64)
        
        # AES 복호화 설정
        key = AES_SECRET_KEY.encode('utf-8')
        iv = AES_IV.encode('utf-8')
        
        # IV 길이 조정 (16바이트가 아닐 경우 대비)
        if len(iv) < 16:
            iv = iv.ljust(16, b' ')
        elif len(iv) > 16:
            iv = iv[:16]
            
        cipher = AES.new(key, AES.MODE_CBC, iv)
        
        # 복호화
        decrypted_raw = cipher.decrypt(encrypted_data)
        
        # PKCS7 패딩 제거 및 JSON 정제
        try:
            # 기본 unpad 시도
            decrypted_data = unpad(decrypted_raw, AES.block_size)
        except:
            # unpad 실패 시 원본 사용 (수동 정제)
            decrypted_data = decrypted_raw
            
        # 문자열 변환 후 JSON 데이터만 추출 (앞뒤 제어문자/공백 제거)
        decrypted_text = decrypted_data.decode('utf-8', errors='ignore')
        
        # JSON 시작({)과 끝(}) 찾기
        start_idx = decrypted_text.find('{')
        end_idx = decrypted_text.rfind('}')
        
        if start_idx != -1 and end_idx != -1:
            decrypted_text = decrypted_text[start_idx:end_idx+1]
        else:
            decrypted_text = decrypted_text.strip()
            
        return json.loads(decrypted_text)
    except Exception as e:
        print(f"Decryption error (IV len={len(AES_IV.encode('utf-8'))}): {str(e)}")
        return None

def encrypt_user_data(data_dict):
    """
    (테스트용) JSON 데이터를 AES-256-CBC 방식으로 암호화하여 Base64로 반환
    """
    try:
        data_str = json.dumps(data_dict).encode('utf-8')
        key = AES_SECRET_KEY.encode('utf-8')
        iv = AES_IV.encode('utf-8')
        cipher = AES.new(key, AES.MODE_CBC, iv)
        
        encrypted_data = cipher.encrypt(pad(data_str, AES.block_size))
        return base64.b64encode(encrypted_data).decode('utf-8')
    except Exception as e:
        print(f"Encryption error: {str(e)}")
        return None
