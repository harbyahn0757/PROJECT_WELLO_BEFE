#!/usr/bin/env python3
"""
안광수 데이터 마이그레이션 스크립트
WELNO UUID의 Tilko 데이터를 캠페인 UUID로 마이그레이션
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import db_manager

UUID_WELNO = 'f82a55a9-2199-4328-910d-9e9327e502be'
UUID_CAMPAIGN = 'bbfba40ee649d172c1cee9471249a535'

def migrate_an_gwangsu_data():
    """안광수 데이터 마이그레이션"""
    print('=' * 80)
    print('안광수 데이터 마이그레이션')
    print('=' * 80)
    print(f'WELNO UUID: {UUID_WELNO}')
    print(f'캠페인 UUID: {UUID_CAMPAIGN}')
    print()
    
    with db_manager.get_connection() as conn:
        with conn.cursor() as cur:
            # 1. 현재 상태 확인
            print('[1] 현재 상태 확인:')
            cur.execute("""
                SELECT COUNT(*) FROM welno.welno_checkup_data
                WHERE patient_uuid = %s
            """, (UUID_WELNO,))
            welno_count = cur.fetchone()[0]
            
            cur.execute("""
                SELECT COUNT(*) FROM welno.welno_checkup_data
                WHERE patient_uuid = %s
            """, (UUID_CAMPAIGN,))
            campaign_count = cur.fetchone()[0]
            
            print(f'  WELNO UUID 검진 데이터: {welno_count}건')
            print(f'  캠페인 UUID 검진 데이터: {campaign_count}건')
            print()
            
            if welno_count == 0:
                print('⚠️ 마이그레이션할 데이터가 없습니다.')
                return
            
            # 2. 사용자 확인
            print('[2] 마이그레이션 실행:')
            response = input('  정말로 마이그레이션을 진행하시겠습니까? (yes/no): ')
            if response.lower() != 'yes':
                print('  마이그레이션 취소됨')
                return
            
            # 3. welno_checkup_data의 patient_uuid를 캠페인 UUID로 업데이트
            print('\n[3] welno_checkup_data 마이그레이션:')
            cur.execute("""
                UPDATE welno.welno_checkup_data
                SET patient_uuid = %s
                WHERE patient_uuid = %s
            """, (UUID_CAMPAIGN, UUID_WELNO))
            updated_count = cur.rowcount
            conn.commit()
            print(f'  ✅ {updated_count}건의 검진 데이터 마이그레이션 완료')
            
            # 4. welno_patients에 캠페인 UUID로 환자 등록 (없는 경우)
            print('\n[4] welno_patients 캠페인 UUID 등록:')
            cur.execute("""
                SELECT id, name, phone_number, birth_date, gender, has_health_data, has_prescription_data
                FROM welno.welno_patients
                WHERE uuid = %s
                LIMIT 1
            """, (UUID_WELNO,))
            welno_patient = cur.fetchone()
            
            if welno_patient:
                cur.execute("""
                    INSERT INTO welno.welno_patients 
                    (uuid, hospital_id, name, phone_number, birth_date, gender, 
                     has_health_data, has_prescription_data, registration_source, partner_id)
                    VALUES (%s, 'PEERNINE', %s, %s, %s, %s, %s, %s, 'PARTNER', 'medilinx')
                    ON CONFLICT (uuid, hospital_id) DO UPDATE SET
                        has_health_data = EXCLUDED.has_health_data,
                        has_prescription_data = EXCLUDED.has_prescription_data,
                        updated_at = NOW()
                """, (UUID_CAMPAIGN, welno_patient[1], welno_patient[2], welno_patient[3], 
                      welno_patient[4], welno_patient[5], welno_patient[6]))
                conn.commit()
                print(f'  ✅ 캠페인 UUID로 환자 등록 완료')
            else:
                print('  ⚠️ WELNO UUID 환자 정보 없음')
            
            # 5. welno_mediarc_reports의 patient_uuid 업데이트 (있는 경우)
            print('\n[5] welno_mediarc_reports 마이그레이션:')
            cur.execute("""
                UPDATE welno.welno_mediarc_reports
                SET patient_uuid = %s
                WHERE patient_uuid = %s
            """, (UUID_CAMPAIGN, UUID_WELNO))
            report_count = cur.rowcount
            conn.commit()
            print(f'  ✅ {report_count}건의 리포트 마이그레이션 완료')
            
            # 6. 최종 확인
            print('\n[6] 마이그레이션 결과 확인:')
            cur.execute("""
                SELECT COUNT(*) FROM welno.welno_checkup_data
                WHERE patient_uuid = %s
            """, (UUID_CAMPAIGN,))
            final_count = cur.fetchone()[0]
            print(f'  캠페인 UUID 검진 데이터: {final_count}건')
            
            print('\n✅ 마이그레이션 완료!')

if __name__ == '__main__':
    migrate_an_gwangsu_data()
