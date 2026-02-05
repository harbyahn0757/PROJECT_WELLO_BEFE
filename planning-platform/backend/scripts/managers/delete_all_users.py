"""
전체 유저 삭제 스크립트

모든 웰노/파트너사 유저와 관련 데이터를 삭제합니다.
주의: 이 작업은 되돌릴 수 없습니다!
"""
import asyncio
import asyncpg
import os
import sys
from dotenv import load_dotenv

# .env.local 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    load_dotenv(env_path)

async def delete_all_users():
    """모든 유저 삭제"""
    
    # DB 연결 설정
    db_config = {
        'host': os.getenv('DB_HOST', '10.0.1.10'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'p9_mkt_biz'),
        'user': os.getenv('DB_USER', 'peernine'),
        'password': os.getenv('DB_PASSWORD', 'autumn3334!')
    }
    
    print("=" * 80)
    print("⚠️  경고: 모든 유저 데이터를 삭제합니다!")
    print("=" * 80)
    print()
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        # 1. 현재 유저 수 확인
        print("1️⃣ 현재 유저 수 확인")
        print("-" * 80)
        
        total_count = await conn.fetchval("""
            SELECT COUNT(*) FROM welno.welno_patients
        """)
        
        welno_count = await conn.fetchval("""
            SELECT COUNT(*) FROM welno.welno_patients
            WHERE registration_source IS NULL OR registration_source = 'DIRECT'
        """)
        
        partner_count = await conn.fetchval("""
            SELECT COUNT(*) FROM welno.welno_patients
            WHERE registration_source = 'PARTNER'
        """)
        
        print(f"전체 유저: {total_count}명")
        print(f"  - 웰노 유저: {welno_count}명")
        print(f"  - 파트너사 유저: {partner_count}명")
        print()
        
        if total_count == 0:
            print("✅ 삭제할 유저가 없습니다.")
            return
        
        # 2. 모든 유저 UUID 조회
        print("2️⃣ 삭제할 유저 목록 조회")
        print("-" * 80)
        
        all_users = await conn.fetch("""
            SELECT uuid, hospital_id, name, registration_source, partner_id
            FROM welno.welno_patients
            ORDER BY created_at DESC
        """)
        
        print(f"총 {len(all_users)}명의 유저를 삭제합니다:")
        for idx, user in enumerate(all_users, 1):
            user_type = '웰노' if (user['registration_source'] is None or user['registration_source'] == 'DIRECT') else '파트너사'
            print(f"  {idx}. [{user_type}] {user['name']} (UUID: {user['uuid']}, Hospital: {user['hospital_id']})")
        print()
        
        # 3. 삭제 실행
        print("3️⃣ 삭제 실행")
        print("-" * 80)
        
        deleted_count = 0
        error_count = 0
        
        for user in all_users:
            uuid = user['uuid']
            hospital_id = user['hospital_id']
            
            try:
                # 관련 데이터 삭제 (외래키 제약 때문에 순서 중요)
                
                # 1. welno_checkup_data
                checkup_deleted = await conn.execute("""
                    DELETE FROM welno.welno_checkup_data
                    WHERE patient_uuid = $1 AND hospital_id = $2
                """, uuid, hospital_id)
                
                # 2. welno_prescription_data
                prescription_deleted = await conn.execute("""
                    DELETE FROM welno.welno_prescription_data
                    WHERE patient_uuid = $1 AND hospital_id = $2
                """, uuid, hospital_id)
                
                # 3. tb_campaign_payments
                payment_deleted = await conn.execute("""
                    DELETE FROM welno.tb_campaign_payments
                    WHERE uuid = $1
                """, uuid)
                
                # 4. welno_patients (마지막)
                patient_result = await conn.execute("""
                    DELETE FROM welno.welno_patients
                    WHERE uuid = $1 AND hospital_id = $2
                """, uuid, hospital_id)
                
                if patient_result == "DELETE 1":
                    deleted_count += 1
                    print(f"✅ 삭제 완료: {user['name']} (UUID: {uuid})")
                else:
                    error_count += 1
                    print(f"⚠️  삭제 실패: {user['name']} (UUID: {uuid}) - 이미 삭제되었거나 존재하지 않음")
                    
            except Exception as e:
                error_count += 1
                print(f"❌ 삭제 오류: {user['name']} (UUID: {uuid}), Error: {e}")
        
        print()
        
        # 4. 최종 확인
        print("4️⃣ 최종 확인")
        print("-" * 80)
        
        remaining_count = await conn.fetchval("""
            SELECT COUNT(*) FROM welno.welno_patients
        """)
        
        print(f"삭제 완료: {deleted_count}명")
        if error_count > 0:
            print(f"삭제 실패: {error_count}명")
        print(f"남은 유저: {remaining_count}명")
        print()
        
        if remaining_count == 0:
            print("=" * 80)
            print("✅ 모든 유저 삭제 완료!")
            print("=" * 80)
        else:
            print("=" * 80)
            print(f"⚠️  {remaining_count}명의 유저가 남아있습니다.")
            print("=" * 80)
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()


if __name__ == "__main__":
    print("⚠️  경고: 이 스크립트는 모든 유저 데이터를 삭제합니다!")
    print("⚠️  이 작업은 되돌릴 수 없습니다!")
    print()
    print("계속하시겠습니까? (yes/no): ", end='')
    
    # 자동 실행을 위해 yes로 설정 (사용자가 요청했으므로)
    response = 'yes'
    
    if response.lower() in ['yes', 'y']:
        asyncio.run(delete_all_users())
    else:
        print("취소되었습니다.")
