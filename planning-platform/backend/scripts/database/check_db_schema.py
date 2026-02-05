#!/usr/bin/env python3
"""
DB 스키마 상세 확인
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# .env.local 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    load_dotenv(env_path)

async def check_db_schema():
    """DB 스키마 상세 확인"""
    db_config = {
        'host': os.getenv('DB_HOST', '10.0.1.10'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'p9_mkt_biz'),
        'user': os.getenv('DB_USER', 'peernine'),
        'password': os.getenv('DB_PASSWORD', 'autumn3334!')
    }
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        # welno_checkup_data 테이블의 모든 컬럼 타입 확인
        result = await conn.fetch("""
            SELECT 
                column_name, 
                data_type, 
                udt_name,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_schema = 'welno' 
            AND table_name = 'welno_checkup_data' 
            ORDER BY ordinal_position
        """)
        
        print('=== welno_checkup_data 테이블 스키마 ===')
        for row in result:
            print(f'{row["column_name"]:20} | {row["data_type"]:15} | {row["udt_name"]:15} | nullable: {row["is_nullable"]}')
        
        # 특히 raw_data 컬럼 상세 확인
        raw_data_info = await conn.fetchrow("""
            SELECT 
                column_name, 
                data_type, 
                udt_name,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_schema = 'welno' 
            AND table_name = 'welno_checkup_data' 
            AND column_name = 'raw_data'
        """)
        
        print('\\n=== raw_data 컬럼 상세 정보 ===')
        if raw_data_info:
            for key, value in raw_data_info.items():
                print(f'{key}: {value}')
        
        # 테이블 제약 조건 확인
        constraints = await conn.fetch("""
            SELECT 
                constraint_name,
                constraint_type,
                column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu 
                ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_schema = 'welno' 
            AND tc.table_name = 'welno_checkup_data'
        """)
        
        print('\\n=== 테이블 제약 조건 ===')
        for constraint in constraints:
            print(f'{constraint["constraint_name"]} ({constraint["constraint_type"]}) - {constraint["column_name"]}')
            
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(check_db_schema())