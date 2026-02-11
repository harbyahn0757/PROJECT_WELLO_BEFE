import base64
import json
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad, pad

def decrypt_user_data(encrypted_data_base64, aes_key=None, aes_iv=None):
    """
    AES-256-CBC 방식으로 암호화된 데이터를 복호화하여 JSON 객체로 반환
    
    Args:
        encrypted_data_base64: Base64 인코딩된 암호화 데이터
        aes_key: AES 암호화 키 (필수)
        aes_iv: AES IV (필수)
    
    Raises:
        ValueError: aes_key 또는 aes_iv가 None인 경우
    """
    try:
        # 파라미터 검증
        if not aes_key or not aes_iv:
            raise ValueError("aes_key와 aes_iv는 필수 파라미터입니다. 파트너별 암호화 키를 사용해야 합니다.")
        
        # Base64 디코딩
        encrypted_data = base64.b64decode(encrypted_data_base64)
        
        # 키와 IV 설정
        key = aes_key.encode('utf-8')
        iv = aes_iv.encode('utf-8')
        
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
        
        # 더 강력한 정제: 앞뒤 공백 및 제어문자 전면 제거
        import re
        decrypted_text = re.sub(r'^[\s\x00-\x1F\x7F-\x9F]+|[\s\x00-\x1F\x7F-\x9F]+$', '', decrypted_text)
        
        # JSON 시작({)과 끝(}) 찾기
        start_idx = decrypted_text.find('{')
        end_idx = decrypted_text.rfind('}')
        
        if start_idx != -1 and end_idx != -1:
            decrypted_text = decrypted_text[start_idx:end_idx+1]
            # 내부 제어 문자 제거 (줄바꿈 제외)
            decrypted_text = re.sub(r'[\x00-\x09\x0B-\x1F\x7F-\x9F]', '', decrypted_text)
        else:
            decrypted_text = decrypted_text.strip()
            
        if not decrypted_text:
            return None

        return json.loads(decrypted_text)
    except Exception as e:
        # 에러 시 어떤 데이터였는지 일부 출력 (디버깅용)
        try:
            sample = decrypted_raw.hex()[:40] if 'decrypted_raw' in locals() else "N/A"
            iv_sample = iv.decode('utf-8') if isinstance(iv, bytes) else str(iv)
            print(f"❌ [Decryption Error] {str(e)}")
            print(f"   - IV used: {iv_sample}")
            print(f"   - Decrypted sample(hex): {sample}")
            print(f"   - Encrypted length: {len(encrypted_data)}")
        except:
            pass
        return None

def encrypt_user_data(data_dict, aes_key, aes_iv):
    """
    JSON 데이터를 AES-256-CBC 방식으로 암호화하여 Base64로 반환
    
    Args:
        data_dict: 암호화할 데이터 딕셔너리
        aes_key: AES 암호화 키 (필수)
        aes_iv: AES IV (필수)
    
    Returns:
        Base64 인코딩된 암호화 데이터 또는 None (오류 시)
    
    Raises:
        ValueError: aes_key 또는 aes_iv가 None인 경우
    """
    try:
        # 파라미터 검증
        if not aes_key or not aes_iv:
            raise ValueError("aes_key와 aes_iv는 필수 파라미터입니다. 파트너별 암호화 키를 사용해야 합니다.")
        
        data_str = json.dumps(data_dict).encode('utf-8')
        key = aes_key.encode('utf-8')
        iv = aes_iv.encode('utf-8')
        
        # IV 길이 조정 (16바이트가 아닐 경우 대비)
        if len(iv) < 16:
            iv = iv.ljust(16, b' ')
        elif len(iv) > 16:
            iv = iv[:16]
        
        cipher = AES.new(key, AES.MODE_CBC, iv)
        encrypted_data = cipher.encrypt(pad(data_str, AES.block_size))
        return base64.b64encode(encrypted_data).decode('utf-8')
    except Exception as e:
        print(f"Encryption error: {str(e)}")
        return None
