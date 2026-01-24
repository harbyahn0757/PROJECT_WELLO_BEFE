#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import db_manager

UUID_CAMPAIGN = 'bbfba40ee649d172c1cee9471249a535'
UUID_WELNO = 'f82a55a9-2199-4328-910d-9e9327e502be'

print('=' * 80)
print('안광수 Tilko 데이터 저장 상태 확인')
print('=' * 80)

with db_manager.get_connection() as conn:
    with conn.cursor() as cur:
        # 1. welno_checkup_data 전체 확인
        print('\n[1] welno_checkup_data (안광수 관련 모든 데이터):')
        cur.execute("""
            SELECT cd.patient_uuid, cd.checkup_date, cd.hospital_id, p.name
            FROM welno.welno_checkup_data cd
            LEFT JOIN welno.welno_patients p ON cd.patient_uuid = p.uuid
            WHERE p.name = '안광수' OR cd.patient_uuid IN (%s, %s)
            ORDER BY cd.checkup_date DESC
        """, (UUID_CAMPAIGN, UUID_WELNO))
        
        checkup_data = cur.fetchall()
        if checkup_data:
            for row in checkup_data:
                print(f'  patient_uuid: {row[0]}')
                print(f'  checkup_date: {row[1]}, hospital_id: {row[2]}, 이름: {row[3]}')
                print()
        else:
            print('  검진 데이터 없음')
        
        # 2. welno_patients 확인
        print('\n[2] welno_patients (안광수):')
        cur.execute("""
            SELECT uuid, name, phone_number, birth_date, has_health_data
            FROM welno.welno_patients
            WHERE name = '안광수'
        """)
        patients = cur.fetchall()
        for p in patients:
            print(f'  UUID: {p[0]}')
            print(f'  이름: {p[1]}, 전화: {p[2]}, 생년월일: {p[3]}, 건강데이터: {p[4]}')
            print()
        
        # 3. 결론
        print('\n' + '=' * 80)
        print('[결론]')
        print('=' * 80)
        
        campaign_has_data = any(row[0] == UUID_CAMPAIGN for row in checkup_data) if checkup_data else False
        welno_has_data = any(row[0] == UUID_WELNO for row in checkup_data) if checkup_data else False
        
        print(f'\n캠페인 UUID ({UUID_CAMPAIGN}):')
        print(f'  Tilko 데이터: {"있음" if campaign_has_data else "없음"}')
        
        print(f'\nWELNO UUID ({UUID_WELNO}):')
        print(f'  Tilko 데이터: {"있음" if welno_has_data else "없음"}')
        
        if not campaign_has_data and welno_has_data:
            print('\n⚠️ 문제: Tilko 데이터가 WELNO UUID로 저장되어 있음!')
            print('  → 캠페인 UUID로는 조회 불가')
            print('  → 원인: Tilko 인증 시 기존 환자(WELNO UUID)를 찾아서 그 UUID 사용')
