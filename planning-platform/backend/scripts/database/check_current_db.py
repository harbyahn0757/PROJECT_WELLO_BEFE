#!/usr/bin/env python3
"""
현재 DB 상태 확인 스크립트
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# .env.local 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    load_dotenv(env_path)

async def check_current_db_state():
    db_config = {
        'host': os.getenv('DB_HOST', '10.0.1.10'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'p9_mkt_biz'),
        'user': os.getenv('DB_USER', 'peernine'),
        'password': os.getenv('DB_PASSWORD', 'autumn3334!')
    }
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        print('=== 현재 DB 상태 확인 ===')
        
        # 1. 환자 정보 확인
        patients = await conn.fetch("""
            SELECT uuid, hospital_id, name, phone_number, birth_date, has_health_data, has_prescription_data, created_at
            FROM welno.welno_patients
            WHERE uuid = 'bbfba40ee649d172c1cee9471249a535'
        """)
        
        print('1. 환자 정보:')
        if patients:
            for patient in patients:
                print(f'   UUID: {patient["uuid"]}')
                print(f'   이름: {patient["name"]}')
                print(f'   전화번호: {patient["phone_number"]}')
                print(f'   생년월일: {patient["birth_date"]}')
                print(f'   건강데이터 보유: {patient["has_health_data"]}')
                print(f'   처방데이터 보유: {patient["has_prescription_data"]}')
                print(f'   생성일: {patient["created_at"]}')
        else:
            print('   환자 정보 없음')
        
        # 2. 건강검진 데이터 확인
        health_data = await conn.fetch("""
            SELECT patient_uuid, year, checkup_date, created_at
            FROM welno.welno_checkup_data
            WHERE patient_uuid = 'bbfba40ee649d172c1cee9471249a535'
        """)
        
        print('\\n2. 건강검진 데이터:')
        if health_data:
            for data in health_data:
                print(f'   년도: {data["year"]}, 검진일: {data["checkup_date"]}, 생성일: {data["created_at"]}')
        else:
            print('   건강검진 데이터 없음')
        
        # 3. 처방전 데이터 확인
        prescription_data = await conn.fetch("""
            SELECT patient_uuid, hospital_name, treatment_date, created_at
            FROM welno.welno_prescription_data
            WHERE patient_uuid = 'bbfba40ee649d172c1cee9471249a535'
        """)
        
        print('\\n3. 처방전 데이터:')
        if prescription_data:
            for data in prescription_data:
                print(f'   병원: {data["hospital_name"]}, 진료일: {data["treatment_date"]}, 생성일: {data["created_at"]}')
        else:
            print('   처방전 데이터 없음')
        
        # 4. 예측 리포트(Mediarc) 확인
        mediarc = await conn.fetch("""
            SELECT id, patient_uuid, hospital_id, report_url, bodyage, rank, 
                   analyzed_at, provider, created_at, updated_at
            FROM welno.welno_mediarc_reports
            WHERE patient_uuid = 'bbfba40ee649d172c1cee9471249a535'
        """)
        
        print('\n4. 예측 리포트(welno_mediarc_reports):')
        if mediarc:
            for row in mediarc:
                print(f'   id: {row["id"]}')
                print(f'   report_url: {row["report_url"][:80] if row["report_url"] else None}...')
                print(f'   bodyage: {row["bodyage"]}, rank: {row["rank"]}')
                print(f'   analyzed_at: {row["analyzed_at"]}, created_at: {row["created_at"]}, updated_at: {row["updated_at"]}')
        else:
            print('   예측 리포트 없음')
        
        # 5. 결제 정보 확인
        payments = await conn.fetch("""
            SELECT oid, uuid, user_name, status, pipeline_step, created_at
            FROM welno.tb_campaign_payments
            WHERE uuid = 'bbfba40ee649d172c1cee9471249a535'
        """)
        
        print('\n5. 결제 정보:')
        if payments:
            for payment in payments:
                print(f'   OID: {payment["oid"]}')
                print(f'   사용자: {payment["user_name"]}')
                print(f'   상태: {payment["status"]}')
                print(f'   파이프라인: {payment["pipeline_step"]}')
                print(f'   생성일: {payment["created_at"]}')
        else:
            print('   결제 정보 없음')
        
        # 6. 처방전 생성일 상세 (같은 UUID 고아 데이터)
        rx_detail = await conn.fetch("""
            SELECT patient_uuid, hospital_id, treatment_date, created_at, data_source
            FROM welno.welno_prescription_data
            WHERE patient_uuid = 'bbfba40ee649d172c1cee9471249a535'
            ORDER BY created_at DESC
        """)
        print('\n6. 처방전 상세(생성일 기준):')
        if rx_detail:
            for r in rx_detail:
                print(f'   created_at: {r["created_at"]}, treatment_date: {r["treatment_date"]}, data_source: {r["data_source"]}')
        else:
            print('   없음')
            
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(check_current_db_state())