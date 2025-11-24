#!/usr/bin/env python3
"""
테스트 인원 생성 계획 확인 스크립트
기존 환자 전화번호로 새 사용자 생성 가능 여부 확인
"""
import asyncio
import asyncpg
from datetime import datetime

# 데이터베이스 설정
DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

# 기존 환자 정보 (김영상님)
EXISTING_PATIENT = {
    "uuid": "3a96200c-c61a-47b1-8539-27b73ef2f483",
    "hospital_id": "KHW001",
    "name": "김영상",
    "phone": None  # 조회해서 확인
}

async def check_existing_patients():
    """기존 환자 정보 조회"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        # 기존 환자 조회
        query = """
            SELECT uuid, hospital_id, name, phone_number, birth_date, gender
            FROM wello.wello_patients
            ORDER BY created_at DESC
            LIMIT 10
        """
        
        rows = await conn.fetch(query)
        
        print("\n" + "="*80)
        print("📋 기존 환자 정보")
        print("="*80)
        
        existing_patients = []
        for row in rows:
            patient_info = {
                "uuid": row['uuid'],
                "hospital_id": row['hospital_id'],
                "name": row['name'],
                "phone": row['phone_number'],
                "birth_date": str(row['birth_date']) if row['birth_date'] else None,
                "gender": row['gender']
            }
            existing_patients.append(patient_info)
            print(f"  - {row['name']}: {row['phone_number']} (UUID: {row['uuid'][:8]}..., Hospital: {row['hospital_id']})")
        
        await conn.close()
        return existing_patients
        
    except Exception as e:
        print(f"❌ [조회 오류] {e}")
        return []

async def check_phone_availability(phone_number: str):
    """전화번호 사용 가능 여부 확인"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        query = """
            SELECT COUNT(*) as count
            FROM wello.wello_patients
            WHERE phone_number = $1
        """
        
        count = await conn.fetchval(query, phone_number)
        await conn.close()
        
        return count == 0
        
    except Exception as e:
        print(f"❌ [전화번호 확인 오류] {e}")
        return False

async def generate_test_users_plan():
    """테스트 인원 생성 계획 수립"""
    try:
        # 기존 환자 정보 조회
        existing_patients = await check_existing_patients()
        
        # 김영상님 정보 찾기
        kim_young_sang = None
        for patient in existing_patients:
            if patient['uuid'] == EXISTING_PATIENT['uuid']:
                kim_young_sang = patient
                break
        
        if not kim_young_sang:
            print("❌ 김영상님 정보를 찾을 수 없습니다.")
            return
        
        base_phone = kim_young_sang['phone']
        base_birth_date = kim_young_sang['birth_date']
        base_gender = kim_young_sang['gender']
        base_hospital = kim_young_sang['hospital_id']
        
        print("\n" + "="*80)
        print("📋 테스트 인원 생성 계획")
        print("="*80)
        print(f"\n기준 정보:")
        print(f"  - 기준 전화번호: {base_phone}")
        print(f"  - 기준 생년월일: {base_birth_date}")
        print(f"  - 기준 성별: {base_gender}")
        print(f"  - 기준 병원: {base_hospital}")
        
        # 테스트 인원 계획
        test_users = []
        
        print("\n" + "="*80)
        print("📊 테스트 인원 생성 계획표")
        print("="*80)
        print(f"\n{'번호':<6} {'이름':<10} {'전화번호':<15} {'UUID 생성':<15} {'병원ID':<10} {'생성방법':<20} {'접속 URL (개발)':<60}")
        print("-" * 140)
        
        for i in range(1, 6):
            test_name = f"테스트{i}"
            
            # 전화번호 생성 방법: 마지막 4자리 변경
            if base_phone:
                phone_prefix = base_phone[:-4]
                phone_suffix = str(int(base_phone[-4:]) + i).zfill(4)
                test_phone = phone_prefix + phone_suffix
            else:
                test_phone = f"0100000{i:04d}"
            
            # UUID는 자동 생성 (데이터베이스에서)
            # Hospital ID는 동일하게 사용
            test_hospital = base_hospital
            
            # 접속 URL
            dev_url = f"http://127.0.0.1:9283/wello?uuid={{UUID}}&hospital={test_hospital}"
            prod_url = f"https://xogxog.com/wello?uuid={{UUID}}&hospital={test_hospital}"
            
            # 전화번호 사용 가능 여부 확인
            is_available = await check_phone_availability(test_phone)
            availability = "✅ 가능" if is_available else "⚠️ 중복"
            
            test_users.append({
                "name": test_name,
                "phone": test_phone,
                "hospital": test_hospital,
                "available": is_available,
                "dev_url": dev_url,
                "prod_url": prod_url
            })
            
            print(f"{i:<6} {test_name:<10} {test_phone:<15} {'자동생성':<15} {test_hospital:<10} {availability:<20} {dev_url:<60}")
        
        print("\n" + "="*80)
        print("📋 상세 생성 계획")
        print("="*80)
        
        print("\n### 생성 방법")
        print("1. **기존 전화번호 기반 생성**: 마지막 4자리를 순차적으로 변경")
        print("2. **UUID**: 데이터베이스 INSERT 시 자동 생성 (UUID v4)")
        print("3. **병원 ID**: 기존과 동일하게 사용")
        print("4. **생년월일/성별**: 기존과 동일하게 사용")
        
        print("\n### SQL 생성 예시")
        print("```sql")
        print("-- 테스트1 생성 예시")
        print(f"INSERT INTO wello.wello_patients (uuid, hospital_id, name, phone_number, birth_date, gender)")
        print(f"VALUES (")
        print(f"    gen_random_uuid()::text,  -- UUID 자동 생성")
        print(f"    '{base_hospital}',")
        print(f"    '테스트1',")
        print(f"    '{test_users[0]['phone']}',")
        print(f"    '{base_birth_date}',")
        print(f"    '{base_gender}'")
        print(f");")
        print("```")
        
        print("\n" + "="*80)
        print("🌐 접속 정보 (실서버 기준)")
        print("="*80)
        print(f"\n{'번호':<6} {'이름':<10} {'개발 서버':<60} {'실서버':<60}")
        print("-" * 140)
        
        for i, user in enumerate(test_users, 1):
            print(f"{i:<6} {user['name']:<10} {user['dev_url']:<60} {user['prod_url']:<60}")
        
        print("\n" + "="*80)
        print("⚠️ 주의사항")
        print("="*80)
        print("1. UUID는 실제 생성 후 URL에 입력해야 함")
        print("2. 전화번호 중복 확인 필요")
        print("3. 실제 생성 전 백업 권장")
        print("4. 테스트 완료 후 삭제 계획 수립 필요")
        
        return test_users
        
    except Exception as e:
        print(f"❌ [계획 수립 오류] {e}")
        import traceback
        traceback.print_exc()
        return []

if __name__ == "__main__":
    asyncio.run(generate_test_users_plan())


