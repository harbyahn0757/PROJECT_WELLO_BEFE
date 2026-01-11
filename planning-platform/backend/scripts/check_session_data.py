#!/usr/bin/env python3
"""
세션 데이터 확인 스크립트
"""
import asyncio
import asyncpg
import json
import os
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# 데이터베이스 설정
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "10.0.1.10"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "database": os.getenv("DB_NAME", "p9_mkt_biz"),
    "user": os.getenv("DB_USER", "peernine"),
    "password": os.getenv("DB_PASSWORD", "autumn3334!")
}

# 확인할 세션 ID
SESSION_ID = "41e73c9a-d4ab-49aa-ae04-290f84ab40e4"

async def check_session_data():
    """세션 데이터 확인"""
    try:
        from app.data.redis_session_manager import redis_session_manager as session_manager
        
        print("\n" + "="*100)
        print("🔍 세션 데이터 확인")
        print("="*100)
        print(f"\n세션 ID: {SESSION_ID}")
        print()
        
        # 세션 데이터 가져오기
        session_data = session_manager.get_session(SESSION_ID)
        
        if not session_data:
            print("❌ 세션을 찾을 수 없습니다.")
            return
        
        print("📋 세션 기본 정보:")
        print(f"   - 상태: {session_data.get('status', 'N/A')}")
        print(f"   - 생성 시간: {session_data.get('created_at', 'N/A')}")
        print(f"   - 업데이트 시간: {session_data.get('updated_at', 'N/A')}")
        print()
        
        # 건강검진 데이터 확인
        health_data = session_data.get("health_data")
        print("🏥 건강검진 데이터:")
        if health_data:
            print(f"   - 존재: ✅")
            print(f"   - 타입: {type(health_data)}")
            if isinstance(health_data, dict):
                print(f"   - Status: {health_data.get('Status', 'N/A')}")
                result_list = health_data.get("ResultList")
                if result_list is None:
                    print(f"   - ResultList: None")
                elif isinstance(result_list, list):
                    print(f"   - ResultList 길이: {len(result_list)}건")
                    if len(result_list) > 0:
                        print(f"   - 첫 번째 항목 키: {list(result_list[0].keys())[:10] if result_list[0] else 'N/A'}")
                else:
                    print(f"   - ResultList 타입: {type(result_list)}")
                print(f"   - 전체 키: {list(health_data.keys())}")
            else:
                print(f"   - 값: {health_data}")
        else:
            print(f"   - 존재: ❌ (None 또는 없음)")
        print()
        
        # 처방전 데이터 확인
        prescription_data = session_data.get("prescription_data")
        print("💊 처방전 데이터:")
        if prescription_data:
            print(f"   - 존재: ✅")
            print(f"   - 타입: {type(prescription_data)}")
            if isinstance(prescription_data, dict):
                print(f"   - Status: {prescription_data.get('Status', 'N/A')}")
                result_list = prescription_data.get("ResultList")
                if result_list is None:
                    print(f"   - ResultList: None")
                elif isinstance(result_list, list):
                    print(f"   - ResultList 길이: {len(result_list)}건")
                else:
                    print(f"   - ResultList 타입: {type(result_list)}")
                print(f"   - 전체 키: {list(prescription_data.keys())}")
            else:
                print(f"   - 값: {prescription_data}")
        else:
            print(f"   - 존재: ❌ (None 또는 없음)")
        print()
        
        # 환자 정보 확인
        patient_uuid = session_data.get("patient_uuid")
        hospital_id = session_data.get("hospital_id")
        print("👤 환자 정보:")
        print(f"   - patient_uuid: {patient_uuid}")
        print(f"   - hospital_id: {hospital_id}")
        print()
        
        # auth_data 확인
        auth_data = session_data.get("auth_data")
        print("🔐 인증 정보:")
        if auth_data:
            print(f"   - 존재: ✅")
            print(f"   - CxId: {auth_data.get('CxId', 'N/A')[:20]}...")
        else:
            print(f"   - 존재: ❌")
        print()
        
        # 메시지 확인
        messages = session_data.get("messages", [])
        print(f"📨 메시지 ({len(messages)}개):")
        for i, msg in enumerate(messages[-5:], 1):  # 최근 5개만
            print(f"   [{i}] {msg.get('type', 'N/A')}: {msg.get('message', 'N/A')[:100]}")
        print()
        
        print("="*100)
        print("✅ 확인 완료")
        print("="*100)
        
    except Exception as e:
        print(f"❌ [오류] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_session_data())
