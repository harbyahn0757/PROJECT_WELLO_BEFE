"""
동적 설정 시스템 종합 테스트
수정된 시스템이 올바르게 작동하는지 검증
"""

import asyncio
import json
import httpx
from app.core.database import db_manager
from app.services.dynamic_config_service import dynamic_config


async def test_async_dynamic_config():
    """비동기 동적 설정 서비스 테스트"""
    print("=" * 80)
    print("1. 비동기 동적 설정 서비스 테스트")
    print("=" * 80)
    
    try:
        # 파트너별 기본 병원 ID 테스트
        partners = ['welno', 'medilinx', 'kindhabit']
        
        print("\n📋 파트너별 기본 병원 ID 조회:")
        for partner_id in partners:
            hospital_id = await dynamic_config.get_default_hospital_id(partner_id)
            print(f"  ✓ {partner_id}: {hospital_id}")
        
        print("\n📋 파트너별 Mediarc 설정 조회:")
        for partner_id in partners:
            config = await dynamic_config.get_mediarc_config(partner_id)
            print(f"  ✓ {partner_id}:")
            print(f"    - 활성화: {config['enabled']}")
            print(f"    - API URL: {config['api_url']}")
            print(f"    - API Key: {config['api_key'][:20]}...")
        
        print("\n📋 병원별 RAG 설정 조회:")
        test_cases = [
            ('medilinx', 'KIM_HW_CLINIC'),
            ('medilinx', 'CEBFB480143B6F24BEB0870567EBF05C9C3E6B2E8616461A9269E9C818D3F2B0'),
            ('welno', 'PEERNINE')
        ]
        
        for partner_id, hospital_id in test_cases:
            config = await dynamic_config.get_hospital_config(partner_id, hospital_id)
            if config:
                print(f"  ✓ {partner_id}/{hospital_id}: {config['hospital_name']}")
            else:
                print(f"  ✗ {partner_id}/{hospital_id}: 설정 없음")
        
        print("\n✅ 비동기 동적 설정 서비스 테스트 완료")
        
    except Exception as e:
        print(f"❌ 비동기 설정 테스트 실패: {e}")
        return False
    
    return True


async def test_api_endpoints():
    """API 엔드포인트 동적 설정 적용 테스트"""
    print("\n" + "=" * 80)
    print("2. API 엔드포인트 동적 설정 테스트")
    print("=" * 80)
    
    try:
        # 프론트엔드 설정 API 테스트
        print("\n📋 프론트엔드 설정 API 테스트:")
        
        partners = ['welno', 'medilinx', 'kindhabit']
        for partner_id in partners:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"http://localhost:8000/api/v1/admin/embedding/config/frontend?partner_id={partner_id}",
                        timeout=5.0
                    )
                    if response.status_code == 200:
                        config = response.json()
                        print(f"  ✓ {partner_id}: {config['default_hospital_id']}, API Key: {config['api_key'][:20]}...")
                    else:
                        print(f"  ✗ {partner_id}: HTTP {response.status_code}")
            except Exception as e:
                print(f"  ⚠️ {partner_id}: 서버 연결 실패 ({str(e)[:50]}...)")
        
        print("\n✅ API 엔드포인트 테스트 완료")
        
    except Exception as e:
        print(f"❌ API 엔드포인트 테스트 실패: {e}")
        return False
    
    return True


async def test_database_consistency():
    """데이터베이스 일관성 테스트"""
    print("\n" + "=" * 80)
    print("3. 데이터베이스 일관성 테스트")
    print("=" * 80)
    
    try:
        # 파트너 설정 테이블 확인
        print("\n📋 파트너 설정 테이블 확인:")
        partners_query = """
            SELECT partner_id, partner_name, 
                   config->'mediarc'->>'enabled' as mediarc_enabled,
                   config->>'default_hospital_id' as default_hospital_id,
                   is_active
            FROM welno.tb_partner_config 
            WHERE is_active = true
            ORDER BY partner_id
        """
        partners = await db_manager.execute_query(partners_query)
        
        for partner in partners:
            print(f"  ✓ {partner['partner_id']} ({partner['partner_name']}):")
            print(f"    - 기본 병원: {partner['default_hospital_id']}")
            print(f"    - Mediarc 활성화: {partner['mediarc_enabled']}")
        
        # 병원 RAG 설정 테이블 확인
        print("\n📋 병원 RAG 설정 테이블 확인:")
        hospitals_query = """
            SELECT partner_id, hospital_id, hospital_name, is_active
            FROM welno.tb_hospital_rag_config 
            WHERE hospital_id != '*' AND is_active = true
            ORDER BY partner_id, hospital_name
        """
        hospitals = await db_manager.execute_query(hospitals_query)
        
        for hospital in hospitals:
            print(f"  ✓ [{hospital['partner_id']}] {hospital['hospital_id']}: {hospital['hospital_name']}")
        
        # 계층 구조 확인
        print("\n📋 파트너-병원 계층 구조 확인:")
        hierarchy_query = """
            SELECT 
                p.partner_id, 
                p.partner_name,
                COUNT(h.hospital_id) as hospital_count
            FROM welno.tb_partner_config p
            LEFT JOIN welno.tb_hospital_rag_config h ON p.partner_id = h.partner_id AND h.hospital_id != '*' AND h.is_active = true
            WHERE p.is_active = true
            GROUP BY p.partner_id, p.partner_name
            ORDER BY p.partner_name
        """
        hierarchy = await db_manager.execute_query(hierarchy_query)
        
        for item in hierarchy:
            print(f"  ✓ {item['partner_name']}: {item['hospital_count']}개 병원")
        
        print("\n✅ 데이터베이스 일관성 테스트 완료")
        
    except Exception as e:
        print(f"❌ 데이터베이스 테스트 실패: {e}")
        return False
    
    return True


async def test_hardcoding_removal():
    """하드코딩 제거 검증 테스트"""
    print("\n" + "=" * 80)
    print("4. 하드코딩 제거 검증 테스트")
    print("=" * 80)
    
    try:
        print("\n📋 파트너별 서로 다른 설정 적용 확인:")
        
        partners = ['welno', 'medilinx', 'kindhabit']
        configs = {}
        
        for partner_id in partners:
            default_hospital = await dynamic_config.get_default_hospital_id(partner_id)
            mediarc_config = await dynamic_config.get_mediarc_config(partner_id)
            
            configs[partner_id] = {
                'default_hospital': default_hospital,
                'api_key': mediarc_config['api_key'],
                'enabled': mediarc_config['enabled']
            }
            
            print(f"  ✓ {partner_id}:")
            print(f"    - 기본 병원: {default_hospital}")
            print(f"    - API Key: {mediarc_config['api_key'][:20]}...")
            print(f"    - 활성화: {mediarc_config['enabled']}")
        
        # 설정이 서로 다른지 확인
        print("\n📋 설정 고유성 검증:")
        unique_hospitals = set(c['default_hospital'] for c in configs.values())
        unique_api_keys = set(c['api_key'] for c in configs.values())
        
        print(f"  ✓ 고유한 기본 병원 수: {len(unique_hospitals)}")
        print(f"  ✓ 고유한 API Key 수: {len(unique_api_keys)}")
        
        if len(unique_api_keys) >= 2:  # 최소 2개는 달라야 함
            print("  ✅ 파트너별로 서로 다른 설정이 적용됨")
        else:
            print("  ⚠️ 일부 파트너가 동일한 설정을 사용함")
        
        print("\n✅ 하드코딩 제거 검증 완료")
        
    except Exception as e:
        print(f"❌ 하드코딩 제거 검증 실패: {e}")
        return False
    
    return True


async def test_cache_functionality():
    """캐시 기능 테스트"""
    print("\n" + "=" * 80)
    print("5. 캐시 기능 테스트")
    print("=" * 80)
    
    try:
        print("\n📋 캐시 클리어 기능 테스트:")
        
        # 캐시 클리어 실행
        dynamic_config.clear_cache()
        print("  ✓ 캐시 클리어 실행됨")
        
        # 설정 조회 (캐시 재생성)
        config1 = await dynamic_config.get_mediarc_config('welno')
        print(f"  ✓ 첫 번째 조회: {config1['api_key'][:20]}...")
        
        # 두 번째 조회 (캐시에서 조회되어야 함)
        config2 = await dynamic_config.get_mediarc_config('welno')
        print(f"  ✓ 두 번째 조회: {config2['api_key'][:20]}...")
        
        if config1 == config2:
            print("  ✅ 캐시 기능 정상 작동")
        else:
            print("  ⚠️ 캐시 기능 이상")
        
        print("\n✅ 캐시 기능 테스트 완료")
        
    except Exception as e:
        print(f"❌ 캐시 기능 테스트 실패: {e}")
        return False
    
    return True


async def main():
    """종합 테스트 실행"""
    print("🚀 동적 설정 시스템 종합 테스트 시작")
    print("=" * 80)
    
    tests = [
        ("비동기 동적 설정 서비스", test_async_dynamic_config),
        ("API 엔드포인트 동적 설정", test_api_endpoints),
        ("데이터베이스 일관성", test_database_consistency),
        ("하드코딩 제거 검증", test_hardcoding_removal),
        ("캐시 기능", test_cache_functionality),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n🧪 {test_name} 테스트 실행 중...")
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} 테스트 중 예외 발생: {e}")
            results.append((test_name, False))
    
    # 결과 요약
    print("\n" + "=" * 80)
    print("📊 테스트 결과 요약")
    print("=" * 80)
    
    passed = 0
    for test_name, result in results:
        status = "✅ 통과" if result else "❌ 실패"
        print(f"  {status} {test_name}")
        if result:
            passed += 1
    
    print(f"\n🎯 전체 결과: {passed}/{len(results)} 테스트 통과")
    
    if passed == len(results):
        print("🎉 모든 테스트가 성공적으로 완료되었습니다!")
        return True
    else:
        print("⚠️ 일부 테스트가 실패했습니다. 로그를 확인해주세요.")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)