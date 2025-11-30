#!/usr/bin/env python3
"""
단일 환자의 건강데이터 현황 확인 스크립트
"""
import asyncio
import asyncpg

# 데이터베이스 연결 정보
DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

async def check_patient_data(uuid: str, hospital_id: str):
    """특정 환자의 건강데이터 현황 확인"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("="*100)
        print(f"환자 데이터 현황 확인")
        print(f"UUID: {uuid}")
        print(f"Hospital ID: {hospital_id}")
        print("="*100)
        print()
        
        # 1. 환자 기본 정보 확인
        patient_query = """
            SELECT id, uuid, hospital_id, name, phone_number, birth_date, gender,
                   has_health_data, has_prescription_data, last_data_update, last_auth_at,
                   created_at, updated_at
            FROM wello.wello_patients 
            WHERE uuid = $1 AND hospital_id = $2
        """
        patient_row = await conn.fetchrow(patient_query, uuid, hospital_id)
        
        if not patient_row:
            print("❌ 환자 정보를 찾을 수 없습니다.")
            await conn.close()
            return
        
        print("📋 환자 기본 정보:")
        print(f"  - 이름: {patient_row['name']}")
        print(f"  - 전화번호: {patient_row['phone_number']}")
        print(f"  - 생년월일: {patient_row['birth_date']}")
        print(f"  - 성별: {patient_row['gender']}")
        print(f"  - has_health_data: {patient_row['has_health_data']}")
        print(f"  - has_prescription_data: {patient_row['has_prescription_data']}")
        print(f"  - last_data_update: {patient_row['last_data_update']}")
        print(f"  - last_auth_at: {patient_row['last_auth_at']}")
        print()
        
        # 2. 건강검진 데이터 개수 확인
        health_count_query = """
            SELECT COUNT(*) 
            FROM wello.wello_checkup_data 
            WHERE patient_uuid = $1 AND hospital_id = $2
        """
        health_count = await conn.fetchval(health_count_query, uuid, hospital_id)
        
        print("🏥 건강검진 데이터:")
        print(f"  - 데이터 건수: {health_count}건")
        
        if health_count > 0:
            # 최신 건강검진 데이터 샘플
            health_sample_query = """
                SELECT year, checkup_date, location, code, description, collected_at
                FROM wello.wello_checkup_data 
                WHERE patient_uuid = $1 AND hospital_id = $2
                ORDER BY collected_at DESC
                LIMIT 3
            """
            health_samples = await conn.fetch(health_sample_query, uuid, hospital_id)
            print("  - 최근 데이터 샘플:")
            for sample in health_samples:
                print(f"    • {sample['year']} {sample['checkup_date']} - {sample['location']} ({sample['code']})")
        print()
        
        # 3. 처방전 데이터 개수 확인
        prescription_count_query = """
            SELECT COUNT(*) 
            FROM wello.wello_prescription_data 
            WHERE patient_uuid = $1 AND hospital_id = $2
        """
        prescription_count = await conn.fetchval(prescription_count_query, uuid, hospital_id)
        
        print("💊 처방전 데이터:")
        print(f"  - 데이터 건수: {prescription_count}건")
        
        if prescription_count > 0:
            # 최신 처방전 데이터 샘플
            prescription_sample_query = """
                SELECT hospital_name, treatment_date, treatment_type, collected_at
                FROM wello.wello_prescription_data 
                WHERE patient_uuid = $1 AND hospital_id = $2
                ORDER BY collected_at DESC
                LIMIT 3
            """
            prescription_samples = await conn.fetch(prescription_sample_query, uuid, hospital_id)
            print("  - 최근 데이터 샘플:")
            for sample in prescription_samples:
                print(f"    • {sample['treatment_date']} - {sample['hospital_name']} ({sample['treatment_type']})")
        print()
        
        # 4. 데이터 수집 이력 확인 (테이블이 있을 경우만)
        patient_id = patient_row['id']
        history_count = 0
        try:
            history_count_query = """
                SELECT COUNT(*) 
                FROM wello.wello_collection_history 
                WHERE patient_id = $1
            """
            history_count = await conn.fetchval(history_count_query, patient_id)
            print("📊 데이터 수집 이력:")
            print(f"  - 이력 건수: {history_count}건")
        except Exception:
            print("📊 데이터 수집 이력:")
            print(f"  - 테이블 없음 (건너뜀)")
        print()
        
        # 5. 종합 판단
        print("="*100)
        print("📌 종합 판단:")
        
        if health_count == 0 and prescription_count == 0:
            if patient_row['has_health_data'] == False and patient_row['has_prescription_data'] == False:
                print("  ✅ 건강데이터가 삭제된 상태입니다.")
                print("  ✅ 환자 정보 플래그도 올바르게 업데이트되었습니다.")
            else:
                print("  ⚠️ 데이터는 없지만 플래그가 업데이트되지 않았습니다.")
                print(f"     - has_health_data: {patient_row['has_health_data']} (예상: False)")
                print(f"     - has_prescription_data: {patient_row['has_prescription_data']} (예상: False)")
        elif health_count > 0 or prescription_count > 0:
            print("  ⚠️ 건강데이터가 아직 존재합니다.")
            print(f"     - 건강검진: {health_count}건")
            print(f"     - 처방전: {prescription_count}건")
        else:
            print("  ℹ️ 데이터 상태를 확인할 수 없습니다.")
        
        print("="*100)
        
        await conn.close()
        
    except Exception as e:
        print(f"❌ [오류] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # 확인할 환자 정보
    UUID = "e3471a9a-2d67-4a23-8599-849963397d1c"
    HOSPITAL_ID = "KIM_HW_CLINIC"
    
    asyncio.run(check_patient_data(UUID, HOSPITAL_ID))

