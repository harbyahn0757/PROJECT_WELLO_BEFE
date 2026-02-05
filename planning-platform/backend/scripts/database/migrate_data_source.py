"""
데이터 출처(data_source) 마이그레이션 스크립트

기존 data_source가 NULL인 데이터를 'tilko'로 일괄 업데이트합니다.
(data_source 컬럼이 추가되기 전의 데이터는 모두 Tilko 인증을 통해 수집되었다고 가정)
"""

import psycopg2
from datetime import datetime

# DB 설정
DB_CONFIG = {
    'host': '10.0.1.10',
    'port': 5432,
    'database': 'p9_mkt_biz',
    'user': 'peernine',
    'password': 'autumn3334!'
}

def migrate_data_source():
    """data_source NULL 데이터를 'tilko'로 마이그레이션"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        print(f"[{datetime.now()}] 데이터 출처 마이그레이션 시작...")
        
        # 1. welno_patients 테이블 마이그레이션
        print("\n=== welno_patients 마이그레이션 ===")
        
        # data_source 컬럼 존재 확인
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'welno' 
              AND table_name = 'welno_patients' 
              AND column_name = 'data_source'
        """)
        
        if cur.fetchone():
            cur.execute("""
                UPDATE welno.welno_patients 
                SET data_source = 'tilko' 
                WHERE data_source IS NULL
            """)
            patients_count = cur.rowcount
            print(f"✅ welno_patients: {patients_count}건 업데이트")
        else:
            print("⚠️  welno_patients.data_source 컬럼이 아직 없습니다. (스키마 마이그레이션 필요)")
        
        # 2. welno_checkup_data 테이블 마이그레이션
        print("\n=== welno_checkup_data 마이그레이션 ===")
        
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'welno' 
              AND table_name = 'welno_checkup_data' 
              AND column_name = 'data_source'
        """)
        
        if cur.fetchone():
            cur.execute("""
                UPDATE welno.welno_checkup_data 
                SET data_source = 'tilko' 
                WHERE data_source IS NULL
            """)
            checkup_count = cur.rowcount
            print(f"✅ welno_checkup_data: {checkup_count}건 업데이트")
        else:
            print("⚠️  welno_checkup_data.data_source 컬럼이 아직 없습니다. (스키마 마이그레이션 필요)")
        
        # 3. welno_prescription_data 테이블 마이그레이션
        print("\n=== welno_prescription_data 마이그레이션 ===")
        
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'welno' 
              AND table_name = 'welno_prescription_data' 
              AND column_name = 'data_source'
        """)
        
        if cur.fetchone():
            cur.execute("""
                UPDATE welno.welno_prescription_data 
                SET data_source = 'tilko' 
                WHERE data_source IS NULL
            """)
            prescription_count = cur.rowcount
            print(f"✅ welno_prescription_data: {prescription_count}건 업데이트")
        else:
            print("⚠️  welno_prescription_data.data_source 컬럼이 아직 없습니다. (스키마 마이그레이션 필요)")
        
        conn.commit()
        
        # 검증
        print("\n=== 마이그레이션 검증 ===")
        
        # welno_patients 검증
        cur.execute("""
            SELECT data_source, COUNT(*) 
            FROM welno.welno_patients 
            WHERE data_source IS NOT NULL
            GROUP BY data_source
        """)
        
        if cur.description:  # 컬럼이 있는 경우에만
            rows = cur.fetchall()
            if rows:
                print("welno_patients 데이터 출처별 건수:")
                for row in rows:
                    print(f"  - {row[0]}: {row[1]}건")
        
        # welno_checkup_data 검증
        cur.execute("""
            SELECT data_source, COUNT(*) 
            FROM welno.welno_checkup_data 
            WHERE data_source IS NOT NULL
            GROUP BY data_source
        """)
        
        if cur.description:
            rows = cur.fetchall()
            if rows:
                print("\nwelno_checkup_data 데이터 출처별 건수:")
                for row in rows:
                    print(f"  - {row[0]}: {row[1]}건")
        
        print(f"\n[{datetime.now()}] 마이그레이션 완료!")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    migrate_data_source()
