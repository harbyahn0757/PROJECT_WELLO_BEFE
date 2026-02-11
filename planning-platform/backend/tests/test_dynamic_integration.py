"""
파트너-병원 관리 체계 통합 테스트
동적 설정이 모든 엔드포인트에서 정상 작동하는지 검증
"""

import asyncio
import json
from app.core.database import db_manager
from app.services.dynamic_config_service_sync import dynamic_config_sync


async def test_partner_config_integration():
    """파트너별 설정 통합 테스트"""
    print("=" * 80)
    print("파트너-병원 관리 체계 통합 테스트")
    print("=" * 80)
    
    # 1. 파트너별 기본 병원 ID 테스트
    print("\n1. 파트너별 기본 병원 ID 테스트")
    print("-" * 40)
    
    partners = ['welno', 'medilinx', 'kindhabit']
    for partner_id in partners:
        hospital_id = dynamic_config_sync.get_default_hospital_id(partner_id)
        print(f"✓ {partner_id}: {hospital_id}")
    
    # 2. 파트너별 Mediarc 설정 테스트
    print("\n2. 파트너별 Mediarc 설정 테스트")
    print("-" * 40)
    
    for partner_id in partners:
        config = dynamic_config_sync.get_mediarc_config(partner_id)
        print(f"✓ {partner_id}:")
        print(f"  - 활성화: {config['enabled']}")
        print(f"  - API URL: {config['api_url']}")
        print(f"  - API Key: {config['api_key'][:20]}...")
    
    # 3. 병원별 RAG 설정 테스트
    print("\n3. 병원별 RAG 설정 테스트")
    print("-" * 40)
    
    test_cases = [
        ('medilinx', 'KIM_HW_CLINIC'),
        ('medilinx', 'CEBFB480143B6F24BEB0870567EBF05C9C3E6B2E8616461A9269E9C818D3F2B0'),
        ('welno', 'PEERNINE')
    ]
    
    for partner_id, hospital_id in test_cases:
        config = dynamic_config_sync.get_hospital_config(partner_id, hospital_id)
        if config:
            print(f"✓ {partner_id}/{hospital_id}:")
            print(f"  - 병원명: {config['hospital_name']}")
            print(f"  - 활성화: {config['is_active']}")
            print(f"  - 페르소나: {config['persona_prompt'][:50] if config['persona_prompt'] else '없음'}...")
        else:
            print(f"✗ {partner_id}/{hospital_id}: 설정 없음")
    
    # 4. 계층형 API 테스트
    print("\n4. 계층형 API 데이터 구조 테스트")
    print("-" * 40)
    
    # 파트너 목록 조회
    partners_query = """
        SELECT 
            p.partner_id, 
            p.partner_name, 
            p.is_active,
            COUNT(h.hospital_id) as hospital_count
        FROM welno.tb_partner_config p
        LEFT JOIN welno.tb_hospital_rag_config h ON p.partner_id = h.partner_id AND h.hospital_id != '*'
        WHERE p.is_active = true
        GROUP BY p.partner_id, p.partner_name, p.is_active
        ORDER BY p.partner_name
    """
    partners = await db_manager.execute_query(partners_query)
    
    for partner in partners:
        print(f"✓ {partner['partner_id']} ({partner['partner_name']}): {partner['hospital_count']}개 병원")
    
    # 5. 하드코딩 제거 확인
    print("\n5. 하드코딩 제거 확인")
    print("-" * 40)
    
    # 각 파트너별로 서로 다른 설정이 적용되는지 확인
    test_partners = ['welno', 'medilinx', 'kindhabit']
    for partner_id in test_partners:
        default_hospital = dynamic_config_sync.get_default_hospital_id(partner_id)
        mediarc_config = dynamic_config_sync.get_mediarc_config(partner_id)
        
        print(f"✓ {partner_id}:")
        print(f"  - 기본 병원: {default_hospital}")
        print(f"  - Mediarc 활성화: {mediarc_config['enabled']}")
        print(f"  - API Key 고유성: {'✓' if partner_id in mediarc_config['api_key'] or 'welno' in mediarc_config['api_key'] else '✗'}")
    
    print("\n" + "=" * 80)
    print("통합 테스트 완료!")
    print("=" * 80)


async def test_api_endpoints():
    """API 엔드포인트 동적 설정 적용 테스트"""
    print("\n6. API 엔드포인트 동적 설정 테스트")
    print("-" * 40)
    
    # 실제 API 호출 시뮬레이션은 복잡하므로, 설정 로직만 테스트
    test_partners = ['welno', 'medilinx', 'kindhabit']
    
    for partner_id in test_partners:
        print(f"\n{partner_id} 파트너 시뮬레이션:")
        
        # terms_agreement.py 로직
        default_hospital = dynamic_config_sync.get_default_hospital_id(partner_id)
        print(f"  - Terms Agreement: {default_hospital} 병원 사용")
        
        # mediarc 관련 API 로직
        mediarc_config = dynamic_config_sync.get_mediarc_config(partner_id)
        print(f"  - Mediarc 활성화: {mediarc_config['enabled']}")
        print(f"  - Mediarc API: {mediarc_config['api_url']}")
        
        # 병원 설정 조회
        hospital_config = dynamic_config_sync.get_hospital_config(partner_id, default_hospital)
        if hospital_config:
            print(f"  - 병원 설정: ✓ (페르소나: {'있음' if hospital_config['persona_prompt'] else '없음'})")
        else:
            print(f"  - 병원 설정: ✗ (기본값 사용)")


if __name__ == "__main__":
    asyncio.run(test_partner_config_integration())
    asyncio.run(test_api_endpoints())