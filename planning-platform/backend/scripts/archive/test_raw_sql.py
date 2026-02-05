#!/usr/bin/env python3
"""
순수 SQL로 JSONB 삽입 테스트
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

async def test_raw_sql():
    """순수 SQL로 JSONB 삽입 테스트"""
    db_config = {
        'host': os.getenv('DB_HOST', '10.0.1.10'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'p9_mkt_biz'),
        'user': os.getenv('DB_USER', 'peernine'),
        'password': os.getenv('DB_PASSWORD', 'autumn3334!')
    }
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        # 테스트 데이터
        test_data = {
            "Year": "2021년",
            "CheckUpDate": "09/28",
            "Location": "서울대학교병원",
            "Code": "A001",
            "Description": "일반건강검진"
        }
        
        # 1. 직접 JSON 문자열로 삽입
        print("=== 1. 직접 JSON 문자열 삽입 테스트 ===")
        try:
            await conn.execute("""
                INSERT INTO welno.welno_checkup_data 
                (patient_uuid, hospital_id, raw_data, year, checkup_date, location, code, description,
                 data_source, indexeddb_synced_at, partner_id, partner_oid)
                VALUES ('test-uuid-1', 'PEERNINE', $1::jsonb, '2021', '09/28', '서울대학교병원', 'A001', '일반건강검진',
                        'tilko', NULL, NULL, NULL)
            """, json.dumps(test_data, ensure_ascii=False))
            print("✅ 직접 JSON 문자열 삽입 성공!")
        except Exception as e:
            print(f"❌ 직접 JSON 문자열 삽입 실패: {e}")
        
        # 2. Python dict 직접 전달
        print("\\n=== 2. Python dict 직접 전달 테스트 ===")
        try:
            await conn.execute("""
                INSERT INTO welno.welno_checkup_data 
                (patient_uuid, hospital_id, raw_data, year, checkup_date, location, code, description,
                 data_source, indexeddb_synced_at, partner_id, partner_oid)
                VALUES ('test-uuid-2', 'PEERNINE', $1, '2021', '09/28', '서울대학교병원', 'A001', '일반건강검진',
                        'tilko', NULL, NULL, NULL)
            """, test_data)
            print("✅ Python dict 직접 전달 성공!")
        except Exception as e:
            print(f"❌ Python dict 직접 전달 실패: {e}")
        
        # 3. 매개변수 없이 리터럴로
        print("\\n=== 3. 매개변수 없이 리터럴 삽입 테스트 ===")
        try:
            json_literal = json.dumps(test_data, ensure_ascii=False).replace("'", "''")
            await conn.execute(f"""
                INSERT INTO welno.welno_checkup_data 
                (patient_uuid, hospital_id, raw_data, year, checkup_date, location, code, description,
                 data_source, indexeddb_synced_at, partner_id, partner_oid)
                VALUES ('test-uuid-3', 'PEERNINE', '{json_literal}'::jsonb, '2021', '09/28', '서울대학교병원', 'A001', '일반건강검진',
                        'tilko', NULL, NULL, NULL)
            """)
            print("✅ 리터럴 삽입 성공!")
        except Exception as e:
            print(f"❌ 리터럴 삽입 실패: {e}")
        
        # 4. 삽입된 데이터 확인
        print("\\n=== 4. 삽입된 데이터 확인 ===")
        rows = await conn.fetch("""
            SELECT patient_uuid, raw_data, year, checkup_date 
            FROM welno.welno_checkup_data 
            WHERE patient_uuid LIKE 'test-uuid-%'
            ORDER BY patient_uuid
        """)
        
        for row in rows:
            print(f"UUID: {row['patient_uuid']}")
            print(f"Raw Data: {row['raw_data']}")
            print(f"Year: {row['year']}")
            print("---")
        
        # 5. 테스트 데이터 정리
        await conn.execute("DELETE FROM welno.welno_checkup_data WHERE patient_uuid LIKE 'test-uuid-%'")
        print("\\n✅ 테스트 데이터 정리 완료")
            
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(test_raw_sql())