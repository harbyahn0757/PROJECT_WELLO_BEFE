#!/usr/bin/env python3
"""
특정 UUID의 raw_data 구조 확인 스크립트
"""
import asyncio
import asyncpg
import json
import os
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# 데이터베이스 설정
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "10.0.1.10"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "database": os.getenv("DB_NAME", "p9_mkt_biz"),
    "user": os.getenv("DB_USER", "peernine"),
    "password": os.getenv("DB_PASSWORD", "autumn3334!")
}

# 확인할 환자 정보
UUID = "36473377-9f8a-447e-aaef-261b10dd2d85"
HOSPITAL_ID = "PEERNINE"

async def check_raw_data():
    """raw_data 구조 확인"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("\n" + "="*100)
        print("🔍 raw_data 구조 확인")
        print("="*100)
        print(f"\n👤 환자 정보:")
        print(f"   UUID: {UUID}")
        print(f"   Hospital ID: {HOSPITAL_ID}")
        print()
        
        # 건강검진 데이터 확인
        health_query = """
            SELECT id, patient_uuid, hospital_id, raw_data, year, checkup_date, location, code, created_at
            FROM welno.welno_checkup_data 
            WHERE patient_uuid = $1 AND hospital_id = $2
            ORDER BY year DESC, checkup_date DESC
        """
        health_rows = await conn.fetch(health_query, UUID, HOSPITAL_ID)
        
        print(f"🏥 건강검진 데이터: {len(health_rows)}건\n")
        
        for idx, row in enumerate(health_rows, 1):
            print(f"[{idx}] ID: {row['id']}")
            print(f"    - year: {row['year']}")
            print(f"    - checkup_date: {row['checkup_date']}")
            print(f"    - location: {row['location']}")
            print(f"    - code: {row['code']}")
            print(f"    - raw_data 타입: {type(row['raw_data'])}")
            
            if row['raw_data']:
                if isinstance(row['raw_data'], str):
                    print(f"    - raw_data 길이: {len(row['raw_data'])} 문자")
                    try:
                        parsed = json.loads(row['raw_data'])
                        print(f"    - JSON 파싱 성공: {type(parsed)}")
                        print(f"    - 파싱된 데이터 키: {list(parsed.keys())[:10] if isinstance(parsed, dict) else 'N/A'}")
                    except json.JSONDecodeError as e:
                        print(f"    - ❌ JSON 파싱 실패: {e}")
                        print(f"    - raw_data 처음 200자: {row['raw_data'][:200]}")
                elif isinstance(row['raw_data'], dict):
                    print(f"    - raw_data는 이미 dict 타입")
                    print(f"    - raw_data 키: {list(row['raw_data'].keys())[:10]}")
            else:
                print(f"    - ⚠️ raw_data가 None 또는 비어있음")
            print()
        
        await conn.close()
        
        print("="*100)
        print("✅ 확인 완료")
        print("="*100)
        
    except Exception as e:
        print(f"❌ [오류] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_raw_data())
