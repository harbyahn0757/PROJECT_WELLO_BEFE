#!/usr/bin/env python3
"""
DB에서 Mediarc 리포트 데이터 확인 스크립트
"""
import asyncio
import asyncpg
import json
from datetime import datetime

async def check_reports():
    """DB에서 리포트 데이터 확인"""
    try:
        # DB 연결
        conn = await asyncpg.connect(
            host='10.0.1.10',
            port=5432,
            database='p9_mkt_biz',
            user='peernine',
            password='autumn3334!'
        )
        
        # 최근 리포트 조회
        query = """
            SELECT 
                id, patient_uuid, hospital_id, mkt_uuid, report_url,
                provider, analyzed_at, bodyage, rank,
                created_at, updated_at,
                raw_response
            FROM welno.welno_mediarc_reports
            ORDER BY created_at DESC
            LIMIT 10
        """
        
        rows = await conn.fetch(query)
        
        print('=' * 100)
        print(f'📊 최근 Mediarc 리포트 {len(rows)}건 조회')
        print('=' * 100)
        
        for idx, row in enumerate(rows, 1):
            print(f'\n[{idx}] 리포트 ID: {row["id"]}')
            print(f'   - patient_uuid: {row["patient_uuid"]}')
            print(f'   - hospital_id: {row["hospital_id"]}')
            print(f'   - mkt_uuid: {row["mkt_uuid"]}')
            print(f'   - provider: {row["provider"]}')
            print(f'   - bodyage: {row["bodyage"]}, rank: {row["rank"]}')
            print(f'   - created_at: {row["created_at"]}')
            print(f'   - updated_at: {row["updated_at"]}')
            
            # report_url 확인
            report_url = row['report_url']
            if report_url:
                print(f'   - report_url: {report_url[:100]}...')
                print(f'     전체 URL 길이: {len(report_url)}')
                
                # URL 형식 확인
                if 'ncloudstorage.com' in report_url:
                    print(f'     ✅ NCloud Storage URL')
                elif 's3' in report_url.lower():
                    print(f'     ✅ S3 URL')
                elif 'presigned' in report_url.lower():
                    print(f'     ✅ Presigned URL')
                else:
                    print(f'     ⚠️ 알 수 없는 URL 형식')
            else:
                print(f'   - report_url: ❌ NULL')
            
            # raw_response에서 report_url 확인
            raw_response = row['raw_response']
            if raw_response and isinstance(raw_response, dict):
                raw_url = raw_response.get('report_url') or (raw_response.get('data', {}) or {}).get('report_url')
                if raw_url and raw_url != report_url:
                    print(f'   - raw_response.report_url: {raw_url[:100]}...')
                    print(f'     ⚠️ raw_response의 URL과 다름!')
        
        await conn.close()
        
        print('\n' + '=' * 100)
        print('✅ 조회 완료')
        print('=' * 100)
        
    except Exception as e:
        print(f'❌ 오류: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(check_reports())
