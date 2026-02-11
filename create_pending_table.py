import asyncio
import sys
import os

# 프로젝트 루트를 path에 추가
sys.path.append(os.path.join(os.getcwd(), 'planning-platform', 'backend'))

from app.core.database import db_manager

async def create_table():
    # 하드코딩된 DB 설정 적용
    db_manager.connection_params = {
        'host': '10.0.1.10',
        'port': '5432',
        'database': 'p9_mkt_biz',
        'user': 'peernine',
        'password': 'autumn3334!'
    }
    
    query = """
    CREATE TABLE IF NOT EXISTS welno.tb_pending_hospital_registration (
        id SERIAL PRIMARY KEY,
        partner_id VARCHAR(50) NOT NULL,
        hospital_id VARCHAR(50) NOT NULL,
        first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        request_count INT DEFAULT 1,
        status VARCHAR(20) DEFAULT 'pending',
        UNIQUE (partner_id, hospital_id)
    );
    """
    try:
        await db_manager.execute_update(query)
        print("✅ tb_pending_hospital_registration 테이블 생성 완료")
    except Exception as e:
        print(f"❌ 테이블 생성 실패: {e}")

if __name__ == "__main__":
    asyncio.run(create_table())
