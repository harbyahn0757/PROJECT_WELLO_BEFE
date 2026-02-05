#!/usr/bin/env python3
"""
실제 실행되는 쿼리 확인
"""
import asyncio
import json
import os
import sys
from dotenv import load_dotenv

# 프로젝트 루트를 Python 경로에 추가
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# .env.local 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    load_dotenv(env_path)

async def check_actual_query():
    """실제 실행되는 쿼리 확인"""
    
    # WelnoDataService 소스 코드 직접 확인
    service_file = '/home/workspace/PROJECT_WELNO_BEFE/planning-platform/backend/app/services/welno_data_service.py'
    
    print('=== 실제 파일 내용 확인 ===')
    
    with open(service_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # INSERT 쿼리 부분 찾기
    for i, line in enumerate(lines):
        if 'INSERT INTO welno.welno_checkup_data' in line:
            print(f'라인 {i+1}: {line.strip()}')
            # 다음 몇 줄도 출력
            for j in range(1, 6):
                if i+j < len(lines):
                    print(f'라인 {i+j+1}: {lines[i+j].strip()}')
            break
    
    print('\\n=== json.dumps 사용 부분 확인 ===')
    
    # json.dumps 사용 부분 찾기
    for i, line in enumerate(lines):
        if 'json.dumps(item' in line:
            print(f'라인 {i+1}: {line.strip()}')
            # 앞뒤 몇 줄도 출력
            for j in range(-2, 3):
                if 0 <= i+j < len(lines):
                    print(f'라인 {i+j+1}: {lines[i+j].strip()}')
            break

if __name__ == "__main__":
    asyncio.run(check_actual_query())