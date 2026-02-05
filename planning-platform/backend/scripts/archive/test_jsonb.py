#!/usr/bin/env python3
"""
JSONB 타입 처리 방식 테스트
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

async def test_jsonb_types():
    db_config = {
        'host': os.getenv('DB_HOST', '10.0.1.10'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'p9_mkt_biz'),
        'user': os.getenv('DB_USER', 'peernine'),
        'password': os.getenv('DB_PASSWORD', 'autumn3334!')
    }
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        # 테스트용 임시 테이블 생성
        await conn.execute('CREATE TEMP TABLE test_jsonb (id SERIAL, data JSONB)')
        
        # 1. dict 객체 직접 전달 (실패할 것)
        test_dict = {'name': '테스트', 'value': 123}
        try:
            await conn.execute('INSERT INTO test_jsonb (data) VALUES ($1)', test_dict)
            print('✅ dict 객체 직접 전달: 성공')
        except Exception as e:
            print(f'❌ dict 객체 직접 전달: {e}')
        
        # 2. JSON 문자열 전달 (성공할 것)
        test_json_str = json.dumps(test_dict, ensure_ascii=False)
        try:
            await conn.execute('INSERT INTO test_jsonb (data) VALUES ($1)', test_json_str)
            print('✅ JSON 문자열 전달: 성공')
        except Exception as e:
            print(f'❌ JSON 문자열 전달: {e}')
            
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(test_jsonb_types())