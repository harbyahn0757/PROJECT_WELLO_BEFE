#!/usr/bin/env python3
"""
welno 스키마 존재 여부 및 테이블 확인
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# .env.local 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    load_dotenv(env_path)

async def check_welno_schema():
    """welno 스키마 존재 여부 및 테이블 확인"""
    db_config = {
        'host': os.getenv('DB_HOST', '10.0.1.10'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'p9_mkt_biz'),
        'user': os.getenv('DB_USER', 'peernine'),
        'password': os.getenv('DB_PASSWORD', 'autumn3334!')
    }
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        print('=== PostgreSQL 스키마 확인 ===')
        
        # 1. 모든 스키마 확인
        schemas = await conn.fetch("""
            SELECT schema_name 
            FROM information_schema.schemata 
            ORDER BY schema_name
        """)
        
        print('1. 전체 스키마 목록:')
        welno_exists = False
        for schema in schemas:
            schema_name = schema['schema_name']
            if schema_name == 'welno':
                welno_exists = True
                print(f'   ✅ {schema_name}')
            else:
                print(f'   - {schema_name}')
        
        if not welno_exists:
            print('❌ welno 스키마가 존재하지 않습니다!')
            return
        
        # 2. welno 스키마의 테이블 확인
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'welno'
            ORDER BY table_name
        """)
        
        print('\\n2. welno 스키마의 테이블 목록:')
        target_tables = ['welno_checkup_data', 'welno_prescription_data', 'welno_patients']
        
        for table in tables:
            table_name = table['table_name']
            if table_name in target_tables:
                print(f'   ✅ {table_name}')
            else:
                print(f'   - {table_name}')
        
        # 3. 특정 테이블 존재 확인
        for target_table in target_tables:
            exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_schema = 'welno' 
                    AND table_name = $1
                )
            """, target_table)
            
            if exists:
                print(f'   ✅ {target_table} 존재함')
            else:
                print(f'   ❌ {target_table} 존재하지 않음!')
        
        # 4. 현재 사용자 권한 확인
        current_user = await conn.fetchval("SELECT current_user")
        print(f'\\n3. 현재 DB 사용자: {current_user}')
        
        # 5. welno 스키마 접근 권한 확인
        schema_privileges = await conn.fetch("""
            SELECT 
                grantee,
                privilege_type
            FROM information_schema.schema_privileges 
            WHERE schema_name = 'welno'
        """)
        
        print('\\n4. welno 스키마 권한:')
        for priv in schema_privileges:
            print(f'   {priv["grantee"]}: {priv["privilege_type"]}')
        
        # 6. 간단한 SELECT 테스트
        try:
            count = await conn.fetchval("SELECT COUNT(*) FROM welno.welno_patients")
            print(f'\\n5. welno.welno_patients 접근 테스트: ✅ (총 {count}개 레코드)')
        except Exception as e:
            print(f'\\n5. welno.welno_patients 접근 테스트: ❌ {e}')
        
        try:
            count = await conn.fetchval("SELECT COUNT(*) FROM welno.welno_checkup_data")
            print(f'6. welno.welno_checkup_data 접근 테스트: ✅ (총 {count}개 레코드)')
        except Exception as e:
            print(f'6. welno.welno_checkup_data 접근 테스트: ❌ {e}')
            
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(check_welno_schema())