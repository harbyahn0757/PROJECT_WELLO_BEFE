#!/usr/bin/env python3
"""
비밀번호 설정 여부와 환자 생년월일 확인 스크립트
"""
import asyncio
import asyncpg
from datetime import datetime

async def check_patient_data():
    """환자 데이터 확인"""
    db_config = {
        "host": "10.0.1.10",
        "port": "5432",
        "database": "p9_mkt_biz",
        "user": "peernine",
        "password": "autumn3334!"
    }
    
    try:
        conn = await asyncpg.connect(**db_config)
        
        # 최근 환자 데이터 조회 (비밀번호 설정 여부 포함)
        query = """
            SELECT 
                uuid,
                hospital_id,
                name,
                phone_number,
                birth_date,
                gender,
                password_hash IS NOT NULL as has_password,
                password_set_at,
                created_at,
                updated_at
            FROM welno.welno_patients
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT 20
        """
        
        rows = await conn.fetch(query)
        
        print("=" * 100)
        print("환자 데이터 확인 (최근 20명)")
        print("=" * 100)
        print(f"{'UUID':<38} {'병원ID':<15} {'이름':<10} {'전화번호':<15} {'생년월일':<12} {'비밀번호':<10} {'설정일시':<20}")
        print("-" * 100)
        
        for row in rows:
            uuid = row['uuid']
            hospital_id = row['hospital_id']
            name = row['name'] or '(없음)'
            phone = row['phone_number'] or '(없음)'
            birth_date = row['birth_date'].strftime('%Y-%m-%d') if row['birth_date'] else '(없음)'
            has_password = '✅' if row['has_password'] else '❌'
            password_set_at = row['password_set_at'].strftime('%Y-%m-%d %H:%M') if row['password_set_at'] else '(없음)'
            
            print(f"{uuid:<38} {hospital_id:<15} {name:<10} {phone:<15} {birth_date:<12} {has_password:<10} {password_set_at:<20}")
        
        print("\n" + "=" * 100)
        print("통계")
        print("=" * 100)
        
        # 전체 통계
        stats_query = """
            SELECT 
                COUNT(*) as total,
                COUNT(password_hash) as has_password_count,
                COUNT(birth_date) as has_birthday_count,
                COUNT(phone_number) as has_phone_count
            FROM welno.welno_patients
        """
        stats = await conn.fetchrow(stats_query)
        
        print(f"전체 환자 수: {stats['total']}")
        print(f"비밀번호 설정: {stats['has_password_count']}명 ({stats['has_password_count']/stats['total']*100:.1f}%)")
        print(f"생년월일 있음: {stats['has_birthday_count']}명 ({stats['has_birthday_count']/stats['total']*100:.1f}%)")
        print(f"전화번호 있음: {stats['has_phone_count']}명 ({stats['has_phone_count']/stats['total']*100:.1f}%)")
        
        # 최근 로그에서 확인한 UUID 확인
        print("\n" + "=" * 100)
        print("로그에서 확인한 UUID 확인 (36473377-9f8a-447e-aaef-261b10dd2d85)")
        print("=" * 100)
        
        specific_uuid = "36473377-9f8a-447e-aaef-261b10dd2d85"
        specific_query = """
            SELECT 
                uuid,
                hospital_id,
                name,
                phone_number,
                birth_date,
                gender,
                password_hash IS NOT NULL as has_password,
                password_set_at,
                password_attempts,
                password_locked_until,
                last_access_at,
                created_at,
                updated_at
            FROM welno.welno_patients
            WHERE uuid = $1
        """
        
        specific_rows = await conn.fetch(specific_query, specific_uuid)
        
        if specific_rows:
            for row in specific_rows:
                print(f"UUID: {row['uuid']}")
                print(f"병원ID: {row['hospital_id']}")
                print(f"이름: {row['name']}")
                print(f"전화번호: {row['phone_number'] or '(없음)'}")
                print(f"생년월일: {row['birth_date'].strftime('%Y-%m-%d') if row['birth_date'] else '(없음)'}")
                print(f"성별: {row['gender'] or '(없음)'}")
                print(f"비밀번호 설정: {'✅ 있음' if row['has_password'] else '❌ 없음'}")
                if row['password_set_at']:
                    print(f"비밀번호 설정일시: {row['password_set_at'].strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"비밀번호 시도 횟수: {row['password_attempts']}")
                if row['password_locked_until']:
                    print(f"비밀번호 잠금 해제: {row['password_locked_until'].strftime('%Y-%m-%d %H:%M:%S')}")
                if row['last_access_at']:
                    print(f"마지막 접근: {row['last_access_at'].strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"생성일시: {row['created_at'].strftime('%Y-%m-%d %H:%M:%S') if row['created_at'] else '(없음)'}")
                print(f"수정일시: {row['updated_at'].strftime('%Y-%m-%d %H:%M:%S') if row['updated_at'] else '(없음)'}")
        else:
            print(f"❌ UUID {specific_uuid}를 찾을 수 없습니다.")
        
        await conn.close()
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_patient_data())
