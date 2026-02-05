#!/usr/bin/env python3
"""
실제 실행되는 save_health_data 함수 코드 확인
"""
import sys
import os
import inspect

# 경로 추가
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.services.welno_data_service import WelnoDataService

def check_actual_function():
    """실제 실행되는 함수 코드 확인"""
    
    print("=== 실제 실행되는 save_health_data 함수 확인 ===")
    
    # WelnoDataService 인스턴스 생성
    service = WelnoDataService()
    
    # save_health_data 함수 정보
    func = service.save_health_data
    
    print(f"함수명: {func.__name__}")
    print(f"모듈: {func.__module__}")
    print(f"파일 위치: {inspect.getfile(func)}")
    
    # 함수 소스 코드 확인
    try:
        source_lines = inspect.getsourcelines(func)
        print(f"\\n함수 소스 코드 (처음 30줄):")
        for i, line in enumerate(source_lines[0][:30], 1):
            print(f"{i:3d}: {line.rstrip()}")
        
        if len(source_lines[0]) > 30:
            print(f"... (총 {len(source_lines[0])}줄)")
            
        # INSERT 쿼리 부분 찾기
        print("\\n=== INSERT 쿼리 부분 찾기 ===")
        for i, line in enumerate(source_lines[0], 1):
            if "INSERT INTO welno.welno_checkup_data" in line:
                print(f"INSERT 쿼리 시작 라인 {i}:")
                # 다음 10줄 출력
                for j in range(max(0, i-1), min(len(source_lines[0]), i+10)):
                    print(f"{j+1:3d}: {source_lines[0][j].rstrip()}")
                break
        
        # conn.execute 부분 찾기
        print("\\n=== conn.execute 부분 찾기 ===")
        for i, line in enumerate(source_lines[0], 1):
            if "conn.execute" in line and "insert_query" in line:
                print(f"conn.execute 라인 {i}:")
                # 앞뒤 5줄 출력
                for j in range(max(0, i-5), min(len(source_lines[0]), i+5)):
                    marker = ">>> " if j == i-1 else "    "
                    print(f"{marker}{j+1:3d}: {source_lines[0][j].rstrip()}")
                break
                
    except Exception as e:
        print(f"소스 코드 확인 실패: {e}")
    
    # 함수 시그니처 확인
    print(f"\\n함수 시그니처: {inspect.signature(func)}")
    
    # 클래스 정보
    print(f"\\n클래스: {service.__class__}")
    print(f"클래스 모듈: {service.__class__.__module__}")
    print(f"클래스 파일: {inspect.getfile(service.__class__)}")

if __name__ == "__main__":
    check_actual_function()