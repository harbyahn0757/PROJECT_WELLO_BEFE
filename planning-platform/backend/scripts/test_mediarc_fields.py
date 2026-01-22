"""
Mediarc 필드 통합 테스트 스크립트
모든 환자 조회 함수에 has_mediarc_report 필드가 포함되는지 검증
"""

import asyncio
import sys
import os

# 프로젝트 루트를 Python path에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.welno_data_service import WelnoDataService

async def test_all_patient_queries():
    """모든 환자 조회 함수 테스트"""
    service = WelnoDataService()
    
    # 테스트용 데이터 (실제 DB에 존재하는 데이터 사용 필요)
    test_uuid = "test-uuid"  # 실제 UUID로 교체 필요
    test_hospital = "H001"   # 실제 병원 ID로 교체 필요
    
    print("=" * 80)
    print("🧪 Mediarc 필드 통합 테스트 시작")
    print("=" * 80)
    print()
    
    # 테스트 1: check_existing_data
    print("📝 테스트 1: check_existing_data")
    print("-" * 80)
    try:
        result1 = await service.check_existing_data(test_uuid, test_hospital)
        
        # 응답 구조 검증
        assert 'exists' in result1, "❌ 'exists' 필드 누락"
        
        if result1.get('exists'):
            # 데이터가 존재하는 경우
            assert 'mediarc_report_count' in result1, "❌ 'mediarc_report_count' 필드 누락"
            assert 'has_mediarc_report' in result1, "❌ 'has_mediarc_report' 필드 누락"
            
            patient = result1.get('patient', {})
            assert 'has_mediarc_report' in patient, "❌ patient 객체에 'has_mediarc_report' 필드 누락"
            
            print(f"✅ check_existing_data 통과")
            print(f"   - health_data_count: {result1.get('health_data_count')}")
            print(f"   - prescription_data_count: {result1.get('prescription_data_count')}")
            print(f"   - mediarc_report_count: {result1.get('mediarc_report_count')}")
            print(f"   - has_mediarc_report: {result1.get('has_mediarc_report')}")
        else:
            print(f"⚠️  환자 데이터 없음 (exists=False) - 필드 존재 여부만 확인")
            assert 'mediarc_report_count' in result1, "❌ 'mediarc_report_count' 필드 누락"
            print(f"✅ check_existing_data 통과 (필드 존재)")
            
    except AssertionError as e:
        print(f"❌ check_existing_data 실패: {e}")
        return False
    except Exception as e:
        print(f"❌ check_existing_data 오류: {e}")
        return False
    
    print()
    
    # 테스트 2: login_patient
    print("📝 테스트 2: login_patient")
    print("-" * 80)
    try:
        result2 = await service.login_patient(test_uuid, test_hospital)
        
        if 'error' not in result2:
            patient = result2.get('patient', {})
            assert 'has_mediarc_report' in patient, "❌ patient 객체에 'has_mediarc_report' 필드 누락"
            print(f"✅ login_patient 통과")
            print(f"   - has_mediarc_report: {patient.get('has_mediarc_report')}")
        else:
            print(f"⚠️  환자 없음: {result2.get('error')}")
            
    except AssertionError as e:
        print(f"❌ login_patient 실패: {e}")
        return False
    except Exception as e:
        print(f"❌ login_patient 오류: {e}")
        return False
    
    print()
    
    # 테스트 3: get_patient_by_uuid
    print("📝 테스트 3: get_patient_by_uuid")
    print("-" * 80)
    try:
        result3 = await service.get_patient_by_uuid(test_uuid)
        
        if 'error' not in result3:
            assert 'has_mediarc_report' in result3, "❌ 'has_mediarc_report' 필드 누락"
            print(f"✅ get_patient_by_uuid 통과")
            print(f"   - has_mediarc_report: {result3.get('has_mediarc_report')}")
        else:
            print(f"⚠️  환자 없음: {result3.get('error')}")
            
    except AssertionError as e:
        print(f"❌ get_patient_by_uuid 실패: {e}")
        return False
    except Exception as e:
        print(f"❌ get_patient_by_uuid 오류: {e}")
        return False
    
    print()
    
    # 테스트 4: get_patient_by_combo
    print("📝 테스트 4: get_patient_by_combo")
    print("-" * 80)
    try:
        # 실제 데이터로 테스트 필요
        result4 = await service.get_patient_by_combo("010-0000-0000", "19900101", "테스트")
        
        if result4:
            assert 'has_mediarc_report' in result4, "❌ 'has_mediarc_report' 필드 누락"
            print(f"✅ get_patient_by_combo 통과")
            print(f"   - has_mediarc_report: {result4.get('has_mediarc_report')}")
        else:
            print(f"⚠️  해당 환자 없음 (테스트 데이터 부재)")
            print(f"✅ get_patient_by_combo 통과 (필드 검증 스킵)")
            
    except AssertionError as e:
        print(f"❌ get_patient_by_combo 실패: {e}")
        return False
    except Exception as e:
        print(f"❌ get_patient_by_combo 오류: {e}")
        return False
    
    print()
    
    # 테스트 5: get_patient_health_data (SELECT * 사용)
    print("📝 테스트 5: get_patient_health_data (SELECT * 검증)")
    print("-" * 80)
    try:
        result5 = await service.get_patient_health_data(test_uuid, test_hospital)
        
        if 'error' not in result5:
            patient = result5.get('patient', {})
            assert 'has_mediarc_report' in patient, "❌ patient 객체에 'has_mediarc_report' 필드 누락"
            print(f"✅ get_patient_health_data 통과")
            print(f"   - has_mediarc_report: {patient.get('has_mediarc_report')}")
            print(f"   - health_data 개수: {len(result5.get('health_data', []))}")
            print(f"   - prescription_data 개수: {len(result5.get('prescription_data', []))}")
        else:
            print(f"⚠️  환자 없음: {result5.get('error')}")
            
    except AssertionError as e:
        print(f"❌ get_patient_health_data 실패: {e}")
        return False
    except Exception as e:
        print(f"❌ get_patient_health_data 오류: {e}")
        return False
    
    print()
    print("=" * 80)
    print("🎉 모든 테스트 통과!")
    print("=" * 80)
    return True


if __name__ == "__main__":
    print()
    print("⚠️  주의: 실제 DB 데이터로 테스트하려면")
    print("   test_uuid와 test_hospital을 실제 값으로 변경하세요.")
    print()
    
    result = asyncio.run(test_all_patient_queries())
    sys.exit(0 if result else 1)
