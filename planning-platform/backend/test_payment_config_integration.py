#!/usr/bin/env python3
"""
파트너별 결제 설정 통합 테스트
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.utils.partner_config import (
    get_payment_mid,
    get_payment_hash_key,
    get_payment_iniapi_key,
    get_payment_iniapi_iv,
    get_payment_amount
)

def test_payment_config_integration():
    """파트너별 결제 설정 통합 테스트"""
    
    print("=" * 60)
    print("파트너별 결제 설정 통합 테스트")
    print("=" * 60)
    
    partners = ['welno', 'kindhabit', 'medilinx', 'test_partner', 'welno_internal']
    
    for partner_id in partners:
        print(f"\n🔍 파트너: {partner_id}")
        print("-" * 40)
        
        try:
            # 결제 설정 조회
            mid = get_payment_mid(partner_id)
            hash_key = get_payment_hash_key(partner_id)
            iniapi_key = get_payment_iniapi_key(partner_id)
            iniapi_iv = get_payment_iniapi_iv(partner_id)
            amount = get_payment_amount(partner_id)
            
            print(f"MID: {mid}")
            print(f"Hash Key: {hash_key[:10]}...")
            print(f"INIAPI Key: {iniapi_key}")
            print(f"INIAPI IV: {iniapi_iv}")
            print(f"Amount: {amount}원")
            
            # 검증
            if partner_id == 'test_partner':
                assert mid == 'INIpayTest', f"test_partner MID should be INIpayTest, got {mid}"
                print("✅ 테스트 파트너 MID 검증 통과")
            else:
                assert mid == 'COCkkhabit', f"{partner_id} MID should be COCkkhabit, got {mid}"
                print("✅ 메인 파트너 MID 검증 통과")
            
            assert hash_key == '3CB8183A4BE283555ACC8363C0360223', f"Hash key mismatch for {partner_id}"
            print("✅ Hash Key 검증 통과")
            
            assert iniapi_key == 'oAOMaMsnwnSvlu4l', f"INIAPI key mismatch for {partner_id}"
            print("✅ INIAPI Key 검증 통과")
            
            assert iniapi_iv == '4PqCmQ0Fn0kSJQ==', f"INIAPI IV mismatch for {partner_id}"
            print("✅ INIAPI IV 검증 통과")
            
            print("✅ 모든 검증 통과")
            
        except Exception as e:
            print(f"❌ 오류 발생: {e}")
            return False
    
    print("\n" + "=" * 60)
    print("✅ 파트너별 결제 설정 통합 테스트 완료!")
    print("모든 파트너의 결제 키가 DB에서 정상 조회됩니다.")
    print("=" * 60)
    
    return True

def test_fallback_behavior():
    """존재하지 않는 파트너의 기본값 테스트"""
    
    print("\n🔍 존재하지 않는 파트너 기본값 테스트")
    print("-" * 40)
    
    fake_partner = 'nonexistent_partner'
    
    mid = get_payment_mid(fake_partner)
    hash_key = get_payment_hash_key(fake_partner)
    amount = get_payment_amount(fake_partner)
    
    print(f"존재하지 않는 파트너 '{fake_partner}':")
    print(f"MID: {mid} (기본값)")
    print(f"Hash Key: {hash_key[:10]}... (기본값)")
    print(f"Amount: {amount}원 (기본값)")
    
    assert mid == 'COCkkhabit', "기본 MID가 올바르지 않음"
    assert hash_key == '3CB8183A4BE283555ACC8363C0360223', "기본 Hash Key가 올바르지 않음"
    assert amount == 7900, "기본 금액이 올바르지 않음"
    
    print("✅ 기본값 동작 검증 통과")

if __name__ == "__main__":
    try:
        success = test_payment_config_integration()
        if success:
            test_fallback_behavior()
            print("\n🎉 모든 테스트 통과!")
        else:
            print("\n❌ 테스트 실패")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ 테스트 실행 중 오류: {e}")
        sys.exit(1)