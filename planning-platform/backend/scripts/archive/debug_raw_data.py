#!/usr/bin/env python3
"""
raw_data_json 변수 값 확인
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

async def debug_raw_data():
    """raw_data_json 변수 값 확인"""
    
    print("=== raw_data_json 변수 값 확인 ===")
    
    # 실제 파일에서 데이터 로드
    health_file_path = '/home/workspace/PROJECT_WELLO_BEFE/tilko_data/failed/20260131_021152_350_db94260e-5e97-41c8-89f1-ddaf2ca43a7d_health_data.json'
    
    with open(health_file_path, 'r', encoding='utf-8') as f:
        file_data = json.load(f)
    
    raw_data = file_data.get('raw_data', {})
    result_list = raw_data.get('ResultList', [])
    
    if not result_list:
        print("❌ ResultList가 비어있습니다!")
        return
    
    item = result_list[0]  # 첫 번째 아이템
    
    print(f"원본 item 타입: {type(item)}")
    print(f"원본 item 내용: {item}")
    
    # json.dumps 실행
    raw_data_json = json.dumps(item, ensure_ascii=False)
    
    print(f"\\nraw_data_json 타입: {type(raw_data_json)}")
    print(f"raw_data_json 길이: {len(raw_data_json)}")
    print(f"raw_data_json 내용 (처음 200자): {raw_data_json[:200]}...")
    
    # 특수 문자 확인
    print(f"\\n특수 문자 확인:")
    null_char = '\\x00'
    backslash = '\\\\'
    quote = '\"'
    print(f"- NULL 문자 포함: {null_char in raw_data_json}")
    print(f"- 백슬래시 개수: {raw_data_json.count(backslash)}")
    print(f"- 따옴표 개수: {raw_data_json.count(quote)}")
    
    # 다시 JSON 파싱 가능한지 확인
    try:
        parsed_back = json.loads(raw_data_json)
        print(f"✅ JSON 파싱 성공: {type(parsed_back)}")
    except Exception as e:
        print(f"❌ JSON 파싱 실패: {e}")
    
    # asyncpg로 직접 테스트
    import asyncpg
    
    db_config = {
        'host': os.getenv('DB_HOST', '10.0.1.10'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'p9_mkt_biz'),
        'user': os.getenv('DB_USER', 'peernine'),
        'password': os.getenv('DB_PASSWORD', 'autumn3334!')
    }
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        print(f"\\n=== asyncpg 직접 테스트 ===")
        
        # 1. 간단한 테스트
        await conn.execute("""
            INSERT INTO welno.welno_checkup_data 
            (patient_uuid, hospital_id, raw_data)
            VALUES ('test-debug-1', 'PEERNINE', $1::jsonb)
        """, raw_data_json)
        print("✅ 간단한 테스트 성공!")
        
        # 2. 전체 파라미터 테스트
        await conn.execute("""
            INSERT INTO welno.welno_checkup_data 
            (patient_uuid, hospital_id, raw_data, year, checkup_date, location, code, description,
             data_source, indexeddb_synced_at, partner_id, partner_oid)
            VALUES ('test-debug-2', 'PEERNINE', $1::jsonb, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        """, raw_data_json, 'test', 'test', 'test', 'test', 'test', 'tilko', None, None, None)
        print("✅ 전체 파라미터 테스트 성공!")
        
        # 정리
        await conn.execute("DELETE FROM welno.welno_checkup_data WHERE patient_uuid LIKE 'test-debug-%'")
        
    except Exception as e:
        print(f"❌ asyncpg 테스트 실패: {e}")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(debug_raw_data())