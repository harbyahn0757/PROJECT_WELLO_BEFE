#!/usr/bin/env python3
"""
투비콘 레포트 API 사용 예제 (Python)
- 리포트 생성 API 호출
- Presigned URL로 다운로드

사용법 (프로젝트 루트에서):
  python docs/scripts/test_scripts/twobecon_report_example.py
"""
import requests
from datetime import datetime
import sys


def generate_twobecon_report(api_key, user_name, twobecon_data):
    url = 'https://xogxog.com/api/external/mediarc/report/'
    payload = {
        'api_key': api_key,
        'user_name': user_name,
        'twobecon_data': twobecon_data,
        'return_type': 'both'
    }
    try:
        response = requests.post(url, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()
        if not result.get('success'):
            raise Exception(result.get('error', '리포트 생성 실패'))
        return result
    except requests.exceptions.RequestException as e:
        raise Exception(f'API 호출 실패: {str(e)}')


def download_report(report_url, save_path=None):
    if save_path is None:
        save_path = f'report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
    try:
        response = requests.get(report_url, timeout=30)
        response.raise_for_status()
        with open(save_path, 'wb') as f:
            f.write(response.content)
        print(f'다운로드 완료: {save_path} ({len(response.content)} bytes)')
        return save_path
    except requests.exceptions.RequestException as e:
        raise Exception(f'다운로드 실패: {str(e)}')


def main():
    api_key = 'welno_5a9bb40b5108ecd8ef864658d5a2d5ab'
    user_name = '홍길동'
    twobecon_data = {
        'tid': f'TM_TEST_{int(datetime.now().timestamp())}',
        'birth': '1980-01-30',
        'gender': 1,
        'drink': 'DRK0002',
        'smoke': 'SMK0003',
        'family': ['FH0001'],
        'disease': ['DIS0001'],
        'cancer': ['CNR0001'],
        'checkup': {
            'date': datetime.now().strftime('%Y-%m-%d'),
            'height': 175.0, 'weight': 70.0, 'waist': 80.0, 'bmi': 22.86,
            'sbp': 120.0, 'dbp': 80.0, 'up': '', 'hgb': 0.0, 'fbs': 95.0,
            'tc': 200.0, 'hdl': 50.0, 'tg': 150.0, 'ldl': 130.0,
            'scr': 1.0, 'gfr': 0.0, 'ast': 25.0, 'alt': 30.0, 'gpt': 35.0, 'tb': '정상'
        }
    }
    try:
        print('=' * 80)
        print('투비콘 레포트 생성 및 다운로드 예제')
        print('=' * 80)
        print('\n1. 리포트 생성 중...')
        result = generate_twobecon_report(api_key, user_name, twobecon_data)
        print('✅ 리포트 생성 성공!')
        print(f'   mkt_uuid: {result["mkt_uuid"]} | report_url: {result["report_url"][:60]}...')
        if result.get('mediarC'):
            print(f'   건강나이: {result["mediarC"]["bodyage"]}세 | 순위: {result["mediarC"]["rank"]}%')
        print('\n2. 리포트 다운로드 중...')
        downloaded_path = download_report(result['report_url'], result['pdf_metadata']['filename'])
        print(f'✅ 다운로드 성공: {downloaded_path}')
        print('=' * 80)
    except Exception as e:
        print(f'\n❌ 에러: {str(e)}')
        sys.exit(1)


if __name__ == '__main__':
    main()
