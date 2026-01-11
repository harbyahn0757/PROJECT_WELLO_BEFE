#!/usr/bin/env python3
"""
get_patient_health_data 함수 직접 테스트
"""
import asyncio
import sys
import os

# 프로젝트 루트를 Python 경로에 추가
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.services.welno_data_service import WelnoDataService

UUID = "36473377-9f8a-447e-aaef-261b10dd2d85"
HOSPITAL_ID = "PEERNINE"

async def test_get_patient_health_data():
    """get_patient_health_data 함수 테스트"""
    try:
        service = WelnoDataService()
        
        print("\n" + "="*100)
        print("🧪 get_patient_health_data 함수 테스트")
        print("="*100)
        print(f"\n👤 테스트 파라미터:")
        print(f"   UUID: {UUID}")
        print(f"   Hospital ID: {HOSPITAL_ID}")
        print()
        
        result = await service.get_patient_health_data(UUID, HOSPITAL_ID)
        
        print("\n" + "="*100)
        print("📊 함수 실행 결과")
        print("="*100)
        
        if "error" in result:
            print(f"❌ 에러: {result['error']}")
        else:
            print(f"✅ 성공")
            print(f"   - 환자 정보: {result.get('patient', {}).get('name', 'N/A')}")
            print(f"   - 건강검진 데이터: {len(result.get('health_data', []))}건")
            print(f"   - 처방전 데이터: {len(result.get('prescription_data', []))}건")
            
            if result.get('health_data'):
                print(f"\n   건강검진 데이터 상세:")
                for idx, item in enumerate(result['health_data'], 1):
                    print(f"     [{idx}] year: {item.get('year')}, checkup_date: {item.get('checkup_date')}")
                    print(f"         raw_data 존재: {item.get('raw_data') is not None}")
                    if item.get('raw_data'):
                        print(f"         raw_data 타입: {type(item.get('raw_data'))}")
                        if isinstance(item.get('raw_data'), dict):
                            print(f"         raw_data 키: {list(item.get('raw_data').keys())[:5]}")
            else:
                print(f"\n   ⚠️ 건강검진 데이터가 비어있습니다!")
        
        print("\n" + "="*100)
        print("✅ 테스트 완료")
        print("="*100)
        
    except Exception as e:
        print(f"\n❌ [테스트 오류] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_get_patient_health_data())
