#!/usr/bin/env python3
"""
안광수 사용자 상태 통합 조회 스크립트
- welno_patients
- tb_campaign_payments
- welno_checkup_data (Tilko 데이터)
- welno_mediarc_reports (질병예측 리포트)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import db_manager

# 안광수 UUID들
UUID_CAMPAIGN = 'bbfba40ee649d172c1cee9471249a535'
UUID_WELNO = 'f82a55a9-2199-4328-910d-9e9327e502be'

def check_an_gwangsu_status():
    """안광수 사용자 상태 통합 조회"""
    print('=' * 80)
    print('안광수 사용자 상태 통합 조회')
    print('=' * 80)
    
    with db_manager.get_connection() as conn:
        with conn.cursor() as cur:
            # 1. welno_patients 확인
            print('\n[1] welno_patients 테이블:')
            cur.execute("""
                SELECT uuid, name, phone_number, birth_date, gender, 
                       has_health_data, has_prescription_data, 
                       registration_source, partner_id, created_at
                FROM welno.welno_patients
                WHERE name = '안광수' OR uuid IN (%s, %s)
            """, (UUID_CAMPAIGN, UUID_WELNO))
            patients = cur.fetchall()
            if patients:
                for p in patients:
                    print(f'  UUID: {p[0]}')
                    print(f'  이름: {p[1]}, 전화: {p[2]}, 생년월일: {p[3]}, 성별: {p[4]}')
                    print(f'  건강데이터: {p[5]}, 처방전데이터: {p[6]}')
                    print(f'  등록소스: {p[7]}, 파트너ID: {p[8]}, 생성일: {p[9]}')
                    print()
            else:
                print('  안광수 사용자가 welno_patients에 없음')
            
            # 2. tb_campaign_payments 확인
            print('\n[2] tb_campaign_payments 테이블:')
            cur.execute("""
                SELECT oid, uuid, partner_id, user_name, status, pipeline_step,
                       report_url, created_at, updated_at
                FROM welno.tb_campaign_payments
                WHERE user_name = '안광수' OR uuid IN (%s, %s)
                ORDER BY created_at DESC
            """, (UUID_CAMPAIGN, UUID_WELNO))
            payments = cur.fetchall()
            if payments:
                for p in payments:
                    print(f'  OID: {p[0]}')
                    print(f'  UUID: {p[1]}, 파트너: {p[2]}, 이름: {p[3]}')
                    print(f'  상태: {p[4]}, 파이프라인: {p[5]}')
                    print(f'  리포트URL: {p[6]}, 생성일: {p[7]}, 수정일: {p[8]}')
                    print()
            else:
                print('  안광수 사용자가 tb_campaign_payments에 없음')
            
        # 3. welno_checkup_data 확인 (Tilko 데이터) - 안광수 이름으로 전체 조회
        print('\n[3] welno_checkup_data 테이블 (Tilko 데이터):')
        cur.execute("""
            SELECT cd.patient_uuid, cd.checkup_date, cd.hospital_id, 
                   p.name, p.uuid as patient_table_uuid
            FROM welno.welno_checkup_data cd
            LEFT JOIN welno.welno_patients p ON cd.patient_uuid = p.uuid
            WHERE p.name = '안광수' OR cd.patient_uuid IN (%s, %s)
            ORDER BY cd.checkup_date DESC
        """, (UUID_CAMPAIGN, UUID_WELNO))
        checkup_data = cur.fetchall()
        if checkup_data:
            for row in checkup_data:
                print(f'  patient_uuid: {row[0]}')
                print(f'  checkup_date: {row[1]}, hospital_id: {row[2]}')
                print(f'  환자이름: {row[3]}, 환자테이블UUID: {row[4]}')
                print()
        else:
            print('  검진 데이터 없음')
        
        # 3-1. 각 UUID별로도 확인
        print('\n[3-1] UUID별 검진 데이터 확인:')
        for uuid in [UUID_CAMPAIGN, UUID_WELNO]:
            cur.execute("""
                SELECT COUNT(*) as cnt, MAX(checkup_date) as latest_date
                FROM welno.welno_checkup_data
                WHERE patient_uuid = %s
            """, (uuid,))
            result = cur.fetchone()
            if result and result[0] > 0:
                print(f'  UUID {uuid}: {result[0]}건의 검진 데이터, 최신: {result[1]}')
            else:
                print(f'  UUID {uuid}: 검진 데이터 없음')
            
            # 4. welno_mediarc_reports 확인
            print('\n[4] welno_mediarc_reports 테이블 (질병예측 리포트):')
            for uuid in [UUID_CAMPAIGN, UUID_WELNO]:
                cur.execute("""
                    SELECT COUNT(*) as cnt, MAX(created_at) as latest_date
                    FROM welno.welno_mediarc_reports
                    WHERE patient_uuid = %s
                """, (uuid,))
                result = cur.fetchone()
                if result and result[0] > 0:
                    print(f'  UUID {uuid}: {result[0]}건의 리포트, 최신: {result[1]}')
                else:
                    print(f'  UUID {uuid}: 리포트 없음')
            
            # 5. tb_campaign_payments에서 Tilko 세션 ID 확인
            print('\n[5] tb_campaign_payments Tilko 세션 정보:')
            if payments:
                for p in payments:
                    oid = p[0]
                    cur.execute("""
                        SELECT oid, uuid, user_name, status, pipeline_step, 
                               tilko_session_id, created_at, updated_at
                        FROM welno.tb_campaign_payments
                        WHERE oid = %s
                    """, (oid,))
                    payment_detail = cur.fetchone()
                    if payment_detail:
                        print(f'  OID: {payment_detail[0]}, UUID: {payment_detail[1]}')
                        print(f'  이름: {payment_detail[2]}, 상태: {payment_detail[3]}')
                        print(f'  파이프라인: {payment_detail[4]}, Tilko세션ID: {payment_detail[5]}')
                        print(f'  생성: {payment_detail[6]}, 수정: {payment_detail[7]}')
                        print()
            
            # 6. OID로 리포트 확인
            if payments:
                oid = payments[0][0]
                print(f'\n[6] OID {oid}로 리포트 확인:')
                cur.execute("""
                    SELECT report_url, status, created_at
                    FROM welno.tb_campaign_payments
                    WHERE oid = %s
                """, (oid,))
                report = cur.fetchone()
                if report and report[0]:
                    print(f'  리포트 URL: {report[0]}')
                    print(f'  상태: {report[1]}, 생성일: {report[2]}')
                else:
                    print('  리포트 URL 없음')
            
            # 6. 통합 상태 요약
            print('\n' + '=' * 80)
            print('[6] 통합 상태 요약:')
            print('=' * 80)
            
            # 캠페인 UUID 기준
            print(f'\n캠페인 UUID ({UUID_CAMPAIGN}):')
            campaign_payment = next((p for p in payments if p[1] == UUID_CAMPAIGN), None)
            if campaign_payment:
                print(f'  - 결제 상태: {campaign_payment[4]}')
                print(f'  - 파이프라인: {campaign_payment[5]}')
                print(f'  - 리포트 URL: {campaign_payment[6] or "없음"}')
            else:
                print('  - 캠페인 결제 기록 없음')
            
            # WELNO UUID 기준
            print(f'\nWELNO UUID ({UUID_WELNO}):')
            welno_patient = next((p for p in patients if p[0] == UUID_WELNO), None)
            if welno_patient:
                print(f'  - 건강데이터: {welno_patient[5]}')
                print(f'  - 처방전데이터: {welno_patient[6]}')
                print(f'  - 등록소스: {welno_patient[7]}')
            else:
                print('  - WELNO 환자 기록 없음')

if __name__ == '__main__':
    check_an_gwangsu_status()
