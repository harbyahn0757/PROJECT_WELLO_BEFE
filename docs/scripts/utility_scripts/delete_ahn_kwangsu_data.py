#!/usr/bin/env python3
"""
안광수 환자 데이터 완전 삭제 스크립트

모든 관련 테이블에서 안광수 환자의 데이터를 확인하고 삭제합니다:
- welno_patients
- welno_checkup_data
- welno_prescription_data
- welno_mediarc_reports
- welno_collection_history
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'planning-platform', 'backend'))

import psycopg2
import psycopg2.extras
from datetime import datetime
from app.core.config import settings

def get_db_connection():
    """데이터베이스 연결"""
    return psycopg2.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        database=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD
    )

def find_patient_data(conn):
    """안광수 환자 데이터 찾기"""
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    print("=" * 80)
    print("🔍 안광수 환자 데이터 검색 중...")
    print("=" * 80)
    
    # 1. 환자 기본 정보 조회
    cursor.execute("""
        SELECT 
            id, uuid, hospital_id, name, phone_number, birth_date, 
            gender, has_health_data, has_prescription_data, 
            has_mediarc_report, has_questionnaire_data,
            last_data_update, last_auth_at, created_at
        FROM welno_patients
        WHERE name = '안광수'
        ORDER BY created_at DESC
    """)
    patients = cursor.fetchall()
    
    if not patients:
        print("\n❌ '안광수' 이름의 환자를 찾을 수 없습니다.")
        return None
    
    print(f"\n✅ {len(patients)}명의 '안광수' 환자 발견:")
    print("-" * 80)
    
    all_data = []
    
    for idx, patient in enumerate(patients, 1):
        patient_id = patient['id']
        print(f"\n[환자 #{idx}]")
        print(f"  ID: {patient_id}")
        print(f"  UUID: {patient['uuid']}")
        print(f"  병원 ID: {patient['hospital_id']}")
        print(f"  이름: {patient['name']}")
        print(f"  전화번호: {patient['phone_number']}")
        print(f"  생년월일: {patient['birth_date']}")
        print(f"  성별: {patient['gender']}")
        print(f"  건강검진 데이터: {'있음' if patient['has_health_data'] else '없음'}")
        print(f"  처방전 데이터: {'있음' if patient['has_prescription_data'] else '없음'}")
        print(f"  Mediarc 리포트: {'있음' if patient['has_mediarc_report'] else '없음'}")
        print(f"  문진 데이터: {'있음' if patient['has_questionnaire_data'] else '없음'}")
        print(f"  마지막 데이터 업데이트: {patient['last_data_update']}")
        print(f"  마지막 인증: {patient['last_auth_at']}")
        print(f"  생성일: {patient['created_at']}")
        
        # 2. 건강검진 데이터 개수
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM welno_checkup_data
            WHERE patient_id = %s
        """, (patient_id,))
        checkup_count = cursor.fetchone()['count']
        print(f"  건강검진 데이터: {checkup_count}건")
        
        # 3. 처방전 데이터 개수
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM welno_prescription_data
            WHERE patient_id = %s
        """, (patient_id,))
        prescription_count = cursor.fetchone()['count']
        print(f"  처방전 데이터: {prescription_count}건")
        
        # 4. Mediarc 리포트 개수
        cursor.execute("""
            SELECT COUNT(*) as count, 
                   MAX(analyzed_at) as last_analyzed,
                   MAX(bodyage) as bodyage
            FROM welno_mediarc_reports
            WHERE patient_id = %s
        """, (patient_id,))
        report = cursor.fetchone()
        report_count = report['count']
        print(f"  Mediarc 리포트: {report_count}건")
        if report_count > 0:
            print(f"    - 마지막 분석: {report['last_analyzed']}")
            print(f"    - 체질 나이: {report['bodyage']}")
        
        # 5. 수집 이력 개수
        cursor.execute("""
            SELECT COUNT(*) as count,
                   MAX(started_at) as last_collection
            FROM welno_collection_history
            WHERE patient_id = %s
        """, (patient_id,))
        history = cursor.fetchone()
        history_count = history['count']
        print(f"  수집 이력: {history_count}건")
        if history_count > 0:
            print(f"    - 마지막 수집: {history['last_collection']}")
        
        all_data.append({
            'patient': patient,
            'checkup_count': checkup_count,
            'prescription_count': prescription_count,
            'report_count': report_count,
            'history_count': history_count
        })
        
        print("-" * 80)
    
    cursor.close()
    return all_data

def delete_patient_data(conn, patient_id, patient_name):
    """환자 데이터 삭제"""
    cursor = conn.cursor()
    
    print(f"\n🗑️  환자 ID {patient_id} (이름: {patient_name}) 데이터 삭제 중...")
    
    try:
        # 1. 수집 이력 삭제
        cursor.execute("DELETE FROM welno_collection_history WHERE patient_id = %s", (patient_id,))
        history_deleted = cursor.rowcount
        print(f"  ✅ 수집 이력: {history_deleted}건 삭제")
        
        # 2. Mediarc 리포트 삭제
        cursor.execute("DELETE FROM welno_mediarc_reports WHERE patient_id = %s", (patient_id,))
        reports_deleted = cursor.rowcount
        print(f"  ✅ Mediarc 리포트: {reports_deleted}건 삭제")
        
        # 3. 처방전 데이터 삭제
        cursor.execute("DELETE FROM welno_prescription_data WHERE patient_id = %s", (patient_id,))
        prescriptions_deleted = cursor.rowcount
        print(f"  ✅ 처방전 데이터: {prescriptions_deleted}건 삭제")
        
        # 4. 건강검진 데이터 삭제
        cursor.execute("DELETE FROM welno_checkup_data WHERE patient_id = %s", (patient_id,))
        checkups_deleted = cursor.rowcount
        print(f"  ✅ 건강검진 데이터: {checkups_deleted}건 삭제")
        
        # 5. 환자 기본 정보 삭제
        cursor.execute("DELETE FROM welno_patients WHERE id = %s", (patient_id,))
        patient_deleted = cursor.rowcount
        print(f"  ✅ 환자 기본 정보: {patient_deleted}건 삭제")
        
        conn.commit()
        print(f"\n✅ 환자 ID {patient_id}의 모든 데이터가 성공적으로 삭제되었습니다!")
        
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ 삭제 중 오류 발생: {e}")
        return False
    finally:
        cursor.close()

def main():
    """메인 실행 함수"""
    print("\n" + "=" * 80)
    print("🗑️  안광수 환자 데이터 완전 삭제 스크립트")
    print("=" * 80)
    
    try:
        # 데이터베이스 연결
        conn = get_db_connection()
        print(f"\n✅ 데이터베이스 연결 성공 ({settings.DB_NAME})")
        
        # 환자 데이터 검색
        patient_data_list = find_patient_data(conn)
        
        if not patient_data_list:
            print("\n종료합니다.")
            conn.close()
            return
        
        # 삭제 확인
        print("\n" + "=" * 80)
        print("⚠️  경고: 위의 모든 데이터가 완전히 삭제됩니다!")
        print("=" * 80)
        
        confirm = input("\n정말로 삭제하시겠습니까? (yes/no): ").strip().lower()
        
        if confirm != 'yes':
            print("\n❌ 삭제가 취소되었습니다.")
            conn.close()
            return
        
        # 삭제 실행
        print("\n" + "=" * 80)
        print("🗑️  삭제 실행 중...")
        print("=" * 80)
        
        success_count = 0
        for data in patient_data_list:
            patient = data['patient']
            if delete_patient_data(conn, patient['id'], patient['name']):
                success_count += 1
        
        # 최종 결과
        print("\n" + "=" * 80)
        print(f"✅ 완료: {success_count}/{len(patient_data_list)}명의 환자 데이터 삭제")
        print("=" * 80)
        
        # 삭제 확인
        print("\n🔍 삭제 확인 중...")
        remaining = find_patient_data(conn)
        
        if remaining is None or len(remaining) == 0:
            print("\n✅ 모든 '안광수' 환자 데이터가 완전히 삭제되었습니다!")
        else:
            print(f"\n⚠️  아직 {len(remaining)}명의 '안광수' 환자가 남아있습니다.")
        
        conn.close()
        
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
