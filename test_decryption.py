
import base64
import json
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

def decrypt(encrypted_data, key, iv):
    try:
        if len(key) < 32:
            key = key.ljust(32, ' ')
        if len(iv) < 16:
            iv = iv.ljust(16, ' ')
        
        cipher = AES.new(key.encode('utf-8')[:32], AES.MODE_CBC, iv.encode('utf-8')[:16])
        raw_decrypted = cipher.decrypt(base64.b64decode(encrypted_data))
        return raw_decrypted.decode('utf-8', errors='ignore')
    except Exception as e:
        return f"Error: {str(e)}"

# 로그에서 추출한 데이터
data = "XYb98rmgps3K1xOOEiNIwoJarI0f9LSq4ZfulrzYzkNfVOlXoLZ5sPvVv/naaa3PcahhUaeCMOLPpP10Df8tCf3E60VUKHZyWmsYodr8w+EQCUpQjkL1qKOR9kbD6M5b5T6eaPXexwb6YiApZsrVqZ5WWSVt4Wsi7kVAbQYTepuYtcaWlAZvQigxYOP0J2OvbNg3mXgLqqUfQI8q+ouWLFO6e2Y5pmxteqB/OfFA8zWdkaw3qJN8spQygSyH9ONEEOOxSaC2cqpuRB0PC0gYreiSi//f1pck4GrkElToksqVYNdklq7eQnOdELNYs4bbO8d4VadeDnNIDT6Mw1lvUFAPz117sVxJAZ7/odilertgAu1e1sTPwYRgY3tF+ukg"

# 파트너 키 정보
partners = {
    "kindhabit": {"key": "kindhabit_disease_predict_key_32", "iv": "kindhabit_iv_16 "},
    "medilinx": {"key": "medilinx_disease_predict_key_32", "iv": "medilinx_iv_16 "}
}

print("=== 복호화 테스트 시작 ===")
for p_id, config in partners.items():
    result = decrypt(data, config['key'], config['iv'])
    print(f"[{p_id}] 결과: {result}")
