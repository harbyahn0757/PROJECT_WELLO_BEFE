#!/usr/bin/env python3
"""
김영상님 검진 데이터 수정 스크립트
최근 검진 데이터(2025년)의 키와 몸무게를 수정
"""
import asyncio
import asyncpg
import json

# 데이터베이스 설정
DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

# 환자 정보
PATIENT_UUID = "3a96200c-c61a-47b1-8539-27b73ef2f483"
HOSPITAL_ID = "KHW001"

# 수정할 값
NEW_HEIGHT = 185.00  # cm
NEW_WEIGHT = 90.00   # kg
NEW_BMI = round(90.00 / (1.85 ** 2), 1)  # 약 26.3

async def update_patient_data():
    """환자의 최근 검진 데이터 수정"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print(f"\n{'='*80}")
        print(f"🔍 [데이터 수정] 시작")
        print(f"  - UUID: {PATIENT_UUID}")
        print(f"  - Hospital: {HOSPITAL_ID}")
        print(f"  - 신장: {NEW_HEIGHT}cm")
        print(f"  - 체중: {NEW_WEIGHT}kg")
        print(f"  - BMI: {NEW_BMI}")
        print(f"{'='*80}\n")
        
        # 1. 최근 검진 데이터 조회 (2025년)
        query = """
            SELECT id, year, checkup_date, height, weight, bmi, raw_data
            FROM welno.welno_checkup_data 
            WHERE patient_uuid = $1 AND hospital_id = $2
            ORDER BY year DESC, checkup_date DESC
            LIMIT 1
        """
        
        row = await conn.fetchrow(query, PATIENT_UUID, HOSPITAL_ID)
        
        if not row:
            print(f"❌ [데이터 수정] 검진 데이터를 찾을 수 없습니다.")
            await conn.close()
            return
        
        checkup_id = row['id']
        current_height = row['height']
        current_weight = row['weight']
        current_bmi = row['bmi']
        raw_data = row['raw_data']
        
        print(f"📋 [데이터 수정] 현재 데이터:")
        print(f"  - ID: {checkup_id}")
        print(f"  - 년도: {row['year']}")
        print(f"  - 검진일: {row['checkup_date']}")
        print(f"  - 신장: {current_height}cm → {NEW_HEIGHT}cm")
        print(f"  - 체중: {current_weight}kg → {NEW_WEIGHT}kg")
        print(f"  - BMI: {current_bmi} → {NEW_BMI}\n")
        
        # 2. raw_data JSON 수정
        if isinstance(raw_data, str):
            raw_data = json.loads(raw_data)
        
        # raw_data 내부의 Inspections 배열 수정
        if 'Inspections' in raw_data:
            for inspection in raw_data['Inspections']:
                if 'Illnesses' in inspection:
                    for illness in inspection['Illnesses']:
                        if 'Items' in illness:
                            for item in illness['Items']:
                                name = item.get('Name', '')
                                if '신장' in name:
                                    item['Value'] = str(NEW_HEIGHT)
                                    print(f"✅ [raw_data] 신장 수정: {item.get('Value', 'N/A')} → {NEW_HEIGHT}")
                                elif '체중' in name:
                                    item['Value'] = str(NEW_WEIGHT)
                                    print(f"✅ [raw_data] 체중 수정: {item.get('Value', 'N/A')} → {NEW_WEIGHT}")
                                elif '체질량지수' in name:
                                    item['Value'] = str(NEW_BMI)
                                    print(f"✅ [raw_data] BMI 수정: {item.get('Value', 'N/A')} → {NEW_BMI}")
        
        # ResultList가 있는 경우 (최상위 레벨)
        if 'ResultList' in raw_data:
            for result in raw_data['ResultList']:
                if 'Inspections' in result:
                    for inspection in result['Inspections']:
                        if 'Illnesses' in inspection:
                            for illness in inspection['Illnesses']:
                                if 'Items' in illness:
                                    for item in illness['Items']:
                                        name = item.get('Name', '')
                                        if '신장' in name:
                                            item['Value'] = str(NEW_HEIGHT)
                                        elif '체중' in name:
                                            item['Value'] = str(NEW_WEIGHT)
                                        elif '체질량지수' in name:
                                            item['Value'] = str(NEW_BMI)
        
        # 3. 데이터베이스 업데이트
        update_query = """
            UPDATE welno.welno_checkup_data
            SET 
                height = $1,
                weight = $2,
                bmi = $3,
                raw_data = $4,
                updated_at = NOW()
            WHERE id = $5
        """
        
        await conn.execute(
            update_query,
            NEW_HEIGHT,
            NEW_WEIGHT,
            NEW_BMI,
            json.dumps(raw_data, ensure_ascii=False),
            checkup_id
        )
        
        print(f"\n✅ [데이터 수정] 완료!")
        print(f"  - 검진 데이터 ID: {checkup_id}")
        print(f"  - 신장: {current_height}cm → {NEW_HEIGHT}cm")
        print(f"  - 체중: {current_weight}kg → {NEW_WEIGHT}kg")
        print(f"  - BMI: {current_bmi} → {NEW_BMI}")
        print(f"  - raw_data JSON도 함께 수정됨\n")
        
        await conn.close()
        
    except Exception as e:
        print(f"❌ [데이터 수정] 오류: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(update_patient_data())


