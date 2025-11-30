#!/usr/bin/env python3
"""병원 테이블 구조 확인 스크립트"""
import asyncio
import asyncpg

DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

async def check_hospital_table():
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        # 테이블 구조 확인
        print("=" * 80)
        print("병원 테이블 구조 확인")
        print("=" * 80)
        columns = await conn.fetch("""
            SELECT 
                column_name, 
                data_type, 
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_schema = 'wello' 
              AND table_name = 'wello_hospitals' 
            ORDER BY ordinal_position
        """)
        
        for col in columns:
            print(f"  {col['column_name']}: {col['data_type']} (nullable: {col['is_nullable']})")
        
        # KIM_HW_CLINIC 데이터 확인
        print("\n" + "=" * 80)
        print("KIM_HW_CLINIC 병원 데이터")
        print("=" * 80)
        hospital = await conn.fetchrow(
            "SELECT * FROM wello.wello_hospitals WHERE hospital_id = $1",
            'KIM_HW_CLINIC'
        )
        
        if hospital:
            for key, value in dict(hospital).items():
                print(f"  {key}: {value}")
        else:
            print("  데이터 없음")
        
        # 모든 병원 목록
        print("\n" + "=" * 80)
        print("모든 병원 목록")
        print("=" * 80)
        hospitals = await conn.fetch(
            "SELECT hospital_id, hospital_name, supported_checkup_types FROM wello.wello_hospitals WHERE is_active = true"
        )
        for h in hospitals:
            print(f"  {h['hospital_id']}: {h['hospital_name']} - {h['supported_checkup_types']}")
        
    except Exception as e:
        print(f"오류 발생: {e}")
    finally:
        if conn:
            await conn.close()

if __name__ == "__main__":
    asyncio.run(check_hospital_table())

