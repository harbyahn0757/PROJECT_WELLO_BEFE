#!/usr/bin/env python3
"""
리포트 시스템 검증 스크립트
- Redis 연결 상태 확인
- DB 리포트 URL 유효성 검증
- API 엔드포인트 테스트

실행: 프로젝트 루트에서
  python docs/scripts/test_scripts/verify_report_system.py
  cd planning-platform/backend && python ../../../docs/scripts/test_scripts/verify_report_system.py
"""
import asyncio
import asyncpg
import httpx
from datetime import datetime
import sys
import os

# backend 경로 (docs/scripts/test_scripts -> planning-platform/backend)
_BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "planning-platform", "backend"))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

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
    """리포트 URL 유효성 검증"""
    print(f"\n🔗 리포트 URL 검증: {patient_name}")
    print(f"   URL: {report_url[:80]}...")
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.head(report_url, follow_redirects=True)
            if r.status_code == 200:
                print(f"   ✅ URL 유효 (200 OK)")
                get_r = await client.get(report_url, follow_redirects=True)
                print(f"   ✅ 다운로드: {len(get_r.content)} bytes")
                return True
            elif r.status_code == 403:
                print(f"   ❌ URL 만료 (403 Forbidden)")
                return False
            else:
                print(f"   ⚠️ HTTP {r.status_code}")
                return False
    except Exception as e:
        print(f"   ❌ 오류: {e}")
        return False


async def check_db_reports():
    """DB 리포트 확인 및 URL 검증"""
    print("\n" + "="*80)
    print("📊 DB 리포트 데이터 검증")
    print("="*80)
    conn = await asyncpg.connect(
        host=getattr(settings, 'DB_HOST', '10.0.1.10'),
        port=getattr(settings, 'DB_PORT', 5432),
        database=getattr(settings, 'DB_NAME', 'p9_mkt_biz'),
        user=getattr(settings, 'DB_USER', 'peernine'),
        password=getattr(settings, 'DB_PASSWORD', '')
    )
    reports = await conn.fetch("""
        SELECT r.patient_uuid, p.name as patient_name, r.report_url, r.created_at,
               EXTRACT(EPOCH FROM (NOW() - r.updated_at))/86400 as days_old
        FROM welno.welno_mediarc_reports r
        LEFT JOIN welno.welno_patients p ON r.patient_uuid = p.uuid
        ORDER BY r.created_at DESC
        LIMIT 5
    """)
    print(f"\n최근 리포트 {len(reports)}개:")
    valid_count = expired_count = 0
    for idx, report in enumerate(reports, 1):
        days_old = report['days_old']
        status = "❌ 만료 예상" if days_old > 7 else "✅ 유효"
        print(f"\n{idx}. {report['patient_name'] or '이름 없음'} | 경과 {days_old:.1f}일 | {status}")
        if report['report_url']:
            if await verify_report_url(report['report_url'], report['patient_name'] or '이름 없음'):
                valid_count += 1
            else:
                expired_count += 1
    print(f"\n📊 유효: {valid_count}개, 만료: {expired_count}개")
    await conn.close()
    return valid_count, expired_count


async def test_api_endpoints():
    """API 엔드포인트 테스트"""
    print("\n" + "="*80)
    print("🌐 API 엔드포인트 테스트")
    print("="*80)
    base_url = os.getenv("API_BASE_URL", "http://localhost:8082")
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.get(f"{base_url}/health")
            print(f"✅ Health: {r.status_code}")
        except Exception as e:
            print(f"⚠️ Health 실패: {e}")
        try:
            r = await client.get(f"{base_url}/api/v1/welno/mediarc-report", params={"uuid": "test", "hospital_id": "PEERNINE"})
            print(f"✅ Mediarc 리포트 API: {r.status_code}")
        except Exception as e:
            print(f"⚠️ Mediarc API 실패: {e}")


async def main():
    print("\n" + "="*80)
    print("🔍 리포트 시스템 검증")
    print("="*80)
    print(f"실행 시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    redis_ok = await check_redis()
    valid, expired = await check_db_reports()
    await test_api_endpoints()
    print("\n" + "="*80)
    print("✅ 검증 완료")
    print("="*80)
    print(f"\n📋 요약: Redis={'✅' if redis_ok else '⚠️'} | 유효 리포트 {valid}개 | 만료 {expired}개")


if __name__ == "__main__":
    asyncio.run(main())
