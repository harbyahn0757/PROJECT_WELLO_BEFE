#!/usr/bin/env python3
"""데이터베이스에서 테스트 가능한 환자 UUID 찾기"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv('/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/.env.local')

async def find_test_patients():
    """검진 데이터가 있는 환자 찾기"""
    db_config = {
        "host": os.getenv("DB_HOST", "10.0.1.10"),
        "port": int(os.getenv("DB_PORT", "5432")),
        "database": os.getenv("DB_NAME", "p9_mkt_biz"),
        "user": os.getenv("DB_USER", "peernine"),
        "password": os.getenv("DB_PASSWORD", "autumn3334!")
    }
    
    try:
        conn = await asyncpg.connect(**db_config)
        
        query = """
            SELECT 
                p.uuid,
                p.hospital_id,
                p.name,
                p.birth_date,
                p.gender,
                p.has_health_data,
                p.has_prescription_data
            FROM welno.welno_patients p
            WHERE p.has_health_data = TRUE
            ORDER BY p.created_at DESC
            LIMIT 5
        """
        
        rows = await conn.fetch(query)
        await conn.close()
        
        print("=" * 80)
        print("📋 테스트 가능한 환자 목록")
        print("=" * 80)
        print()
        
        for i, row in enumerate(rows, 1):
            print(f"{i}. {row['name']}")
            print(f"   UUID: {row['uuid']}")
            print(f"   병원: {row['hospital_id']}")
            print(f"   건강 데이터: {'✅' if row['has_health_data'] else '❌'}")
            print(f"   처방전 데이터: {'✅' if row['has_prescription_data'] else '❌'}")
            print()
        
        if rows:
            first = rows[0]
            print("=" * 80)
            print("💡 사용 예시:")
            print("=" * 80)
            print(f"python3 test_checkup_design_api.py --uuid \"{first['uuid']}\" --hospital-id \"{first['hospital_id']}\"")
            print()
        
        return [dict(row) for row in rows]
        
    except Exception as e:
        print(f"❌ 오류: {e}")
        import traceback
        traceback.print_exc()
        return []

if __name__ == "__main__":
    asyncio.run(find_test_patients())
