#!/usr/bin/env python3
"""
save_health_data 함수 전체 소스 코드 출력
"""
import sys
import os
import inspect

# 경로 추가
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.services.welno_data_service import WelnoDataService

def show_full_function():
    """save_health_data 함수 전체 소스 코드 출력"""
    
    print("=== save_health_data 함수 전체 소스 코드 ===")
    
    # WelnoDataService 인스턴스 생성
    service = WelnoDataService()
    
    # save_health_data 함수 정보
    func = service.save_health_data
    
    # 함수 소스 코드 확인
    try:
        source_lines = inspect.getsourcelines(func)
        print(f"총 {len(source_lines[0])}줄:")
        print("=" * 80)
        
        for i, line in enumerate(source_lines[0], 1):
            print(f"{i:3d}: {line.rstrip()}")
            
    except Exception as e:
        print(f"소스 코드 확인 실패: {e}")

if __name__ == "__main__":
    show_full_function()