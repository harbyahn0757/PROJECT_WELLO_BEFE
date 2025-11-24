#!/usr/bin/env python3
"""
테스트 인원 생성 계획 수립 스크립트
기존 환자 전화번호 기반으로 테스트 인원 5명 생성 계획
"""
import asyncio
import asyncpg
from datetime import datetime, date
import uuid

# 데이터베이스 설정
DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

async def get_existing_patients():
    """기존 환자 정보 조회"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        query = """
            SELECT uuid, hospital_id, name, phone_number, birth_date, gender
            FROM wello.wello_patients
            WHERE phone_number IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 5
        """
        
        rows = await conn.fetch(query)
        await conn.close()
        
        return [dict(row) for row in rows]
        
    except Exception as e:
        print(f"❌ [조회 오류] {e}")
        return []

async def check_phone_availability(phone: str):
    """전화번호 사용 가능 여부 확인"""
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        count = await conn.fetchval(
            "SELECT COUNT(*) FROM wello.wello_patients WHERE phone_number = $1",
            phone
        )
        await conn.close()
        return count == 0
    except:
        return False

async def generate_plan():
    """테스트 인원 생성 계획 수립"""
    existing = await get_existing_patients()
    
    # 기준 환자 찾기 (전화번호가 있는 경우)
    base_patient = None
    if existing:
        # 전화번호가 있는 환자 중 첫 번째
        for p in existing:
            if p.get('phone_number'):
                base_patient = p
                break
    
    if not base_patient:
        # 기본값 사용
        base_patient = {
            'phone_number': '010-1234-5678',
            'birth_date': date(1981, 9, 27),
            'gender': 'M',
            'hospital_id': 'KHW001'
        }
    
    base_phone = base_patient['phone_number']
    base_birth = base_patient['birth_date']
    base_gender = base_patient['gender']
    base_hospital = base_patient.get('hospital_id', 'KHW001')
    
    # 전화번호에서 숫자만 추출
    phone_digits = ''.join(filter(str.isdigit, base_phone))
    
    print("\n" + "="*100)
    print("📊 테스트 인원 생성 계획표")
    print("="*100)
    print(f"\n기준 정보:")
    print(f"  - 기준 전화번호: {base_phone}")
    print(f"  - 기준 생년월일: {base_birth}")
    print(f"  - 기준 성별: {base_gender}")
    print(f"  - 기준 병원: {base_hospital}")
    
    print(f"\n{'번호':<6} {'이름':<10} {'전화번호':<15} {'생년월일':<12} {'성별':<6} {'병원ID':<10} {'UUID':<38} {'전화번호 사용가능':<15}")
    print("-" * 120)
    
    test_users = []
    for i in range(1, 6):
        test_name = f"테스트{i}"
        
        # 전화번호 생성: 마지막 4자리 변경
        if len(phone_digits) >= 4:
            prefix = phone_digits[:-4]
            suffix = str(int(phone_digits[-4:]) + i).zfill(4)
            test_phone = f"{prefix[:3]}-{prefix[3:7]}-{suffix}" if len(phone_digits) == 11 else f"{prefix}-{suffix}"
        else:
            test_phone = f"010-0000-{i:04d}"
        
        # 숫자만 추출해서 중복 확인
        test_phone_digits = ''.join(filter(str.isdigit, test_phone))
        is_available = await check_phone_availability(test_phone_digits)
        
        # UUID 생성 (예시용)
        test_uuid = str(uuid.uuid4())
        
        test_users.append({
            'name': test_name,
            'phone': test_phone,
            'phone_digits': test_phone_digits,
            'birth_date': base_birth,
            'gender': base_gender,
            'hospital': base_hospital,
            'uuid': test_uuid,
            'available': is_available
        })
        
        status = "✅ 가능" if is_available else "⚠️ 중복"
        print(f"{i:<6} {test_name:<10} {test_phone:<15} {str(base_birth):<12} {base_gender:<6} {base_hospital:<10} {test_uuid:<38} {status:<15}")
    
    print("\n" + "="*100)
    print("🌐 접속 정보 (개발 서버)")
    print("="*100)
    print(f"\n{'번호':<6} {'이름':<10} {'접속 URL':<80}")
    print("-" * 100)
    for i, user in enumerate(test_users, 1):
        dev_url = f"http://127.0.0.1:9283/wello?uuid={user['uuid']}&hospital={user['hospital']}"
        print(f"{i:<6} {user['name']:<10} {dev_url:<80}")
    
    print("\n" + "="*100)
    print("🌐 접속 정보 (실서버)")
    print("="*100)
    print(f"\n{'번호':<6} {'이름':<10} {'접속 URL':<80}")
    print("-" * 100)
    for i, user in enumerate(test_users, 1):
        prod_url = f"https://xogxog.com/wello?uuid={user['uuid']}&hospital={user['hospital']}"
        print(f"{i:<6} {user['name']:<10} {prod_url:<80}")
    
    print("\n" + "="*100)
    print("📝 SQL 생성 스크립트")
    print("="*100)
    print("\n```sql")
    print("-- 테스트 인원 생성 SQL")
    for i, user in enumerate(test_users, 1):
        print(f"\n-- {user['name']} 생성")
        print(f"INSERT INTO wello.wello_patients (uuid, hospital_id, name, phone_number, birth_date, gender)")
        print(f"VALUES (")
        print(f"    '{user['uuid']}',")
        print(f"    '{user['hospital']}',")
        print(f"    '{user['name']}',")
        print(f"    '{user['phone_digits']}',")
        print(f"    '{user['birth_date']}',")
        print(f"    '{user['gender']}'")
        print(f");")
    print("```")
    
    print("\n" + "="*100)
    print("⚠️ 주의사항")
    print("="*100)
    print("1. UUID는 실제 생성 후 URL에 입력해야 함")
    print("2. 전화번호 중복 확인 완료 (표 참조)")
    print("3. 실제 생성 전 데이터베이스 백업 권장")
    print("4. 테스트 완료 후 삭제 계획 수립 필요")
    print("5. 전화번호는 숫자만 저장됨 (하이픈 제거)")
    
    return test_users

if __name__ == "__main__":
    asyncio.run(generate_plan())

