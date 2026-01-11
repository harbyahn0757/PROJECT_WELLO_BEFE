#!/usr/bin/env python3
"""
백엔드 DB에 처방전 데이터(약국/병원) 확인 스크립트
"""
import asyncio
import asyncpg
import json
import sys
import os

# 프로젝트 루트를 Python 경로에 추가
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

# 데이터베이스 설정
DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

# 확인할 환자 정보 (URL 파라미터에서 가져오거나 기본값 사용)
UUID = sys.argv[1] if len(sys.argv) > 1 else "49cc4185-1512-44fb-a513-faab0f663663"
HOSPITAL_ID = sys.argv[2] if len(sys.argv) > 2 else "PEERNINE"

async def check_prescription_data():
    """처방전 데이터 확인 (약국/병원 구분)"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("\n" + "="*100)
        print("💊 백엔드 DB 처방전 데이터 확인")
        print("="*100)
        print(f"\n👤 환자 정보:")
        print(f"   - UUID: {UUID}")
        print(f"   - Hospital ID: {HOSPITAL_ID}")
        
        # 1. 환자 정보 확인
        patient_query = """
            SELECT id, uuid, hospital_id, name, phone_number, birth_date, gender,
                   has_health_data, has_prescription_data, last_data_update
            FROM welno.welno_patients
            WHERE uuid = $1 AND hospital_id = $2
        """
        patient_row = await conn.fetchrow(patient_query, UUID, HOSPITAL_ID)
        
        if not patient_row:
            print(f"\n❌ 환자 정보를 찾을 수 없습니다.")
            await conn.close()
            return
        
        print(f"\n✅ 환자 정보:")
        print(f"   - ID: {patient_row['id']}")
        print(f"   - 이름: {patient_row['name']}")
        print(f"   - 전화번호: {patient_row['phone_number']}")
        print(f"   - has_health_data: {patient_row['has_health_data']}")
        print(f"   - has_prescription_data: {patient_row['has_prescription_data']}")
        print(f"   - last_data_update: {patient_row['last_data_update']}")
        
        # 2. 처방전 데이터 개수 확인
        prescription_count_query = """
            SELECT COUNT(*) as count
            FROM welno.welno_prescription_data
            WHERE patient_uuid = $1 AND hospital_id = $2
        """
        prescription_count = await conn.fetchval(prescription_count_query, UUID, HOSPITAL_ID)
        
        print(f"\n" + "="*100)
        print(f"📊 처방전 데이터 현황")
        print("="*100)
        print(f"\n   - 전체 건수: {prescription_count}건")
        
        if prescription_count == 0:
            print(f"\n⚠️ 처방전 데이터가 없습니다.")
            await conn.close()
            return
        
        # 3. 처방전 데이터 상세 확인 (약국/병원 구분)
        prescription_query = """
            SELECT 
                id, patient_uuid, hospital_id,
                hospital_name, address, treatment_date, treatment_type,
                visit_count, prescription_count, medication_count, detail_records_count,
                raw_data, collected_at, created_at
            FROM welno.welno_prescription_data
            WHERE patient_uuid = $1 AND hospital_id = $2
            ORDER BY treatment_date DESC
        """
        prescription_rows = await conn.fetch(prescription_query, UUID, HOSPITAL_ID)
        
        # 약국/병원 구분 통계
        pharmacy_count = 0
        hospital_count = 0
        pharmacy_data = []
        hospital_data = []
        
        print(f"\n" + "="*100)
        print(f"📋 처방전 데이터 상세 (약국/병원 구분)")
        print("="*100)
        
        for i, row in enumerate(prescription_rows, 1):
            treatment_type = row['treatment_type'] or ''
            hospital_name = row['hospital_name'] or ''
            is_pharmacy = treatment_type == '처방조제' or '약국' in hospital_name
            
            if is_pharmacy:
                pharmacy_count += 1
                pharmacy_data.append(row)
            else:
                hospital_count += 1
                hospital_data.append(row)
            
            print(f"\n  [{i}] ID: {row['id']}")
            print(f"      병원/약국명: {hospital_name}")
            print(f"      주소: {row['address'] or 'N/A'}")
            print(f"      진료일: {row['treatment_date']}")
            print(f"      진료형태: {treatment_type}")
            print(f"      구분: {'약국' if is_pharmacy else '병원'}")
            print(f"      방문횟수: {row['visit_count']}")
            print(f"      처방횟수: {row['prescription_count']}")
            print(f"      투약횟수: {row['medication_count']}")
            print(f"      상세기록수: {row['detail_records_count']}")
            
            # raw_data에서 Tilko 원본 필드 확인
            if row['raw_data']:
                raw_data = row['raw_data'] if isinstance(row['raw_data'], dict) else json.loads(row['raw_data'])
                print(f"      Tilko 원본 필드:")
                print(f"        - JinRyoHyungTae: {raw_data.get('JinRyoHyungTae', 'N/A')}")
                print(f"        - ByungEuiwonYakGukMyung: {raw_data.get('ByungEuiwonYakGukMyung', 'N/A')}")
                print(f"        - JinRyoGaesiIl: {raw_data.get('JinRyoGaesiIl', 'N/A')}")
                print(f"        - TreatDate: {raw_data.get('TreatDate', 'N/A')}")
                print(f"        - Year: {raw_data.get('Year', 'N/A')}")
        
        # 4. 통계 요약
        print(f"\n" + "="*100)
        print(f"📊 통계 요약")
        print("="*100)
        print(f"\n   - 전체: {prescription_count}건")
        print(f"   - 약국: {pharmacy_count}건")
        print(f"   - 병원: {hospital_count}건")
        
        # 5. API 응답 구조 확인 (get_patient_health_data와 동일)
        print(f"\n" + "="*100)
        print(f"🔍 API 응답 구조 확인 (get_patient_health_data)")
        print("="*100)
        
        # Decimal 변환 헬퍼
        from decimal import Decimal
        from datetime import datetime, date
        
        def convert(obj):
            if isinstance(obj, Decimal): 
                return float(obj)
            if isinstance(obj, (datetime, date)): 
                return obj.isoformat()
            if isinstance(obj, dict): 
                return {k: convert(v) for k, v in obj.items()}
            if isinstance(obj, list): 
                return [convert(i) for i in obj]
            return obj
        
        converted_prescriptions = []
        for row in prescription_rows:
            converted = convert({
                **dict(row),
                "raw_data": json.loads(row['raw_data']) if row['raw_data'] and isinstance(row['raw_data'], str) else row['raw_data']
            })
            converted_prescriptions.append(converted)
        
        if len(converted_prescriptions) > 0:
            first_prescription = converted_prescriptions[0]
            print(f"\n첫 번째 처방전 데이터 구조:")
            print(f"   - 전체 키: {list(first_prescription.keys())}")
            print(f"   - hospital_name: {first_prescription.get('hospital_name')} (존재: {first_prescription.get('hospital_name') is not None})")
            print(f"   - treatment_type: {first_prescription.get('treatment_type')} (존재: {first_prescription.get('treatment_type') is not None})")
            print(f"   - treatment_date: {first_prescription.get('treatment_date')} (존재: {first_prescription.get('treatment_date') is not None})")
            print(f"   - visit_count: {first_prescription.get('visit_count')} (존재: {first_prescription.get('visit_count') is not None})")
            print(f"   - raw_data 존재: {first_prescription.get('raw_data') is not None}")
            if first_prescription.get('raw_data'):
                raw_data = first_prescription['raw_data']
                print(f"   - raw_data.JinRyoHyungTae: {raw_data.get('JinRyoHyungTae')} (존재: {raw_data.get('JinRyoHyungTae') is not None})")
                print(f"   - raw_data.ByungEuiwonYakGukMyung: {raw_data.get('ByungEuiwonYakGukMyung')} (존재: {raw_data.get('ByungEuiwonYakGukMyung') is not None})")
                print(f"   - raw_data.JinRyoGaesiIl: {raw_data.get('JinRyoGaesiIl')} (존재: {raw_data.get('JinRyoGaesiIl') is not None})")
        
        await conn.close()
        
        print(f"\n" + "="*100)
        print(f"✅ 확인 완료")
        print("="*100)
        
    except Exception as e:
        print(f"\n❌ [오류] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_prescription_data())
