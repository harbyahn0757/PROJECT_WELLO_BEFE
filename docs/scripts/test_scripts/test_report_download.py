#!/usr/bin/env python3
"""
리포트 다운로드 API 테스트 (통합)
- 기본 모드: 정상 다운로드 + 파일 저장
- 종합 모드(기본): 정상 케이스 + 404(잘못된 UUID) + 404(잘못된 hospital_id)

사용법:
  python docs/scripts/test_scripts/test_report_download.py              # 종합 테스트
  python docs/scripts/test_scripts/test_report_download.py --quick     # 기본 다운로드만
  python docs/scripts/test_scripts/test_report_download.py --base-url http://localhost:8082
"""
import asyncio
import argparse
import os
import sys
from datetime import datetime

# 프로젝트 루트 기준 backend 경로
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_BACKEND_DIR = os.path.join(_PROJECT_ROOT, "planning-platform", "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

# .env.local 로드 (backend 또는 프로젝트 루트)
def _load_env():
    from pathlib import Path
    for path in [
        Path(_BACKEND_DIR) / ".env.local",
        Path(_PROJECT_ROOT) / ".env.local",
        Path(_BACKEND_DIR) / ".env",
    ]:
        if path.exists():
            from dotenv import load_dotenv
            load_dotenv(path)
            return

_load_env()

import asyncpg
import httpx


def _db_config():
    return {
        "host": os.getenv("DB_HOST", "10.0.1.10"),
        "port": int(os.getenv("DB_PORT", "5432")),
        "database": os.getenv("DB_NAME", "p9_mkt_biz"),
        "user": os.getenv("DB_USER", "peernine"),
        "password": os.getenv("DB_PASSWORD", ""),
    }


async def _fetch_test_report(conn):
    row = await conn.fetchrow("""
        SELECT patient_uuid, hospital_id, report_url
        FROM welno.welno_mediarc_reports
        ORDER BY created_at DESC
        LIMIT 1
    """)
    return row


async def run_quick(base_url: str):
    """기본 다운로드 테스트 + 파일 저장"""
    cfg = _db_config()
    conn = await asyncpg.connect(**cfg)
    try:
        row = await _fetch_test_report(conn)
        if not row:
            print("❌ 테스트할 리포트가 없습니다.")
            return
        uuid, hospital_id, report_url = row["patient_uuid"], row["hospital_id"], row["report_url"]
    finally:
        await conn.close()

    print("=" * 80)
    print("🧪 리포트 다운로드 API 테스트 (기본)")
    print("=" * 80)
    print(f"   uuid: {uuid}")
    print(f"   hospital_id: {hospital_id}")
    print()

    api_url = f"{base_url}/api/v1/welno/mediarc-report/download"
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.get(api_url, params={"uuid": uuid, "hospital_id": hospital_id})
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                ct = response.headers.get("content-type", "")
                if "pdf" in ct.lower():
                    filename = f"test_report_{uuid[:8]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
                    with open(filename, "wb") as f:
                        f.write(response.content)
                    print(f"   ✅ 저장: {filename} ({len(response.content)} bytes)")
                else:
                    print(f"   ⚠️ Content-Type: {ct}")
            else:
                print(f"   ❌ 응답: {response.text[:300]}")
        except Exception as e:
            print(f"   ❌ 오류: {e}")
    print("=" * 80)


async def run_comprehensive(base_url: str):
    """종합 테스트: 정상 + 404(UUID) + 404(hospital_id)"""
    cfg = _db_config()
    conn = await asyncpg.connect(**cfg)
    try:
        row = await _fetch_test_report(conn)
        if not row:
            print("❌ 테스트할 리포트가 없습니다.")
            return
        uuid, hospital_id = row["patient_uuid"], row["hospital_id"]
    finally:
        await conn.close()

    print("=" * 80)
    print("🧪 리포트 다운로드 종합 테스트")
    print("=" * 80)
    print(f"   테스트 데이터: uuid={uuid}, hospital_id={hospital_id}")
    print()

    api = f"{base_url}/api/v1/welno/mediarc-report/download"

    # 1) 정상
    print("📋 테스트 1: 정상 다운로드")
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            r = await client.get(api, params={"uuid": uuid, "hospital_id": hospital_id})
            if r.status_code == 200:
                print(f"   ✅ 성공: {len(r.content)} bytes")
            else:
                print(f"   ❌ HTTP {r.status_code}: {r.text[:200]}")
        except Exception as e:
            print(f"   ❌ {e}")
    print()

    # 2) 잘못된 UUID
    print("📋 테스트 2: 존재하지 않는 UUID (기대: 404)")
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            r = await client.get(api, params={"uuid": "00000000-0000-0000-0000-000000000000", "hospital_id": hospital_id})
            if r.status_code == 404:
                print(f"   ✅ 예상 404")
            else:
                print(f"   ⚠️ HTTP {r.status_code}")
        except Exception as e:
            print(f"   ❌ {e}")
    print()

    # 3) 잘못된 hospital_id
    print("📋 테스트 3: 잘못된 hospital_id (기대: 404)")
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            r = await client.get(api, params={"uuid": uuid, "hospital_id": "INVALID_HOSPITAL"})
            if r.status_code == 404:
                print(f"   ✅ 예상 404")
            else:
                print(f"   ⚠️ HTTP {r.status_code}")
        except Exception as e:
            print(f"   ❌ {e}")
    print()
    print("=" * 80)
    print("✅ 종합 테스트 완료")
    print("=" * 80)


def main():
    parser = argparse.ArgumentParser(description="리포트 다운로드 API 테스트")
    parser.add_argument("--quick", action="store_true", help="기본 다운로드만 (파일 저장)")
    parser.add_argument("--base-url", default=os.getenv("API_BASE_URL", "http://localhost:8082"), help="API 베이스 URL")
    args = parser.parse_args()

    if args.quick:
        asyncio.run(run_quick(args.base_url))
    else:
        asyncio.run(run_comprehensive(args.base_url))


if __name__ == "__main__":
    main()
