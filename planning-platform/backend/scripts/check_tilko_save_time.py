#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import db_manager

UUID_WELNO = 'f82a55a9-2199-4328-910d-9e9327e502be'
UUID_CAMPAIGN = 'bbfba40ee649d172c1cee9471249a535'

print('=' * 80)
print('안광수 Tilko 데이터 저장 시간 확인')
print('=' * 80)

with db_manager.get_connection() as conn:
    with conn.cursor() as cur:
        # welno_checkup_data의 모든 컬럼 확인
        print('\n[1] welno_checkup_data 테이블 구조 확인:')
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'welno' 
            AND table_name = 'welno_checkup_data'
            ORDER BY ordinal_position
        """)
        columns = cur.fetchall()
        for col in columns:
            print(f'  {col[0]}: {col[1]}')
        
        # 안광수 Tilko 데이터 저장 시간 확인
        print('\n[2] 안광수 Tilko 데이터 저장 시간:')
        cur.execute("""
            SELECT patient_uuid, checkup_date, hospital_id,
                   created_at, updated_at, collected_at
            FROM welno.welno_checkup_data
            WHERE patient_uuid = %s
            ORDER BY checkup_date DESC
        """, (UUID_WELNO,))
        
        data = cur.fetchall()
        if data:
            for row in data:
                print(f'  patient_uuid: {row[0]}')
                print(f'  checkup_date: {row[1]}, hospital_id: {row[2]}')
                print(f'  created_at: {row[3]}')
                print(f'  updated_at: {row[4]}')
                print(f'  collected_at: {row[5]}')
                print()
        else:
            print('  데이터 없음')
        
        # tb_campaign_payments의 업데이트 시간과 비교
        print('\n[3] tb_campaign_payments 업데이트 시간:')
        cur.execute("""
            SELECT oid, uuid, user_name, status, pipeline_step,
                   created_at, updated_at
            FROM welno.tb_campaign_payments
            WHERE uuid = %s AND user_name = '안광수'
            ORDER BY updated_at DESC
            LIMIT 1
        """, (UUID_CAMPAIGN,))
        payment = cur.fetchone()
        if payment:
            print(f'  OID: {payment[0]}')
            print(f'  UUID: {payment[1]}, 이름: {payment[2]}')
            print(f'  상태: {payment[3]}, 파이프라인: {payment[4]}')
            print(f'  생성: {payment[5]}')
            print(f'  수정: {payment[6]}')
        
        # welno_patients 생성 시간
        print('\n[4] welno_patients 생성 시간:')
        cur.execute("""
            SELECT uuid, name, created_at, updated_at, last_data_update
            FROM welno.welno_patients
            WHERE uuid = %s
        """, (UUID_WELNO,))
        patient = cur.fetchone()
        if patient:
            print(f'  UUID: {patient[0]}, 이름: {patient[1]}')
            print(f'  생성: {patient[2]}')
            print(f'  수정: {patient[3]}')
            print(f'  마지막 데이터 업데이트: {patient[4]}')
        
        # 시간 비교
        print('\n' + '=' * 80)
        print('[5] 시간 순서 비교:')
        print('=' * 80)
        
        if data and payment and patient:
            checkup_time = data[0][3] if data[0][3] else data[0][5]  # created_at 또는 collected_at
            payment_update = payment[6]  # updated_at
            patient_create = patient[2]  # created_at
            patient_data_update = patient[4]  # last_data_update
            
            times = [
                ('환자 생성', patient_create),
                ('결제 업데이트', payment_update),
                ('Tilko 데이터 저장', checkup_time),
                ('환자 데이터 업데이트', patient_data_update)
            ]
            
            # None 제거하고 정렬
            valid_times = [(name, time) for name, time in times if time]
            valid_times.sort(key=lambda x: x[1])
            
            for name, time in valid_times:
                print(f'  {name}: {time}')

if __name__ == '__main__':
    pass
