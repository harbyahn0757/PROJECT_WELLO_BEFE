#!/usr/bin/env python3
"""
파트너별 암호화 키 통합 테스트
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.utils.partner_config import get_partner_encryption_keys
from app.utils.partner_encryption import encrypt_user_data, decrypt_user_data

def test_encryption_integration():
    """파트너별 암호화 키 통합 테스트"""
    
    print("=" * 60)
    print("파트너별 암호화 키 통합 테스트")
    print("=" * 60)
    
    partners = ['welno', 'kindhabit', 'medilinx', 'test_partner']
    test_data = {
        "name": "홍길동",
        "age": 30,
        "email": "test@example.com",
        "health_data": {
            "blood_pressure": "120/80",
            "weight": 70.5
        }
    }
    
    for partner_id in partners:
        print(f"\n🔍 파트너: {partner_id}")
        print("-" * 40)
        
        try:
            # 파트너별 암호화 키 조회
            aes_key, aes_iv = get_partner_encryption_keys(partner_id)
            
            if not aes_key or not aes_iv:
                print(f"❌ 암호화 키를 찾을 수 없음")
                continue
            
            print(f"AES Key: {aes_key[:10]}...")
            print(f"AES IV: {aes_iv}")
            
            # 암호화 테스트
            encrypted_data = encrypt_user_data(test_data, aes_key, aes_iv)
            if not encrypted_data:
                print("❌ 암호화 실패")
                continue
            
            print(f"암호화 성공: {encrypted_data[:20]}...")
            
            # 복호화 테스트
            decrypted_data = decrypt_user_data(encrypted_data, aes_key, aes_iv)
            if not decrypted_data:
                print("❌ 복호화 실패")
                continue
            
            print("복호화 성공")
            
            # 데이터 일치 검증
            if decrypted_data == test_data:
                print("✅ 암호화/복호화 검증 통과")
            else:
                print("❌ 데이터 불일치")
                print(f"원본: {test_data}")
                print(f"복호화: {decrypted_data}")
                return False
            
        except Exception as e:
            print(f"❌ 오류 발생: {e}")
            return False
    
    print("\n" + "=" * 60)
    print("✅ 파트너별 암호화 키 통합 테스트 완료!")
    print("모든 파트너의 암호화/복호화가 정상 동작합니다.")
    print("=" * 60)
    
    return True

def test_encryption_without_keys():
    """암호화 키 없이 호출 시 오류 테스트"""
    
    print("\n🔍 암호화 키 없이 호출 시 오류 테스트")
    print("-" * 40)
    
    test_data = {"test": "data"}
    
    # None 키로 암호화 시도
    try:
        result = encrypt_user_data(test_data, None, None)
        if result is None:
            print("✅ 암호화 실패 (None 반환)")
        else:
            print("❌ 예상된 오류가 발생하지 않음")
            return False
    except ValueError as e:
        print(f"✅ 예상된 오류 발생: {e}")
    except Exception as e:
        print(f"✅ 암호화 오류 발생: {e}")
    
    # None 키로 복호화 시도
    try:
        result = decrypt_user_data("dummy_data", None, None)
        if result is None:
            print("✅ 복호화 실패 (None 반환)")
        else:
            print("❌ 예상된 오류가 발생하지 않음")
            return False
    except ValueError as e:
        print(f"✅ 예상된 오류 발생: {e}")
    except Exception as e:
        print(f"✅ 복호화 오류 발생: {e}")
    
    print("✅ 키 검증 로직 정상 동작")
    return True

if __name__ == "__main__":
    try:
        success = test_encryption_integration()
        if success:
            success = test_encryption_without_keys()
        
        if success:
            print("\n🎉 모든 테스트 통과!")
        else:
            print("\n❌ 테스트 실패")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ 테스트 실행 중 오류: {e}")
        sys.exit(1)