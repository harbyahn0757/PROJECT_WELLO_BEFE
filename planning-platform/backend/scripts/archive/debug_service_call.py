#!/usr/bin/env python3
"""
WelnoDataService 직접 호출 디버깅
"""
import asyncio
import json
import os
import sys
from dotenv import load_dotenv

# 경로 추가
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# .env.local 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    load_dotenv(env_path)

from app.services.welno_data_service import WelnoDataService

async def debug_service_call():
    """WelnoDataService 직접 호출 디버깅"""
    
    # 실제 파일에서 데이터 로드
    health_file_path = '/home/workspace/PROJECT_WELLO_BEFE/tilko_data/failed/20260131_021152_350_db94260e-5e97-41c8-89f1-ddaf2ca43a7d_health_data.json'
    
    if not os.path.exists(health_file_path):
        print(f"❌ 파일이 존재하지 않습니다: {health_file_path}")
        return
    
    with open(health_file_path, 'r', encoding='utf-8') as f:
        file_data = json.load(f)
    
    # 메타데이터에서 정보 추출
    metadata = file_data.get('metadata', {})
    raw_data = file_data.get('raw_data', {})
    
    patient_uuid = metadata.get('patient_uuid')
    hospital_id = metadata.get('hospital_id')
    session_id = metadata.get('session_id')
    
    print(f"=== WelnoDataService 직접 호출 디버깅 ===")
    print(f"환자 UUID: {patient_uuid}")
    print(f"병원 ID: {hospital_id}")
    print(f"세션 ID: {session_id}")
    print(f"건강검진 데이터 개수: {len(raw_data.get('ResultList', []))}")
    
    # WelnoDataService 인스턴스 생성
    service = WelnoDataService()
    
    # 디버깅을 위해 함수 내부에 print 추가
    try:
        print("\\n🔄 save_health_data 호출 시작...")
        result = await service.save_health_data(
            patient_uuid=patient_uuid,
            hospital_id=hospital_id,
            health_data=raw_data,
            session_id=session_id
        )
        
        if result:
            print("✅ save_health_data 성공!")
        else:
            print("❌ save_health_data 실패 (False 반환)")
            
    except Exception as e:
        print(f"❌ save_health_data 예외 발생: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_service_call())