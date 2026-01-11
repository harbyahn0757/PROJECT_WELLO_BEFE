#!/usr/bin/env python3
"""
실제 DB 테이블 구조 및 데이터 확인 스크립트
"""
import asyncio
import asyncpg
import json

# 데이터베이스 설정
DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

# 확인할 환자 정보
UUID = "1d2e9e40-de4b-4328-be90-be7540787f6b"
HOSPITAL_ID = "PEERNINE"

async def check_db_structure():
    """실제 DB 테이블 구조 및 데이터 확인"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("\n" + "="*100)
        print("🔍 실제 DB 테이블 구조 및 데이터 확인")
        print("="*100)
        
        # 1. 테이블 컬럼 구조 확인
        print("\n" + "="*100)
        print("📋 1. welno_checkup_data 테이블 구조 확인")
        print("="*100)
        
        columns_query = """
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'welno' 
            AND table_name = 'welno_checkup_data'
            ORDER BY ordinal_position
        """
        columns = await conn.fetch(columns_query)
        
        print("\n컬럼 목록:")
        for col in columns:
            print(f"  - {col['column_name']}: {col['data_type']} (nullable: {col['is_nullable']})")
        
        # 2. 환자 정보 확인
        print("\n" + "="*100)
        print(f"👤 2. 환자 정보 확인 (UUID: {UUID}, Hospital: {HOSPITAL_ID})")
        print("="*100)
        
        patient_query = """
            SELECT id, uuid, hospital_id, name, phone_number, birth_date, gender,
                   has_health_data, has_prescription_data, last_data_update,
                   created_at, updated_at
            FROM welno.welno_patients
            WHERE uuid = $1 AND hospital_id = $2
        """
        patient_row = await conn.fetchrow(patient_query, UUID, HOSPITAL_ID)
        
        if not patient_row:
            print(f"❌ 환자 정보를 찾을 수 없습니다.")
            await conn.close()
            return
        
        patient_id = patient_row['id']
        print(f"\n환자 기본 정보:")
        print(f"  - ID: {patient_id}")
        print(f"  - UUID: {patient_row['uuid']}")
        print(f"  - 이름: {patient_row['name']}")
        print(f"  - 병원: {patient_row['hospital_id']}")
        print(f"  - 건강검진 데이터 있음: {patient_row['has_health_data']}")
        print(f"  - 처방전 데이터 있음: {patient_row['has_prescription_data']}")
        print(f"  - 마지막 데이터 업데이트: {patient_row['last_data_update']}")
        
        # 3. patient_uuid로 건강검진 데이터 확인
        print("\n" + "="*100)
        print("🏥 3. patient_uuid로 건강검진 데이터 확인")
        print("="*100)
        
        health_query_by_uuid = """
            SELECT COUNT(*) as count
            FROM welno.welno_checkup_data
            WHERE patient_uuid = $1 AND hospital_id = $2
        """
        health_count_by_uuid = await conn.fetchval(health_query_by_uuid, UUID, HOSPITAL_ID)
        print(f"\npatient_uuid ({UUID})로 조회: {health_count_by_uuid}건")
        
        if health_count_by_uuid > 0:
            health_sample_query = """
                SELECT id, patient_uuid, hospital_id, year, checkup_date, location, code,
                       raw_data::text as raw_data_text
                FROM welno.welno_checkup_data
                WHERE patient_uuid = $1 AND hospital_id = $2
                LIMIT 3
            """
            health_samples = await conn.fetch(health_sample_query, UUID, HOSPITAL_ID)
            print(f"\n샘플 데이터 (최대 3건):")
            for i, sample in enumerate(health_samples, 1):
                print(f"\n  [{i}] ID: {sample['id']}, Year: {sample['year']}, Date: {sample['checkup_date']}")
                print(f"      Location: {sample['location']}, Code: {sample['code']}")
                raw_data_preview = sample['raw_data_text'][:200] if sample['raw_data_text'] else "NULL"
                print(f"      raw_data (처음 200자): {raw_data_preview}...")
        else:
            print(f"\n⚠️ 데이터가 없습니다. IndexedDB에는 있지만 서버 DB에는 없습니다.")
        
        # 4. 처방전 데이터 확인
        print("\n" + "="*100)
        print("💊 4. 처방전 데이터 확인")
        print("="*100)
        
        prescription_query_by_uuid = """
            SELECT COUNT(*) as count
            FROM welno.welno_prescription_data
            WHERE patient_uuid = $1 AND hospital_id = $2
        """
        prescription_count_by_uuid = await conn.fetchval(prescription_query_by_uuid, UUID, HOSPITAL_ID)
        print(f"\npatient_uuid ({UUID})로 조회: {prescription_count_by_uuid}건")
        
        if prescription_count_by_uuid > 0:
            prescription_sample_query = """
                SELECT id, patient_uuid, hospital_id, hospital_name, treatment_date, treatment_type,
                       raw_data::text as raw_data_text
                FROM welno.welno_prescription_data
                WHERE patient_uuid = $1 AND hospital_id = $2
                LIMIT 3
            """
            prescription_samples = await conn.fetch(prescription_sample_query, UUID, HOSPITAL_ID)
            print(f"\n샘플 데이터 (최대 3건):")
            for i, sample in enumerate(prescription_samples, 1):
                print(f"\n  [{i}] ID: {sample['id']}, Hospital: {sample['hospital_name']}, Date: {sample['treatment_date']}")
                raw_data_preview = sample['raw_data_text'][:200] if sample['raw_data_text'] else "NULL"
                print(f"      raw_data (처음 200자): {raw_data_preview}...")
        else:
            print(f"\n⚠️ 데이터가 없습니다. IndexedDB에는 있지만 서버 DB에는 없습니다.")
        
        # 5. 실제 쿼리 결과 확인 (get_patient_health_data와 동일한 쿼리)
        print("\n" + "="*100)
        print("🔍 5. get_patient_health_data 함수와 동일한 쿼리 실행")
        print("="*100)
        
        try:
            test_health_query = """
                SELECT * FROM welno.welno_checkup_data 
                WHERE patient_uuid = $1 AND hospital_id = $2
                ORDER BY year DESC, checkup_date DESC
                LIMIT 5
            """
            test_health_rows = await conn.fetch(test_health_query, UUID, HOSPITAL_ID)
            print(f"\n쿼리 결과: {len(test_health_rows)}건")
            
            if len(test_health_rows) > 0:
                print("\n첫 번째 행의 컬럼:")
                first_row = dict(test_health_rows[0])
                for key in first_row.keys():
                    print(f"  - {key}: {type(first_row[key]).__name__}")
        except Exception as e:
            print(f"\n❌ 쿼리 실행 실패: {e}")
            print(f"   오류 타입: {type(e).__name__}")
            import traceback
            traceback.print_exc()
        
        await conn.close()
        
        print("\n" + "="*100)
        print("✅ 확인 완료")
        print("="*100)
        
    except Exception as e:
        print(f"❌ [오류] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_db_structure())
