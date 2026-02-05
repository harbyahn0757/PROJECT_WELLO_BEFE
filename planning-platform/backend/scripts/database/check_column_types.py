#!/usr/bin/env python3
"""
welno_checkup_data 테이블의 컬럼 타입 확인
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# .env.local 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    load_dotenv(env_path)

async def check_column_types():
    """테이블 컬럼 타입 확인"""
    db_config = {
        'host': os.getenv('DB_HOST', '10.0.1.10'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'p9_mkt_biz'),
        'user': os.getenv('DB_USER', 'peernine'),
        'password': os.getenv('DB_PASSWORD', 'autumn3334!')
    }
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        print('=== welno_checkup_data 컬럼 타입 확인 ===')
        
        # 컬럼 정보 조회
        columns = await conn.fetch("""
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_schema = 'welno' 
            AND table_name = 'welno_checkup_data'
            ORDER BY ordinal_position
        """)
        
        for col in columns:
            col_name = col['column_name']
            data_type = col['data_type']
            max_length = col['character_maximum_length']
            nullable = col['is_nullable']
            default = col['column_default']
            
            type_info = data_type
            if max_length:
                type_info += f"({max_length})"
            
            print(f"   {col_name:20} | {type_info:15} | NULL: {nullable:3} | Default: {default}")
        
        print('\\n=== welno_prescription_data 컬럼 타입 확인 ===')
        
        # 처방전 테이블 컬럼 정보 조회
        columns = await conn.fetch("""
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_schema = 'welno' 
            AND table_name = 'welno_prescription_data'
            ORDER BY ordinal_position
        """)
        
        for col in columns:
            col_name = col['column_name']
            data_type = col['data_type']
            max_length = col['character_maximum_length']
            nullable = col['is_nullable']
            default = col['column_default']
            
            type_info = data_type
            if max_length:
                type_info += f"({max_length})"
            
            print(f"   {col_name:20} | {type_info:15} | NULL: {nullable:3} | Default: {default}")
            
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(check_column_types())