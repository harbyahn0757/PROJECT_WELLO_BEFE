#!/usr/bin/env python3
"""
약관 동의 파이프라인 테스트

로컬 → 서버 동기화 전체 플로우 검증
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'planning-platform', 'backend'))

import asyncio
from datetime import datetime, timedelta
from app.core.database import db_manager

async def test_terms_pipeline():
    print("\n" + "="*80)
    print("🧪 약관 동의 파이프라인 테스트")
    print("="*80)
    
    test_uuid = "test_terms_pipeline_001"
    test_partner = "kindhabit"
    
    # 1. 테스트 환자 생성
    print("\n[1단계] 테스트 환자 생성...")
    try:
        insert_query = """
        INSERT INTO welno.welno_patients 
        (uuid, hospital_id, name, phone_number, birth_date, gender, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
        ON CONFLICT (uuid, hospital_id) DO UPDATE 
        SET name = EXCLUDED.name,
            updated_at = NOW()
        RETURNING id
        """
        
        result = await db_manager.execute_one(
            insert_query,
            (test_uuid, "PEERNINE", "테스트약관", "01012345678", "1990-01-01", "M")
        )
        
        patient_id = result['id'] if result else None
        print(f"  ✅ 환자 생성/업데이트 완료: ID={patient_id}")
    except Exception as e:
        print(f"  ❌ 환자 생성 실패: {e}")
        return
    
    # 2. 약관 동의 상세 정보 저장
    print("\n[2단계] 약관 동의 상세 정보 저장...")
    try:
        import json
        now = datetime.now()
        
        terms_detail = {
            "terms_service": {
                "agreed": True,
                "agreed_at": now.isoformat()
            },
            "terms_privacy": {
                "agreed": True,
                "agreed_at": now.isoformat()
            },
            "terms_sensitive": {
                "agreed": True,
                "agreed_at": now.isoformat()
            },
            "terms_marketing": {
                "agreed": False,
                "agreed_at": None
            }
        }
        
        update_query = """
        UPDATE welno.welno_patients 
        SET terms_agreement_detail = %s,
            terms_all_required_agreed_at = NOW(),
            updated_at = NOW()
        WHERE uuid = %s AND hospital_id = %s
        """
        
        await db_manager.execute_update(
            update_query,
            (json.dumps(terms_detail), test_uuid, "PEERNINE")
        )
        
        print(f"  ✅ 약관 동의 저장 완료")
        print(f"    - 서비스 이용: {terms_detail['terms_service']['agreed']}")
        print(f"    - 개인정보: {terms_detail['terms_privacy']['agreed']}")
        print(f"    - 민감정보: {terms_detail['terms_sensitive']['agreed']}")
        print(f"    - 마케팅: {terms_detail['terms_marketing']['agreed']}")
    except Exception as e:
        print(f"  ❌ 약관 저장 실패: {e}")
        return
    
    # 3. 약관 동의 조회
    print("\n[3단계] 약관 동의 조회...")
    try:
        query = """
        SELECT 
            uuid,
            name,
            terms_agreement_detail,
            terms_all_required_agreed_at,
            updated_at
        FROM welno.welno_patients
        WHERE uuid = %s AND hospital_id = %s
        """
        
        result = await db_manager.execute_one(query, (test_uuid, "PEERNINE"))
        
        if result:
            print(f"  ✅ 조회 성공:")
            print(f"    - UUID: {result['uuid']}")
            print(f"    - 이름: {result['name']}")
            print(f"    - 약관 상세: {result['terms_agreement_detail']}")
            print(f"    - 필수 약관 동의 시간: {result['terms_all_required_agreed_at']}")
        else:
            print(f"  ❌ 조회 실패")
    except Exception as e:
        print(f"  ❌ 조회 오류: {e}")
    
    # 4. 정리
    print("\n[4단계] 테스트 데이터 정리...")
    try:
        await db_manager.execute_update(
            "DELETE FROM welno.welno_patients WHERE uuid = %s",
            (test_uuid,)
        )
        print(f"  ✅ 테스트 환자 삭제 완료")
    except Exception as e:
        print(f"  ⚠️ 정리 실패 (수동 삭제 필요): {e}")
    
    print("\n" + "="*80)
    print("✅ 테스트 완료!")
    print("="*80)

if __name__ == "__main__":
    asyncio.run(test_terms_pipeline())
