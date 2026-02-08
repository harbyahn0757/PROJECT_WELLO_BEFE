#!/usr/bin/env python3
"""
DB에서 Mediarc 리포트 목록 조회 (최근 N건)
환경 변수: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
  또는 planning-platform/backend/.env.local 자동 로드

사용법:
  python docs/scripts/utility_scripts/check_mediarc_reports.py
  python docs/scripts/utility_scripts/check_mediarc_reports.py --limit 20
"""
import asyncio
import os
import sys
from pathlib import Path

# backend .env.local 로드
_ROOT = Path(__file__).resolve().parents[3]
_BACKEND = _ROOT / "planning-platform" / "backend"
for p in [_BACKEND / ".env.local", _ROOT / ".env.local", _BACKEND / ".env"]:
    if p.exists():
        from dotenv import load_dotenv
        load_dotenv(p)
        break

import asyncpg


async def main(limit: int = 10):
    conn = await asyncpg.connect(
        host=os.getenv("DB_HOST", "10.0.1.10"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME", "p9_mkt_biz"),
        user=os.getenv("DB_USER", "peernine"),
        password=os.getenv("DB_PASSWORD", ""),
    )
    rows = await conn.fetch("""
        SELECT id, patient_uuid, hospital_id, mkt_uuid, report_url,
               provider, analyzed_at, bodyage, rank, created_at, updated_at
        FROM welno.welno_mediarc_reports
        ORDER BY created_at DESC
        LIMIT $1
    """, limit)
    await conn.close()

    print("=" * 80)
    print(f"📊 최근 Mediarc 리포트 {len(rows)}건")
    print("=" * 80)
    for idx, r in enumerate(rows, 1):
        print(f"\n[{idx}] id={r['id']} | uuid={r['patient_uuid']} | hospital={r['hospital_id']}")
        print(f"    provider={r['provider']} | bodyage={r['bodyage']} | rank={r['rank']}")
        print(f"    created={r['created_at']} | updated={r['updated_at']}")
        print(f"    report_url={str(r['report_url'])[:80]}..." if r['report_url'] else "    report_url=NULL")
    print("=" * 80)


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=10)
    args = p.parse_args()
    asyncio.run(main(args.limit))
