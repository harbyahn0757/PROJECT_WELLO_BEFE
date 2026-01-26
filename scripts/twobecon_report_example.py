#!/usr/bin/env python3
"""
투비콘 레포트 API 사용 예제 (Python)

사용법:
    python3 twobecon_report_example.py
"""

import requests
from datetime import datetime
import sys

# ============================================
# 1. 리포트 생성
# ============================================

def generate_twobecon_report(api_key, user_name, twobecon_data):
    """
    투비콘 레포트 생성 API 호출
    
    Args:
        api_key: 파트너 API 키
        user_name: 사용자 이름
        twobecon_data: 투비콘 형식 데이터
    
    Returns:
        dict: API 응답 결과
    """
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

# ============================================
# 2. 리포트 다운로드
# ============================================

def download_report(report_url, save_path=None):
    """
    리포트 URL로 다운로드
    
    ✅ report_url은 Presigned URL이므로 바로 다운로드 가능합니다.
    
    Args:
        report_url: 리포트 Presigned URL
        save_path: 저장 경로 (기본값: report_YYYYMMDD_HHMMSS.pdf)
    
    Returns:
        str: 저장된 파일 경로
    """
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

# ============================================
# 3. 전체 플로우 예제
# ============================================

def main():
    api_key = 'welno_5a9bb40b5108ecd8ef864658d5a2d5ab'
    user_name = '홍길동'
    
    twobecon_data = {
        'tid': f'TM_TEST_{int(datetime.now().timestamp())}',
        'birth': '1980-01-30',
        'gender': 1,  # 1=남성, 0=여성
        'drink': 'DRK0002',  # DRK0001=예, DRK0002=아니요
        'smoke': 'SMK0003',  # SMK0001=예, SMK0002=금연중, SMK0003=아니요
        'family': ['FH0001'],  # 가족력 없음
        'disease': ['DIS0001'],  # 질환 없음
        'cancer': ['CNR0001'],  # 암 없음
        'checkup': {
            'date': datetime.now().strftime('%Y-%m-%d'),
            'height': 175.0,
            'weight': 70.0,
            'waist': 80.0,
            'bmi': 22.86,
            'sbp': 120.0,  # 수축기 혈압
            'dbp': 80.0,   # 이완기 혈압
            'up': '',
            'hgb': 0.0,
            'fbs': 95.0,   # 공복혈당
            'tc': 200.0,   # 총콜레스테롤
            'hdl': 50.0,   # HDL콜레스테롤
            'tg': 150.0,   # 중성지방
            'ldl': 130.0,  # LDL콜레스테롤
            'scr': 1.0,    # 혈청크레아티닌
            'gfr': 0.0,
            'ast': 25.0,
            'alt': 30.0,
            'gpt': 35.0,
            'tb': '정상'
        }
    }

    try:
        print('=' * 80)
        print('투비콘 레포트 생성 및 다운로드 예제')
        print('=' * 80)
        
        # 1. 리포트 생성
        print('\n1. 리포트 생성 중...')
        result = generate_twobecon_report(api_key, user_name, twobecon_data)
        
        print('✅ 리포트 생성 성공!')
        print(f'   mkt_uuid: {result["mkt_uuid"]}')
        print(f'   report_url: {result["report_url"]}')
        print(f'   s3_key: {result["pdf_metadata"]["s3_key"]}')
        print(f'   filename: {result["pdf_metadata"]["filename"]}')
        
        if result.get('mediarC'):
            print(f'   건강나이: {result["mediarC"]["bodyage"]}세')
            print(f'   순위: {result["mediarC"]["rank"]}%')
        
        # 2. DB에 저장 (예제)
        print('\n2. DB에 저장 (예제)...')
        print(f'   ⚠️ 중요: s3_key를 DB에 저장하세요!')
        print(f'   - mkt_uuid: {result["mkt_uuid"]}')
        print(f'   - s3_key: {result["pdf_metadata"]["s3_key"]}')
        
        # 3. 리포트 다운로드
        print('\n3. 리포트 다운로드 중...')
        downloaded_path = download_report(
            result['report_url'],
            result['pdf_metadata']['filename']
        )
        print(f'✅ 다운로드 성공: {downloaded_path}')
        
        print('\n' + '=' * 80)
        print('✅ 리포트 생성 완료!')
        print('=' * 80)
        print(f'📄 리포트 정보:')
        print(f'   - mkt_uuid: {result["mkt_uuid"]}')
        print(f'   - s3_key: {result["pdf_metadata"]["s3_key"]}')
        print(f'   - report_url: {result["report_url"]}')
        
    except Exception as e:
        print(f'\n❌ 에러 발생: {str(e)}')
        sys.exit(1)

if __name__ == '__main__':
    main()
