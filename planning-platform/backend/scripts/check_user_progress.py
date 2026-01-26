#!/usr/bin/env python3
"""
사용자 진행 상태 확인 스크립트
세션 ID 또는 UUID로 전체 진행 상태 확인
"""
import asyncio
import asyncpg
import json
import os
import sys
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

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
SESSION_ID = "96b00708-9ce6-4df8-8999-a824ebc485a6"

async def check_user_progress():
    """사용자 진행 상태 확인"""
    try:
        # 세션 데이터 확인
        from app.data.redis_session_manager import redis_session_manager as session_manager
        
        print("\n" + "="*100)
        print("🔍 사용자 진행 상태 확인")
        print("="*100)
        print(f"\n세션 ID: {SESSION_ID}")
        print()
        
        # 세션 데이터 가져오기
        session_data = session_manager.get_session(SESSION_ID)
        
        if not session_data:
            print("❌ 세션을 찾을 수 없습니다.")
            print("   (파일 기반 세션 저장소 확인 중...)")
            # 파일 기반 세션 확인
            from app.data.tilko_session_data import TilkoSessionManager
            file_session_manager = TilkoSessionManager()
            session_data = file_session_manager.get_session(SESSION_ID)
            
            if not session_data:
                print("❌ 파일 기반 세션도 찾을 수 없습니다.")
                return
            else:
                print("✅ 파일 기반 세션에서 발견")
        
        print("\n" + "-"*100)
        print("1️⃣ 틸코 세션 정보")
        print("-"*100)
        print(f"   - 상태: {session_data.get('status', 'N/A')}")
        print(f"   - 생성 시간: {session_data.get('created_at', 'N/A')}")
        print(f"   - 업데이트 시간: {session_data.get('updated_at', 'N/A')}")
        print(f"   - 만료 시간: {session_data.get('expires_at', 'N/A')}")
        
        # 진행 상태
        progress = session_data.get("progress", {})
        print(f"\n   진행 상태:")
        print(f"   - 인증 요청: {'✅' if progress.get('auth_requested') else '❌'}")
        print(f"   - 인증 완료: {'✅' if progress.get('auth_completed') else '❌'}")
        print(f"   - 건강 데이터 수집: {'✅' if progress.get('health_data_fetched') else '❌'}")
        print(f"   - 처방전 데이터 수집: {'✅' if progress.get('prescription_data_fetched') else '❌'}")
        print(f"   - 완료: {'✅' if progress.get('completed') else '❌'}")
        
        # 환자 정보
        patient_uuid = session_data.get("patient_uuid")
        hospital_id = session_data.get("hospital_id")
        user_info = session_data.get("user_info", {})
        print(f"\n   환자 정보:")
        print(f"   - patient_uuid: {patient_uuid}")
        print(f"   - hospital_id: {hospital_id}")
        print(f"   - 사용자 이름: {user_info.get('name', 'N/A')}")
        
        # 인증 데이터
        auth_data = session_data.get("auth_data")
        print(f"\n   인증 데이터:")
        if auth_data:
            print(f"   - 존재: ✅")
            print(f"   - CxId: {auth_data.get('CxId', 'N/A')[:30]}...")
            print(f"   - TxId: {auth_data.get('TxId', 'N/A')[:30]}...")
        else:
            print(f"   - 존재: ❌")
        
        # 건강 데이터
        health_data = session_data.get("health_data")
        print(f"\n   건강 데이터:")
        if health_data:
            print(f"   - 존재: ✅")
            if isinstance(health_data, dict):
                result_list = health_data.get("ResultList")
                if isinstance(result_list, list):
                    print(f"   - 검진 기록 수: {len(result_list)}건")
                else:
                    print(f"   - ResultList: {result_list}")
        else:
            print(f"   - 존재: ❌")
        
        # 처방전 데이터
        prescription_data = session_data.get("prescription_data")
        print(f"\n   처방전 데이터:")
        if prescription_data:
            print(f"   - 존재: ✅")
            if isinstance(prescription_data, dict):
                result_list = prescription_data.get("ResultList")
                if isinstance(result_list, list):
                    print(f"   - 처방전 수: {len(result_list)}건")
        else:
            print(f"   - 존재: ❌")
        
        # 메시지
        messages = session_data.get("messages", [])
        print(f"\n   최근 메시지 ({len(messages)}개):")
        for i, msg in enumerate(messages[-5:], 1):
            print(f"   [{i}] [{msg.get('type', 'N/A')}] {msg.get('message', 'N/A')[:80]}")
        
        # 데이터베이스 연결하여 추가 정보 확인
        if patient_uuid:
            print("\n" + "-"*100)
            print("2️⃣ 데이터베이스 정보")
            print("-"*100)
            
            conn = await asyncpg.connect(**DB_CONFIG)
            try:
                # 환자 정보 확인
                patient_row = await conn.fetchrow("""
                    SELECT id, name, phone_number, birth_date, gender, partner_id, created_at
                    FROM welno.welno_patients
                    WHERE uuid = $1
                    LIMIT 1
                """, patient_uuid)
                
                if patient_row:
                    print(f"\n   환자 정보:")
                    print(f"   - ID: {patient_row['id']}")
                    print(f"   - 이름: {patient_row['name']}")
                    print(f"   - 전화번호: {patient_row['phone_number']}")
                    print(f"   - 생년월일: {patient_row['birth_date']}")
                    print(f"   - 성별: {patient_row['gender']}")
                    print(f"   - 파트너: {patient_row['partner_id']}")
                    print(f"   - 생성일: {patient_row['created_at']}")
                else:
                    print(f"\n   환자 정보: ❌ 등록되지 않음")
                
                # 결제 정보 확인
                if patient_row and patient_row['partner_id']:
                    payment_row = await conn.fetchrow("""
                        SELECT oid, status, amount, pipeline_step, created_at, updated_at, report_url
                        FROM welno.tb_campaign_payments
                        WHERE uuid = $1 AND partner_id = $2
                        ORDER BY created_at DESC
                        LIMIT 1
                    """, patient_uuid, patient_row['partner_id'])
                    
                    if payment_row:
                        print(f"\n   결제 정보:")
                        print(f"   - 주문번호: {payment_row['oid']}")
                        print(f"   - 상태: {payment_row['status']}")
                        print(f"   - 금액: {payment_row['amount']:,}원")
                        print(f"   - 파이프라인 단계: {payment_row['pipeline_step'] or 'N/A'}")
                        print(f"   - 리포트 URL: {'✅' if payment_row['report_url'] else '❌'}")
                        print(f"   - 생성일: {payment_row['created_at']}")
                        print(f"   - 수정일: {payment_row['updated_at']}")
                    else:
                        print(f"\n   결제 정보: ❌ 없음")
                
                # 약관 동의 확인
                if patient_row:
                    terms_row = await conn.fetchrow("""
                        SELECT agreed_at, service_terms, privacy_terms, sensitive_terms, marketing_terms
                        FROM welno.tb_terms_agreement
                        WHERE uuid = $1
                        ORDER BY agreed_at DESC
                        LIMIT 1
                    """, patient_uuid)
                    
                    if terms_row:
                        print(f"\n   약관 동의:")
                        print(f"   - 동의일: {terms_row['agreed_at']}")
                        print(f"   - 서비스 이용약관: {'✅' if terms_row['service_terms'] else '❌'}")
                        print(f"   - 개인정보 수집/이용: {'✅' if terms_row['privacy_terms'] else '❌'}")
                        print(f"   - 민감정보 수집/이용: {'✅' if terms_row['sensitive_terms'] else '❌'}")
                        print(f"   - 마케팅 활용: {'✅' if terms_row['marketing_terms'] else '❌'}")
                    else:
                        print(f"\n   약관 동의: ❌ 없음")
                
            finally:
                await conn.close()
        
        print("\n" + "="*100)
        print("✅ 확인 완료")
        print("="*100)
        
    except Exception as e:
        print(f"❌ [오류] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        SESSION_ID = sys.argv[1]
    asyncio.run(check_user_progress())
