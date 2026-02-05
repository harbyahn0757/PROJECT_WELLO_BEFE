#!/usr/bin/env python3
"""
실제 파라미터로 단계별 테스트
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

async def debug_parameters():
    """실제 파라미터로 단계별 테스트"""
    db_config = {
        'host': os.getenv('DB_HOST', '10.0.1.10'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'p9_mkt_biz'),
        'user': os.getenv('DB_USER', 'peernine'),
        'password': os.getenv('DB_PASSWORD', 'autumn3334!')
    }
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        # 실제 데이터에서 가져온 파라미터
        patient_uuid = 'bbfba40ee649d172c1cee9471249a535'
        hospital_id = 'PEERNINE'
        test_data = {
            "Year": "2021년",
            "CheckUpDate": "09/28",
            "Location": "서울대학교병원",
            "Code": "A001",
            "Description": "일반건강검진"
        }
        year = "2021년"
        checkup_date = "09/28"
        location = "서울대학교병원"
        code = "A001"
        description = "일반건강검진"
        
        # 1. 기본 3개 파라미터만
        print("=== 1. 기본 3개 파라미터만 테스트 ===")
        try:
            await conn.execute("""
                INSERT INTO welno.welno_checkup_data 
                (patient_uuid, hospital_id, raw_data)
                VALUES ($1, $2, $3::jsonb)
            """, patient_uuid, hospital_id, json.dumps(test_data, ensure_ascii=False))
            print("✅ 기본 3개 파라미터 성공!")
            await conn.execute("DELETE FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2", patient_uuid, hospital_id)
        except Exception as e:
            print(f"❌ 기본 3개 파라미터 실패: {e}")
        
        # 2. 8개 파라미터 (이전 버전)
        print("\\n=== 2. 8개 파라미터 (이전 버전) 테스트 ===")
        try:
            await conn.execute("""
                INSERT INTO welno.welno_checkup_data 
                (patient_uuid, hospital_id, raw_data, year, checkup_date, location, code, description)
                VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)
            """, patient_uuid, hospital_id, json.dumps(test_data, ensure_ascii=False),
                year, checkup_date, location, code, description)
            print("✅ 8개 파라미터 성공!")
            await conn.execute("DELETE FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2", patient_uuid, hospital_id)
        except Exception as e:
            print(f"❌ 8개 파라미터 실패: {e}")
        
        # 3. 12개 파라미터 (현재 버전)
        print("\\n=== 3. 12개 파라미터 (현재 버전) 테스트 ===")
        try:
            await conn.execute("""
                INSERT INTO welno.welno_checkup_data 
                (patient_uuid, hospital_id, raw_data, year, checkup_date, location, code, description,
                 data_source, indexeddb_synced_at, partner_id, partner_oid)
                VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            """, patient_uuid, hospital_id, json.dumps(test_data, ensure_ascii=False),
                year, checkup_date, location, code, description,
                'tilko', None, None, None)
            print("✅ 12개 파라미터 성공!")
            await conn.execute("DELETE FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2", patient_uuid, hospital_id)
        except Exception as e:
            print(f"❌ 12개 파라미터 실패: {e}")
        
        # 4. None 값들을 다른 값으로 테스트
        print("\\n=== 4. None 대신 빈 문자열 테스트 ===")
        try:
            await conn.execute("""
                INSERT INTO welno.welno_checkup_data 
                (patient_uuid, hospital_id, raw_data, year, checkup_date, location, code, description,
                 data_source, indexeddb_synced_at, partner_id, partner_oid)
                VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            """, patient_uuid, hospital_id, json.dumps(test_data, ensure_ascii=False),
                year, checkup_date, location, code, description,
                'tilko', None, '', '')  # 일부 None을 빈 문자열로
            print("✅ None 대신 빈 문자열 성공!")
            await conn.execute("DELETE FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2", patient_uuid, hospital_id)
        except Exception as e:
            print(f"❌ None 대신 빈 문자열 실패: {e}")
            
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(debug_parameters())