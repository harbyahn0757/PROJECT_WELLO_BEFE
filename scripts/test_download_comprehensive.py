#!/usr/bin/env python3
"""
리포트 다운로드 종합 테스트
- 정상 케이스
- 에러 케이스 (404, 403 등)
"""
import asyncio
import asyncpg
import httpx
import sys

async def test_download_comprehensive():
    """종합 테스트"""
    try:
        # DB 연결
        conn = await asyncpg.connect(
            host='10.0.1.10',
            port=5432,
            database='p9_mkt_biz',
            user='peernine',
            password='autumn3334!'
        )
        
        # 테스트 데이터 조회
        row = await conn.fetchrow("""
            SELECT patient_uuid, hospital_id, report_url
            FROM welno.welno_mediarc_reports
            ORDER BY created_at DESC
            LIMIT 1
        """)
        
        if not row:
            print("❌ 테스트할 리포트가 없습니다.")
            await conn.close()
            return
        
        uuid = row['patient_uuid']
        hospital_id = row['hospital_id']
        
        await conn.close()
        
        base_url = 'http://localhost:8082'
        
        print('=' * 100)
        print('🧪 리포트 다운로드 종합 테스트')
        print('=' * 100)
        print()
        
        # 테스트 1: 정상 케이스
        print('📋 테스트 1: 정상 다운로드')
        print(f'   - uuid: {uuid}')
        print(f'   - hospital_id: {hospital_id}')
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.get(
                    f'{base_url}/api/v1/welno/mediarc-report/download',
                    params={'uuid': uuid, 'hospital_id': hospital_id}
                )
                
                if response.status_code == 200:
                    print(f'   ✅ 성공: {len(response.content)} bytes')
                    print(f'   - Content-Type: {response.headers.get("content-type")}')
                    print(f'   - Content-Disposition: {response.headers.get("content-disposition")}')
                else:
                    print(f'   ❌ 실패: HTTP {response.status_code}')
                    print(f'   - Response: {response.text[:200]}')
            except Exception as e:
                print(f'   ❌ 오류: {str(e)}')
        
        print()
        
        # 테스트 2: 존재하지 않는 UUID
        print('📋 테스트 2: 존재하지 않는 UUID')
        fake_uuid = '00000000-0000-0000-0000-000000000000'
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.get(
                    f'{base_url}/api/v1/welno/mediarc-report/download',
                    params={'uuid': fake_uuid, 'hospital_id': hospital_id}
                )
                
                if response.status_code == 404:
                    print(f'   ✅ 예상된 404 에러: {response.json().get("detail", "")}')
                else:
                    print(f'   ⚠️ 예상과 다른 응답: HTTP {response.status_code}')
            except Exception as e:
                print(f'   ❌ 오류: {str(e)}')
        
        print()
        
        # 테스트 3: 잘못된 hospital_id
        print('📋 테스트 3: 잘못된 hospital_id')
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.get(
                    f'{base_url}/api/v1/welno/mediarc-report/download',
                    params={'uuid': uuid, 'hospital_id': 'INVALID'}
                )
                
                if response.status_code == 404:
                    print(f'   ✅ 예상된 404 에러: {response.json().get("detail", "")}')
                else:
                    print(f'   ⚠️ 예상과 다른 응답: HTTP {response.status_code}')
            except Exception as e:
                print(f'   ❌ 오류: {str(e)}')
        
        print()
        print('=' * 100)
        print('✅ 종합 테스트 완료')
        print('=' * 100)
        
    except Exception as e:
        print(f'❌ 오류: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(test_download_comprehensive())
