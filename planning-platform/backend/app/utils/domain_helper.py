"""
동적 도메인 감지 유틸리티
로컬/배포 환경에 따라 자동으로 올바른 도메인 반환
"""

from fastapi import Request
import os
from typing import Optional


def get_dynamic_domain(request: Optional[Request] = None) -> str:
    """
    요청 기반 동적 도메인 반환
    
    Args:
        request: FastAPI Request 객체
        
    Returns:
        str: 환경에 맞는 도메인 (http://localhost:9282 또는 https://report.kindhabit.com)
    """
    
    # 1. 환경변수 우선 (배포 시 명시적 설정)
    if domain := os.getenv('SERVICE_DOMAIN'):
        return domain
    
    # 2. 요청 헤더에서 추출
    if request:
        host = request.headers.get('host', 'localhost:9282')
        
        # 로컬 환경 감지 패턴
        local_indicators = [
            'localhost',
            '127.0.0.1', 
            '10.0.0.',
            '192.168.',
            '172.16.',
            '172.17.',  # Docker 네트워크
            '172.22.'   # Docker Compose 네트워크
        ]
        
        # 로컬 환경인지 확인
        is_local = any(indicator in host for indicator in local_indicators)
        
        if is_local:
            # 로컬 환경: HTTP 사용
            return f"http://{host}"
        else:
            # 배포 환경: HTTPS 강제
            return f"https://{host}"
    
    # 3. 기본값 (운영 환경)
    return "https://report.kindhabit.com"


def get_frontend_domain(request: Optional[Request] = None) -> str:
    """
    프론트엔드 도메인 반환 (백엔드와 포트가 다를 수 있음)
    
    Args:
        request: FastAPI Request 객체
        
    Returns:
        str: 프론트엔드 도메인
    """
    
    # 환경변수 우선
    if domain := os.getenv('FRONTEND_DOMAIN'):
        return domain
    
    # 요청 기반 감지
    if request:
        host = request.headers.get('host', 'localhost:9282')
        
        # 로컬 환경 감지
        local_indicators = ['localhost', '127.0.0.1', '10.0.0.', '192.168.']
        is_local = any(indicator in host for indicator in local_indicators)
        
        if is_local:
            # 로컬: 프론트엔드 포트로 변경 (8082 → 9282)
            if ':8082' in host:
                host = host.replace(':8082', ':9282')
            return f"http://{host}"
        else:
            # 배포: 동일 도메인
            return f"https://{host}"
    
    # 기본값
    return "https://report.kindhabit.com"


def is_local_environment(request: Optional[Request] = None) -> bool:
    """
    로컬 환경 여부 확인
    
    Args:
        request: FastAPI Request 객체
        
    Returns:
        bool: 로컬 환경이면 True
    """
    
    # 환경변수 확인
    if os.getenv('ENVIRONMENT') == 'development':
        return True
    
    # 요청 헤더 확인
    if request:
        host = request.headers.get('host', '')
        local_indicators = ['localhost', '127.0.0.1', '10.0.0.', '192.168.']
        return any(indicator in host for indicator in local_indicators)
    
    return False