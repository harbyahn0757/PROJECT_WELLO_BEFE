#!/usr/bin/env python3
"""
JSONB 저장 직접 테스트
"""
import asyncio
import asyncpg
import json
import os
from dotenv import load_dotenv

# .env.local 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    load_dotenv(env_path)

async def test_jsonb_direct():
    """JSONB 저장 직접 테스트"""
    db_config = {
        'host': os.getenv('DB_HOST', '10.0.1.10'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'p9_mkt_biz'),
        'user': os.getenv('DB_USER', 'peernine'),
        'password': os.getenv('DB_PASSWORD', 'autumn3334!')
    }
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        # 실제 데이터 로드
        health_file = '/home/workspace/PROJECT_WELLO_BEFE/tilko_data/pending/20260131_021152_350_db94260e-5e97-41c8-89f1-ddaf2ca43a7d_health_data.json'
        
        with open(health_file, 'r', encoding='utf-8') as f:
            health_data = json.load(f)
        
        patient_uuid = health_data['metadata']['patient_uuid']
        hospital_id = health_data['metadata']['hospital_id']
        raw_data = health_data['raw_data']['ResultList'][0]  # 첫 번째 검진 데이터
        
        print('=== 직접 JSONB 저장 테스트 ===')
        print(f'환자 UUID: {patient_uuid}')
        print(f'병원 ID: {hospital_id}')
        
        # 방법 1: json.dumps() + ::jsonb 캐스팅
        try:
            raw_data_json = json.dumps(raw_data, ensure_ascii=False)
            
            query1 = """
                INSERT INTO welno.welno_checkup_data 
                (patient_uuid, hospital_id, raw_data, year, checkup_date, location, code, description, data_source)
                VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9)
            """
            
            await conn.execute(
                query1,
                patient_uuid, hospital_id, raw_data_json,
                raw_data.get('Year', ''), raw_data.get('CheckUpDate', ''),
                raw_data.get('Location', ''), raw_data.get('Code', ''),
                raw_data.get('Description', ''), 'tilko'
            )
            
            print('✅ 방법 1 성공: json.dumps() + ::jsonb 캐스팅')
            
        except Exception as e:
            print(f'❌ 방법 1 실패: {e}')
        
        # 방법 2: CAST 함수 사용
        try:
            raw_data_json = json.dumps(raw_data, ensure_ascii=False)
            
            query2 = """
                INSERT INTO welno.welno_checkup_data 
                (patient_uuid, hospital_id, raw_data, year, checkup_date, location, code, description, data_source)
                VALUES ($1, $2, CAST($3 AS jsonb), $4, $5, $6, $7, $8, $9)
            """
            
            await conn.execute(
                query2,
                patient_uuid, hospital_id, raw_data_json,
                raw_data.get('Year', ''), raw_data.get('CheckUpDate', ''),
                raw_data.get('Location', ''), raw_data.get('Code', ''),
                raw_data.get('Description', ''), 'DIRECT_TEST2'
            )
            
            print('✅ 방법 2 성공: CAST 함수 사용')
            
        except Exception as e:
            print(f'❌ 방법 2 실패: {e}')
        
        # 방법 3: dict 직접 전달 (asyncpg 자동 변환)
        try:
            
            query3 = """
                INSERT INTO welno.welno_checkup_data 
                (patient_uuid, hospital_id, raw_data, year, checkup_date, location, code, description, data_source)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """
            
            # dict 객체를 직접 전달하되, 컬럼 타입을 명시
            await conn.execute(
                query3,
                patient_uuid, hospital_id, raw_data,  # dict 직접 전달
                raw_data.get('Year', ''), raw_data.get('CheckUpDate', ''),
                raw_data.get('Location', ''), raw_data.get('Code', ''),
                raw_data.get('Description', ''), 'DIRECT_TEST3'
            )
            
            print('✅ 방법 3 성공: dict 직접 전달')
            
        except Exception as e:
            print(f'❌ 방법 3 실패: {e}')
            
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(test_jsonb_direct())