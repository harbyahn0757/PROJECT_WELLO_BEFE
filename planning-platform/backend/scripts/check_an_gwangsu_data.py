"""
안광수 환자 데이터 존재 여부 확인 스크립트
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# .env.local 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
load_dotenv(env_path)

async def check_an_gwangsu_data():
    """안광수 환자 데이터 확인"""
    
    # DB 연결 설정 (WelnoDataService와 동일)
    db_config = {
        'host': '10.0.1.10',
        'port': 5432,
        'database': 'p9_mkt_biz',
        'user': 'peernine',
        'password': 'autumn3334!'
    }
    
    print("=" * 60)
    print("🔍 안광수 환자 데이터 존재 여부 확인")
    print("=" * 60)
    print(f"\n📊 DB 연결 정보:")
    print(f"  - Host: {db_config['host']}")
    print(f"  - Port: {db_config['port']}")
    print(f"  - Database: {db_config['database']}")
    print(f"  - User: {db_config['user']}")
    print()
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        # 1. 환자 기본 정보 조회
        print("1️⃣ 환자 기본 정보 조회 (welno_patients)")
        patients = await conn.fetch("""
            SELECT id, uuid, hospital_id, name, birth_date, gender, phone_number, 
                   created_at, updated_at
            FROM welno.welno_patients
            WHERE name = '안광수'
            ORDER BY created_at DESC
        """)
        
        if patients:
            print(f"✅ 발견: {len(patients)}명")
            for idx, patient in enumerate(patients, 1):
                print(f"\n  환자 #{idx}:")
                print(f"    - ID: {patient['id']}")
                print(f"    - UUID: {patient['uuid']}")
                print(f"    - 병원 ID: {patient['hospital_id']}")
                print(f"    - 이름: {patient['name']}")
                print(f"    - 생년월일: {patient['birth_date']}")
                print(f"    - 성별: {patient['gender']}")
                print(f"    - 전화번호: {patient['phone_number']}")
                print(f"    - 생성일: {patient['created_at']}")
                print(f"    - 수정일: {patient['updated_at']}")
        else:
            print("❌ 환자 정보 없음")
        print()
        
        # 환자가 있을 경우 추가 데이터 확인
        if patients:
            for patient in patients:
                uuid = patient['uuid']
                hospital_id = patient['hospital_id']
                patient_id = patient['id']
                
                print(f"\n{'=' * 60}")
                print(f"📋 환자 {patient['name']} (UUID: {uuid}) 상세 데이터")
                print(f"{'=' * 60}")
                
                # 2. 건강검진 데이터 조회
                print("\n2️⃣ 건강검진 데이터 (welno_checkup_data)")
                checkup_data = await conn.fetch("""
                    SELECT id, patient_uuid, hospital_id, checkup_year, 
                           data_source, raw_data_id, created_at, updated_at
                    FROM welno.welno_checkup_data
                    WHERE patient_uuid = $1 AND hospital_id = $2
                    ORDER BY checkup_year DESC, created_at DESC
                """, uuid, hospital_id)
                
                if checkup_data:
                    print(f"✅ 발견: {len(checkup_data)}건")
                    for idx, data in enumerate(checkup_data, 1):
                        print(f"  #{idx} - 년도: {data['checkup_year']}, 출처: {data['data_source']}, 생성일: {data['created_at']}")
                else:
                    print("❌ 건강검진 데이터 없음")
                
                # 3. 처방전 데이터 조회
                print("\n3️⃣ 처방전 데이터 (welno_prescription_data)")
                prescription_data = await conn.fetch("""
                    SELECT id, patient_uuid, hospital_id, prescription_date,
                           data_source, raw_data_id, created_at, updated_at
                    FROM welno.welno_prescription_data
                    WHERE patient_uuid = $1 AND hospital_id = $2
                    ORDER BY prescription_date DESC, created_at DESC
                """, uuid, hospital_id)
                
                if prescription_data:
                    print(f"✅ 발견: {len(prescription_data)}건")
                    for idx, data in enumerate(prescription_data, 1):
                        print(f"  #{idx} - 날짜: {data['prescription_date']}, 출처: {data['data_source']}, 생성일: {data['created_at']}")
                else:
                    print("❌ 처방전 데이터 없음")
                
                # 4. 검진 설계 요청 조회
                print("\n4️⃣ 검진 설계 요청 (welno_checkup_design_requests)")
                design_requests = await conn.fetch("""
                    SELECT id, patient_id, uuid, hospital_id, status, 
                           created_at, updated_at, completed_at
                    FROM welno.welno_checkup_design_requests
                    WHERE patient_id = $1
                    ORDER BY created_at DESC
                """, patient_id)
                
                if design_requests:
                    print(f"✅ 발견: {len(design_requests)}건")
                    for idx, req in enumerate(design_requests, 1):
                        print(f"  #{idx} - ID: {req['id']}, 상태: {req['status']}, 생성일: {req['created_at']}")
                else:
                    print("❌ 검진 설계 요청 없음")
        
        print("\n" + "=" * 60)
        print("✅ 확인 완료")
        print("=" * 60)
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(check_an_gwangsu_data())
