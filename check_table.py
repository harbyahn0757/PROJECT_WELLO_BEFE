import asyncio
import sys
import os

# 프로젝트 루트를 path에 추가
sys.path.append(os.path.join(os.getcwd(), 'planning-platform', 'backend'))

from app.core.database import db_manager

async def check_table():
    # 하드코딩된 DB 설정 적용
    db_manager.connection_params = {
        'host': '10.0.1.10',
        'port': '5432',
        'database': 'p9_mkt_biz',
        'user': 'peernine',
        'password': 'autumn3334!'
    }
    
    query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'welno' AND table_name = 'tb_pending_hospital_registration';"
    try:
        result = await db_manager.execute_query(query)
        print(f"🔍 테이블 조회 결과: {result}")
    except Exception as e:
        print(f"❌ 테이블 조회 실패: {e}")

if __name__ == "__main__":
    asyncio.run(check_table())
