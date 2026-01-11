#!/usr/bin/env python3
"""
김영상, 안광수님의 데이터 현황 확인 스크립트
데이터 삭제 시 영향도 분석
"""
import asyncio
import asyncpg

# 데이터베이스 설정
DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

# 확인할 환자 정보
PATIENTS = [
    {
        "name": "김영상",
        "uuid": "3a96200c-c61a-47b1-8539-27b73ef2f483",
        "hospital_id": "KHW001"
    },
    {
        "name": "안광수",
        "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "hospital_id": "KHW001"
    }
]

async def check_patient_data():
    """환자 데이터 현황 확인"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("\n" + "="*100)
        print("📋 환자 데이터 현황 확인")
        print("="*100)
        
        for patient in PATIENTS:
            name = patient["name"]
            uuid = patient["uuid"]
            hospital_id = patient["hospital_id"]
            
            print(f"\n{'='*100}")
            print(f"👤 {name}님 데이터 현황")
            print(f"{'='*100}")
            
            # 1. 환자 기본 정보 확인
            patient_query = """
                SELECT id, uuid, hospital_id, name, phone_number, birth_date, gender,
                       has_health_data, has_prescription_data, last_data_update,
                       created_at, updated_at
                FROM welno.welno_patients
                WHERE uuid = $1 AND hospital_id = $2
            """
            patient_row = await conn.fetchrow(patient_query, uuid, hospital_id)
            
            if not patient_row:
                print(f"❌ 환자 정보를 찾을 수 없습니다.")
                continue
            
            patient_id = patient_row['id']
            print(f"\n📋 환자 기본 정보:")
            print(f"  - ID: {patient_id}")
            print(f"  - UUID: {uuid}")
            print(f"  - 이름: {patient_row['name']}")
            print(f"  - 병원: {hospital_id}")
            print(f"  - 전화번호: {patient_row['phone_number']}")
            print(f"  - 생년월일: {patient_row['birth_date']}")
            print(f"  - 성별: {patient_row['gender']}")
            print(f"  - 건강검진 데이터 있음: {patient_row['has_health_data']}")
            print(f"  - 처방전 데이터 있음: {patient_row['has_prescription_data']}")
            print(f"  - 마지막 데이터 업데이트: {patient_row['last_data_update']}")
            
            # 2. 건강검진 데이터 확인 (patient_uuid, hospital_id 기준)
            health_query = """
                SELECT COUNT(*) as count, 
                       MIN(year) as min_year, 
                       MAX(year) as max_year,
                       MIN(checkup_date) as min_date,
                       MAX(checkup_date) as max_date
                FROM welno.welno_checkup_data
                WHERE patient_uuid = $1 AND hospital_id = $2
            """
            health_row = await conn.fetchrow(health_query, uuid, hospital_id)
            health_count = health_row['count'] if health_row else 0
            
            print(f"\n🏥 건강검진 데이터:")
            print(f"  - 건수: {health_count}건")
            if health_count > 0:
                print(f"  - 기간: {health_row['min_year']} ({health_row['min_date']}) ~ {health_row['max_year']} ({health_row['max_date']})")
            
            # 3. 처방전 데이터 확인 (patient_uuid, hospital_id 기준)
            prescription_query = """
                SELECT COUNT(*) as count,
                       MIN(treatment_date) as min_date,
                       MAX(treatment_date) as max_date
                FROM welno.welno_prescription_data
                WHERE patient_uuid = $1 AND hospital_id = $2
            """
            prescription_row = await conn.fetchrow(prescription_query, uuid, hospital_id)
            prescription_count = prescription_row['count'] if prescription_row else 0
            
            print(f"\n💊 처방전 데이터:")
            print(f"  - 건수: {prescription_count}건")
            if prescription_count > 0:
                print(f"  - 기간: {prescription_row['min_date']} ~ {prescription_row['max_date']}")
            
            # 4. 데이터 수집 이력 확인 (선택사항 - 테이블이 있을 경우만)
            history_count = 0
            try:
                history_query = """
                    SELECT COUNT(*) as count,
                           MAX(created_at) as last_collection
                    FROM welno.welno_collection_history
                    WHERE patient_id = $1
                """
                history_row = await conn.fetchrow(history_query, patient_id)
                history_count = history_row['count'] if history_row else 0
                
                print(f"\n📝 데이터 수집 이력:")
                print(f"  - 건수: {history_count}건")
                if history_count > 0:
                    print(f"  - 마지막 수집: {history_row['last_collection']}")
            except Exception:
                print(f"\n📝 데이터 수집 이력:")
                print(f"  - 테이블 없음 (건너뜀)")
            
            # 5. 삭제 시 영향도 분석
            print(f"\n⚠️ 삭제 시 영향도 분석:")
            print(f"  - 건강검진 데이터 삭제: {health_count}건")
            print(f"  - 처방전 데이터 삭제: {prescription_count}건")
            if history_count > 0:
                print(f"  - 데이터 수집 이력 삭제: {history_count}건 (선택사항)")
            print(f"  - 환자 기본 정보 유지: ✅ (삭제 안 함)")
            print(f"  - 환자 기본 정보 영향: has_health_data, has_prescription_data 플래그만 FALSE로 변경")
        
        await conn.close()
        
        print("\n" + "="*100)
        print("📝 삭제 SQL 스크립트")
        print("="*100)
        print("\n-- 김영상, 안광수님의 검진/처방전 데이터만 삭제 (환자 정보는 유지)")
        print("-- 주의: 실제 실행 전 데이터베이스 백업 필수!")
        print()
        
        for patient in PATIENTS:
            name = patient["name"]
            uuid = patient["uuid"]
            hospital_id = patient["hospital_id"]
            
            print(f"-- {name}님 데이터 삭제 (patient_uuid, hospital_id 기준)")
            print(f"DELETE FROM welno.welno_checkup_data WHERE patient_uuid = '{uuid}' AND hospital_id = '{hospital_id}';")
            print(f"DELETE FROM welno.welno_prescription_data WHERE patient_uuid = '{uuid}' AND hospital_id = '{hospital_id}';")
            print()
        
        print("-- 환자 정보 플래그 업데이트")
        for patient in PATIENTS:
            name = patient["name"]
            uuid = patient["uuid"]
            hospital_id = patient["hospital_id"]
            print(f"UPDATE welno.welno_patients SET has_health_data = FALSE, has_prescription_data = FALSE, last_data_update = NULL WHERE uuid = '{uuid}' AND hospital_id = '{hospital_id}';")
        
        print("\n-- 데이터 수집 이력 삭제 (선택사항)")
        print("-- 주의: 이력 데이터도 삭제하려면 아래 SQL 실행")
        for patient in PATIENTS:
            name = patient["name"]
            uuid = patient["uuid"]
            hospital_id = patient["hospital_id"]
            print(f"-- {name}님의 데이터 수집 이력 삭제")
            print(f"DELETE FROM welno.welno_collection_history WHERE patient_id = (SELECT id FROM welno.welno_patients WHERE uuid = '{uuid}' AND hospital_id = '{hospital_id}');")
        
    except Exception as e:
        print(f"❌ [오류] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_patient_data())

