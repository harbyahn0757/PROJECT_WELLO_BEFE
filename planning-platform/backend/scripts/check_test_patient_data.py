#!/usr/bin/env python3
"""
테스트용 환자 데이터 확인 스크립트
"""
import asyncio
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import asyncpg

TEST_UUID = "e3471a9a-2d67-4a23-8599-849963397d1c"
TEST_HOSPITAL_ID = "KIM_HW_CLINIC"

async def check_patient_data():
    """환자 데이터 확인"""
    db_config = {
        "host": "10.0.1.10",
        "port": "5432",
        "database": "p9_mkt_biz",
        "user": "peernine",
        "password": "autumn3334!"
    }
    
    try:
        conn = await asyncpg.connect(**db_config)
        
        # 환자 정보 조회
        patient_query = """
            SELECT id, uuid, hospital_id, name, phone_number, birth_date, gender,
                   has_health_data, has_prescription_data, last_data_update
            FROM welno.welno_patients 
            WHERE uuid = $1 AND hospital_id = $2
        """
        patient = await conn.fetchrow(patient_query, TEST_UUID, TEST_HOSPITAL_ID)
        
        if not patient:
            print(f"❌ 환자 정보 없음: {TEST_UUID} @ {TEST_HOSPITAL_ID}")
            await conn.close()
            return
        
        print(f"✅ 환자 정보:")
        print(f"   ID: {patient['id']}")
        print(f"   이름: {patient['name']}")
        print(f"   성별: {patient['gender']}")
        print(f"   건강 데이터: {patient['has_health_data']}")
        print(f"   처방전 데이터: {patient['has_prescription_data']}")
        print()
        
        # 건강 데이터 개수 (uuid 기준)
        health_count_query = """
            SELECT COUNT(*) 
            FROM welno.welno_checkup_data 
            WHERE patient_uuid = $1 AND hospital_id = $2
        """
        health_count = await conn.fetchval(health_count_query, TEST_UUID, TEST_HOSPITAL_ID)
        print(f"📊 건강검진 데이터: {health_count}건")
        
        # 처방전 데이터 개수 (uuid 기준)
        prescription_count_query = """
            SELECT COUNT(*) 
            FROM welno.welno_prescription_data 
            WHERE patient_uuid = $1 AND hospital_id = $2
        """
        prescription_count = await conn.fetchval(prescription_count_query, TEST_UUID, TEST_HOSPITAL_ID)
        print(f"💊 처방전 데이터: {prescription_count}건")
        print()
        
        # 최근 건강 데이터 샘플
        if health_count > 0:
            sample_query = """
                SELECT year, checkup_date, location, code
                FROM welno.welno_checkup_data 
                WHERE patient_uuid = $1 AND hospital_id = $2
                ORDER BY year DESC, checkup_date DESC
                LIMIT 3
            """
            samples = await conn.fetch(sample_query, TEST_UUID, TEST_HOSPITAL_ID)
            print("📋 최근 건강검진 샘플:")
            for sample in samples:
                print(f"   - {sample['year']} {sample['checkup_date']} @ {sample['location']} ({sample['code']})")
            print()
        
        await conn.close()
        
    except Exception as e:
        print(f"❌ 오류: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_patient_data())

