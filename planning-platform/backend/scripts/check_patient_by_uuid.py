"""
UUID로 환자 정보 조회 스크립트
"""
import asyncio
import asyncpg

async def check_patient_by_uuid(uuid: str, hospital_id: str):
    """UUID로 환자 정보 조회"""
    
    # DB 연결 설정
    db_config = {
        'host': '10.0.1.10',
        'port': 5432,
        'database': 'p9_mkt_biz',
        'user': 'peernine',
        'password': 'autumn3334!'
    }
    
    print("=" * 80)
    print(f"🔍 환자 정보 조회: UUID={uuid}, Hospital={hospital_id}")
    print("=" * 80)
    print()
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        # 1. 환자 기본 정보 조회
        print("1️⃣ 환자 기본 정보 (welno_patients)")
        patient = await conn.fetchrow("""
            SELECT id, uuid, hospital_id, name, birth_date, gender, phone_number,
                   has_health_data, has_prescription_data, 
                   last_data_update, last_auth_at, last_access_at,
                   created_at, updated_at
            FROM welno.welno_patients
            WHERE uuid = $1 AND hospital_id = $2
        """, uuid, hospital_id)
        
        if patient:
            print("✅ 환자 정보 발견")
            print(f"  - ID: {patient['id']}")
            print(f"  - 이름: {patient['name']}")
            print(f"  - 생년월일: {patient['birth_date']}")
            print(f"  - 성별: {patient['gender']}")
            print(f"  - 전화번호: {patient['phone_number']}")
            print(f"  - 건강검진 데이터 보유: {patient['has_health_data']}")
            print(f"  - 처방전 데이터 보유: {patient['has_prescription_data']}")
            print(f"  - 마지막 데이터 업데이트: {patient['last_data_update']}")
            print(f"  - 마지막 인증: {patient['last_auth_at']}")
            print(f"  - 마지막 접속: {patient['last_access_at']}")
            print(f"  - 생성일: {patient['created_at']}")
            print(f"  - 수정일: {patient['updated_at']}")
            
            patient_id = patient['id']
            
            # 2. 건강검진 데이터 개수
            print("\n2️⃣ 건강검진 데이터 (welno_checkup_data)")
            checkup_count = await conn.fetchval("""
                SELECT COUNT(*) 
                FROM welno.welno_checkup_data 
                WHERE patient_uuid = $1 AND hospital_id = $2
            """, uuid, hospital_id)
            print(f"  - 총 {checkup_count}건")
            
            if checkup_count > 0:
                checkup_years = await conn.fetch("""
                    SELECT DISTINCT checkup_year, data_source
                    FROM welno.welno_checkup_data 
                    WHERE patient_uuid = $1 AND hospital_id = $2
                    ORDER BY checkup_year DESC
                """, uuid, hospital_id)
                print("  - 연도별:")
                for row in checkup_years:
                    print(f"    • {row['checkup_year']}년 ({row['data_source']})")
            
            # 3. 처방전 데이터 개수
            print("\n3️⃣ 처방전 데이터 (welno_prescription_data)")
            prescription_count = await conn.fetchval("""
                SELECT COUNT(*) 
                FROM welno.welno_prescription_data 
                WHERE patient_uuid = $1 AND hospital_id = $2
            """, uuid, hospital_id)
            print(f"  - 총 {prescription_count}건")
            
            if prescription_count > 0:
                prescription_dates = await conn.fetch("""
                    SELECT prescription_date, data_source
                    FROM welno.welno_prescription_data 
                    WHERE patient_uuid = $1 AND hospital_id = $2
                    ORDER BY prescription_date DESC
                    LIMIT 5
                """, uuid, hospital_id)
                print("  - 최근 5건:")
                for row in prescription_dates:
                    print(f"    • {row['prescription_date']} ({row['data_source']})")
            
            # 4. 검진 설계 요청
            print("\n4️⃣ 검진 설계 요청 (welno_checkup_design_requests)")
            design_count = await conn.fetchval("""
                SELECT COUNT(*) 
                FROM welno.welno_checkup_design_requests 
                WHERE patient_id = $1
            """, patient_id)
            print(f"  - 총 {design_count}건")
            
            if design_count > 0:
                designs = await conn.fetch("""
                    SELECT id, status, created_at, completed_at
                    FROM welno.welno_checkup_design_requests 
                    WHERE patient_id = $1
                    ORDER BY created_at DESC
                    LIMIT 5
                """, patient_id)
                print("  - 최근 5건:")
                for row in designs:
                    status_emoji = "✅" if row['status'] == 'completed' else "⏳"
                    print(f"    {status_emoji} ID: {row['id']}, 상태: {row['status']}, 생성: {row['created_at']}")
            
        else:
            print("❌ 해당 UUID의 환자 정보가 없습니다.")
        
        print("\n" + "=" * 80)
        print("✅ 조회 완료")
        print("=" * 80)
        
    finally:
        await conn.close()

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("사용법: python check_patient_by_uuid.py <UUID> <HOSPITAL_ID>")
        sys.exit(1)
    
    uuid = sys.argv[1]
    hospital_id = sys.argv[2]
    asyncio.run(check_patient_by_uuid(uuid, hospital_id))
