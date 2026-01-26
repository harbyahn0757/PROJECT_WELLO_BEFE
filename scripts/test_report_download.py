#!/usr/bin/env python3
"""
리포트 다운로드 API 테스트 스크립트
"""
import asyncio
import asyncpg
import httpx
import sys
from datetime import datetime

async def test_download_api():
    """다운로드 API 테스트"""
    try:
        # DB에서 테스트용 리포트 조회
        conn = await asyncpg.connect(
            host='10.0.1.10',
            port=5432,
            database='p9_mkt_biz',
            user='peernine',
            password='autumn3334!'
        )
        
        # 최근 리포트 1건 조회
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
        report_url = row['report_url']
        
        print('=' * 100)
        print('🧪 리포트 다운로드 API 테스트')
        print('=' * 100)
        print(f'📋 테스트 데이터:')
        print(f'   - patient_uuid: {uuid}')
        print(f'   - hospital_id: {hospital_id}')
        print(f'   - report_url: {report_url[:100] if report_url else "NULL"}...')
        print()
        
        await conn.close()
        
        # 백엔드 API 테스트
        base_url = 'http://localhost:8082'  # FastAPI 개발 환경
        # base_url = 'https://xogxog.com'  # 프로덕션 환경
        
        api_url = f'{base_url}/api/v1/welno/mediarc-report/download'
        params = {
            'uuid': uuid,
            'hospital_id': hospital_id
        }
        
        print(f'📡 API 호출:')
        print(f'   - URL: {api_url}')
        print(f'   - Params: {params}')
        print()
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                # 1. 다운로드 API 호출
                print('1️⃣ 다운로드 API 호출 중...')
                response = await client.get(api_url, params=params)
                
                print(f'   - Status Code: {response.status_code}')
                print(f'   - Headers: {dict(response.headers)}')
                print()
                
                if response.status_code == 200:
                    # 2. 응답 확인
                    content_type = response.headers.get('content-type', '')
                    content_length = response.headers.get('content-length', '0')
                    
                    print('2️⃣ 응답 확인:')
                    print(f'   - Content-Type: {content_type}')
                    print(f'   - Content-Length: {content_length} bytes')
                    print()
                    
                    # 3. 파일 저장
                    if 'pdf' in content_type.lower():
                        filename = f'test_report_{uuid[:8]}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
                        with open(filename, 'wb') as f:
                            f.write(response.content)
                        
                        file_size = len(response.content)
                        print(f'3️⃣ 파일 저장:')
                        print(f'   - 파일명: {filename}')
                        print(f'   - 크기: {file_size} bytes ({file_size / 1024:.1f} KB)')
                        print()
                        print('✅ 다운로드 테스트 성공!')
                    else:
                        print(f'⚠️ 예상치 못한 Content-Type: {content_type}')
                        print(f'   응답 내용 (처음 200자): {response.text[:200]}')
                else:
                    print(f'❌ API 호출 실패:')
                    print(f'   - Status: {response.status_code}')
                    print(f'   - Response: {response.text[:500]}')
                    
            except httpx.TimeoutException:
                print('❌ 타임아웃: API 응답이 60초를 초과했습니다.')
            except httpx.RequestError as e:
                print(f'❌ 요청 오류: {str(e)}')
                print('   백엔드 서버가 실행 중인지 확인해주세요.')
            except Exception as e:
                print(f'❌ 예외 발생: {str(e)}')
                import traceback
                traceback.print_exc()
        
        print('=' * 100)
        
    except Exception as e:
        print(f'❌ 오류: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(test_download_api())
