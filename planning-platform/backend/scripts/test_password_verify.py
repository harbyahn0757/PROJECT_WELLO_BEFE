#!/usr/bin/env python3
"""
비밀번호 088110으로 실제 verify API 테스트
"""
import asyncio
import asyncpg
import bcrypt
import requests
import json

async def test_password_verify_db():
    """DB에서 직접 비밀번호 확인"""
    db_config = {
        "host": "10.0.1.10",
        "port": "5432",
        "database": "p9_mkt_biz",
        "user": "peernine",
        "password": "autumn3334!"
    }
    
    uuid = "36473377-9f8a-447e-aaef-261b10dd2d85"
    hospital_id = "PEERNINE"
    test_password = "088110"
    
    try:
        conn = await asyncpg.connect(**db_config)
        
        # 비밀번호 해시 조회
        query = """
            SELECT password_hash, password_attempts, password_locked_until
            FROM welno.welno_patients 
            WHERE uuid = $1 AND hospital_id = $2
        """
        
        row = await conn.fetchrow(query, uuid, hospital_id)
        
        if not row:
            print(f"❌ 환자를 찾을 수 없습니다: {uuid}, {hospital_id}")
            await conn.close()
            return
        
        if not row['password_hash']:
            print(f"❌ 비밀번호가 설정되지 않았습니다.")
            await conn.close()
            return
        
        print(f"✅ 비밀번호 해시 발견")
        print(f"   시도 횟수: {row['password_attempts']}")
        if row['password_locked_until']:
            print(f"   잠금 해제 시간: {row['password_locked_until']}")
        
        # 비밀번호 확인
        stored_hash = row['password_hash'].encode('utf-8')
        is_valid = bcrypt.checkpw(test_password.encode('utf-8'), stored_hash)
        
        if is_valid:
            print(f"✅ 비밀번호 확인 성공: {test_password}")
        else:
            print(f"❌ 비밀번호 확인 실패: {test_password}")
        
        await conn.close()
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()

def test_password_verify_api():
    """실제 API 호출 테스트"""
    uuid = "36473377-9f8a-447e-aaef-261b10dd2d85"
    hospital_id = "PEERNINE"
    test_password = "088110"
    
    url = f"http://localhost:8082/welno-api/v1/patients/{uuid}/password/verify?hospital_id={hospital_id}"
    
    payload = {
        "password": test_password
    }
    
    print(f"\n{'='*80}")
    print("API 호출 테스트")
    print(f"{'='*80}")
    print(f"URL: {url}")
    print(f"Method: POST")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print(f"{'='*80}\n")
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        
        print(f"응답 상태 코드: {response.status_code}")
        print(f"응답 헤더: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ API 호출 성공:")
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(f"❌ API 호출 실패:")
            print(f"응답 본문: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ 요청 오류: {e}")
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("="*80)
    print("비밀번호 088110 검증 테스트")
    print("="*80)
    
    # DB 직접 확인
    print("\n1. DB에서 직접 확인")
    print("-"*80)
    asyncio.run(test_password_verify_db())
    
    # API 호출 테스트
    print("\n2. API 호출 테스트")
    print("-"*80)
    test_password_verify_api()
