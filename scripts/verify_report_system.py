#!/usr/bin/env python3
"""
리포트 시스템 검증 스크립트
- Redis 연결 상태 확인
- 리포트 URL 유효성 검증
- API 엔드포인트 테스트
"""

import asyncio
import asyncpg
import httpx
from datetime import datetime, timedelta
import sys
import os

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'planning-platform', 'backend'))

from app.core.config import settings
from app.data.redis_session_manager import redis_session_manager


async def check_redis():
    """Redis 연결 상태 확인"""
    print("\n" + "="*80)
    print("📡 Redis 연결 상태 확인")
    print("="*80)
    
    if redis_session_manager.redis_client:
        try:
            redis_session_manager.redis_client.ping()
            print("✅ Redis 연결 성공")
            
            # 세션 키 개수 확인
            keys = redis_session_manager.redis_client.keys("tilko_session:*")
            print(f"📊 현재 활성 세션: {len(keys)}개")
            
            return True
        except Exception as e:
            print(f"❌ Redis Ping 실패: {e}")
            return False
    else:
        print("⚠️ Redis 클라이언트 없음 - 파일 기반 세션 사용 중")
        return False


async def verify_report_url(report_url: str, patient_name: str = "테스트"):
    """리포트 URL 유효성 검증 및 다운로드 테스트"""
    print(f"\n🔗 리포트 URL 검증: {patient_name}")
    print(f"   URL: {report_url[:80]}...")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # 1. HEAD 요청으로 유효성 확인
            response = await client.head(report_url, follow_redirects=True)
            
            if response.status_code == 200:
                print(f"   ✅ URL 유효 (200 OK)")
                
                # 2. 실제 다운로드 테스트
                get_response = await client.get(report_url, follow_redirects=True)
                content_size = len(get_response.content)
                content_kb = content_size / 1024
                
                print(f"   ✅ 다운로드 성공: {content_size} bytes ({content_kb:.1f} KB)")
                
                # 3. HTML 내용 확인
                if get_response.headers.get('content-type', '').startswith('text/html'):
                    print(f"   ✅ Content-Type: text/html")
                    
                    # 내용 일부 확인
                    content_preview = get_response.text[:150]
                    if '<html' in content_preview.lower() or '<!doctype' in content_preview.lower():
                        print(f"   ✅ HTML 문서 확인")
                    else:
                        print(f"   ⚠️ HTML이 아닐 수 있음")
                
                return True
                
            elif response.status_code == 403:
                print(f"   ❌ URL 만료 (403 Forbidden)")
                return False
            else:
                print(f"   ⚠️ 예상치 못한 응답: {response.status_code}")
                return False
                
    except httpx.TimeoutException:
        print(f"   ❌ 타임아웃 (15초 초과)")
        return False
    except Exception as e:
        print(f"   ❌ 오류: {e}")
        return False


async def check_db_reports():
    """DB에 저장된 리포트 확인 및 검증"""
    print("\n" + "="*80)
    print("📊 DB 리포트 데이터 검증")
    print("="*80)
    
    conn = await asyncpg.connect(
        host=getattr(settings, 'DB_HOST', '10.0.1.10'),
        port=getattr(settings, 'DB_PORT', 5432),
        database=getattr(settings, 'DB_NAME', 'p9_mkt_biz'),
        user=getattr(settings, 'DB_USER', 'peernine'),
        password=getattr(settings, 'DB_PASSWORD', 'autumn3334!')
    )
    
    # 1. 최근 리포트 조회 (상위 5개)
    reports = await conn.fetch("""
        SELECT 
            r.patient_uuid,
            p.name as patient_name,
            r.report_url,
            r.created_at,
            r.updated_at,
            EXTRACT(EPOCH FROM (NOW() - r.updated_at))/86400 as days_old
        FROM welno.welno_mediarc_reports r
        LEFT JOIN welno.welno_patients p ON r.patient_uuid = p.uuid
        ORDER BY r.created_at DESC
        LIMIT 5
    """)
    
    print(f"\n최근 리포트 {len(reports)}개:")
    
    valid_count = 0
    expired_count = 0
    
    for idx, report in enumerate(reports, 1):
        days_old = report['days_old']
        is_expired = days_old > 7
        
        status = "❌ 만료 예상" if is_expired else "✅ 유효"
        
        print(f"\n{idx}. {report['patient_name'] or '이름 없음'}")
        print(f"   UUID: {report['patient_uuid']}")
        print(f"   생성: {report['created_at']}")
        print(f"   경과: {days_old:.1f}일")
        print(f"   상태: {status}")
        
        # URL 검증
        if report['report_url']:
            url_valid = await verify_report_url(report['report_url'], report['patient_name'] or '이름 없음')
            if url_valid:
                valid_count += 1
            else:
                expired_count += 1
    
    print(f"\n📊 검증 결과:")
    print(f"   ✅ 유효: {valid_count}개")
    print(f"   ❌ 만료: {expired_count}개")
    
    await conn.close()
    
    return valid_count, expired_count


async def test_api_endpoints():
    """API 엔드포인트 테스트"""
    print("\n" + "="*80)
    print("🌐 API 엔드포인트 테스트")
    print("="*80)
    
    base_url = "http://localhost:8000"
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. 헬스체크
        try:
            response = await client.get(f"{base_url}/health")
            print(f"✅ Health Check: {response.status_code}")
        except Exception as e:
            print(f"⚠️ Health Check 실패: {e}")
        
        # 2. Welno 리포트 조회 (테스트 UUID)
        try:
            test_uuid = "test-uuid-1234"
            response = await client.get(
                f"{base_url}/api/v1/welno/mediarc-report",
                params={"uuid": test_uuid, "hospital_id": "PEERNINE"}
            )
            print(f"✅ WELNO 리포트 조회 API: {response.status_code}")
        except Exception as e:
            print(f"⚠️ WELNO 리포트 조회 실패: {e}")


async def main():
    """메인 실행"""
    print("\n" + "="*80)
    print("🔍 리포트 시스템 검증 시작")
    print("="*80)
    print(f"실행 시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 1. Redis 확인
    redis_ok = await check_redis()
    
    # 2. DB 리포트 검증
    valid, expired = await check_db_reports()
    
    # 3. API 테스트
    await test_api_endpoints()
    
    print("\n" + "="*80)
    print("✅ 검증 완료")
    print("="*80)
    
    # 요약
    print(f"\n📋 검증 요약:")
    print(f"   Redis: {'✅ 정상' if redis_ok else '⚠️ 파일 기반'}")
    print(f"   유효 리포트: {valid}개")
    print(f"   만료 리포트: {expired}개")
    
    if expired > 0:
        print(f"\n⚠️ 만료된 리포트가 {expired}개 있습니다.")
        print(f"   - S3 Presigned URL 유효기간: 7일")
        print(f"   - 재생성 필요 시 Mediarc API 재호출")


if __name__ == "__main__":
    asyncio.run(main())
