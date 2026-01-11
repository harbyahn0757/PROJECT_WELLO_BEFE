#!/usr/bin/env python3
"""
특정 UUID의 건강검진 및 처방전 데이터 확인 스크립트
"""
import asyncio
import asyncpg
import os
import json
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
UUID = "36473377-9f8a-447e-aaef-261b10dd2d85"  # 최근 수집한 UUID
HOSPITAL_ID = "PEERNINE"

async def check_health_data():
    """건강검진 및 처방전 데이터 확인"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("\n" + "="*100)
        print("🔍 건강검진 및 처방전 데이터 확인")
        print("="*100)
        print(f"\n👤 환자 정보:")
        print(f"   UUID: {UUID}")
        print(f"   Hospital ID: {HOSPITAL_ID}")
        print()
        
        # 환자 정보 확인
        patient_info = await conn.fetchrow(
            "SELECT id, name, phone_number, has_health_data, has_prescription_data, last_data_update FROM welno.welno_patients WHERE uuid = $1 AND hospital_id = $2",
            UUID, HOSPITAL_ID
        )
        
        if patient_info:
            print(f"📋 환자 정보:")
            print(f"   - ID: {patient_info['id']}")
            print(f"   - 이름: {patient_info['name']}")
            print(f"   - 전화번호: {patient_info['phone_number']}")
            print(f"   - has_health_data: {patient_info['has_health_data']}")
            print(f"   - has_prescription_data: {patient_info['has_prescription_data']}")
            print(f"   - last_data_update: {patient_info['last_data_update']}")
        else:
            print("⚠️ 환자 정보를 찾을 수 없습니다.")
        
        print()
        
        # 건강검진 데이터 확인
        health_count = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2",
            UUID, HOSPITAL_ID
        )
        
        print(f"🏥 건강검진 데이터: {health_count}건")
        
        if health_count > 0:
            health_rows = await conn.fetch(
                "SELECT year, checkup_date, location, code, created_at FROM welno.welno_checkup_data WHERE patient_uuid = $1 AND hospital_id = $2 ORDER BY year DESC, checkup_date DESC",
                UUID, HOSPITAL_ID
            )
            
            for idx, row in enumerate(health_rows, 1):
                print(f"   {idx}. {row['year']}년 {row['checkup_date']} - {row['location']} ({row['code']})")
                print(f"      생성일: {row['created_at']}")
        
        print()
        
        # 처방전 데이터 확인
        prescription_count = await conn.fetchval(
            "SELECT COUNT(*) FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2",
            UUID, HOSPITAL_ID
        )
        
        print(f"💊 처방전 데이터: {prescription_count}건")
        
        if prescription_count > 0:
            prescription_rows = await conn.fetch(
                "SELECT hospital_name, treatment_date, treatment_type, visit_count, prescription_count, created_at FROM welno.welno_prescription_data WHERE patient_uuid = $1 AND hospital_id = $2 ORDER BY treatment_date DESC LIMIT 10",
                UUID, HOSPITAL_ID
            )
            
            for idx, row in enumerate(prescription_rows, 1):
                print(f"   {idx}. {row['treatment_date']} - {row['hospital_name']} ({row['treatment_type']})")
                print(f"      방문: {row['visit_count']}회, 처방: {row['prescription_count']}회")
                print(f"      생성일: {row['created_at']}")
        
        await conn.close()
        
        print()
        print("="*100)
        print("✅ 확인 완료")
        print("="*100)
        
    except Exception as e:
        print(f"❌ [오류] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_health_data())
