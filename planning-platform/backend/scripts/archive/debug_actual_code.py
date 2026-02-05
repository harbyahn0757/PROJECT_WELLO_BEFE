#!/usr/bin/env python3
"""
실제 실행 중인 코드 디버깅
"""
import asyncio
import json
import os
import sys
from dotenv import load_dotenv

# 프로젝트 루트를 Python 경로에 추가
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.services.welno_data_service import WelnoDataService

# .env.local 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    load_dotenv(env_path)

async def debug_actual_code():
    """실제 코드 디버깅"""
    
    # 실제 파일에서 데이터 로드
    health_file = '/home/workspace/PROJECT_WELLO_BEFE/tilko_data/pending/20260131_021152_350_db94260e-5e97-41c8-89f1-ddaf2ca43a7d_health_data.json'
    
    print('=== 실제 코드 디버깅 ===')
    
    if os.path.exists(health_file):
        with open(health_file, 'r', encoding='utf-8') as f:
            health_data = json.load(f)
        
        patient_uuid = health_data['metadata']['patient_uuid']
        hospital_id = health_data['metadata']['hospital_id']
        session_id = health_data['metadata']['session_id']
        raw_data = health_data['raw_data']
        
        print(f'환자 UUID: {patient_uuid}')
        print(f'병원 ID: {hospital_id}')
        print(f'세션 ID: {session_id}')
        print(f'raw_data 타입: {type(raw_data)}')
        print(f'raw_data 키: {list(raw_data.keys()) if isinstance(raw_data, dict) else "Not a dict"}')
        
        # WelnoDataService 인스턴스 생성
        service = WelnoDataService()
        
        # 실제 함수 호출하되, 에러 발생 지점을 정확히 파악
        try:
            print('\\n=== save_health_data 함수 호출 ===')
            result = await service.save_health_data(
                patient_uuid=patient_uuid,
                hospital_id=hospital_id,
                health_data=raw_data,
                session_id=session_id,
                data_source="tilko"
            )
            
            if result:
                print('✅ 성공!')
            else:
                print('❌ 실패 (False 반환)')
                
        except Exception as e:
            print(f'❌ 예외 발생: {e}')
            print(f'예외 타입: {type(e)}')
            
            # 더 자세한 에러 정보
            import traceback
            print('\\n=== 상세 에러 정보 ===')
            traceback.print_exc()
    else:
        print('파일이 존재하지 않습니다.')

if __name__ == "__main__":
    asyncio.run(debug_actual_code())