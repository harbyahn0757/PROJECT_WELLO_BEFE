#!/usr/bin/env python3
"""
checkup_design 디렉토리의 미사용 파일 점검 스크립트
"""
import os
import re
from pathlib import Path
from typing import Set, Dict, List

# 점검 대상 디렉토리
TARGET_DIR = Path("/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/app/services/checkup_design")
BACKEND_DIR = Path("/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend")

def find_python_files(directory: Path) -> List[Path]:
    """디렉토리 내 모든 Python 파일 찾기"""
    python_files = []
    for root, dirs, files in os.walk(directory):
        # __pycache__ 제외
        dirs[:] = [d for d in dirs if d != '__pycache__']
        for file in files:
            if file.endswith('.py'):
                python_files.append(Path(root) / file)
    return python_files

def extract_imports(file_path: Path) -> Set[str]:
    """파일에서 import 문 추출"""
    imports = set()
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
            # from ... import ... 패턴
            from_imports = re.findall(r'from\s+([^\s]+)\s+import', content)
            imports.update(from_imports)
            
            # import ... 패턴
            direct_imports = re.findall(r'^import\s+([^\s]+)', content, re.MULTILINE)
            imports.update(direct_imports)
            
    except Exception as e:
        print(f"⚠️  파일 읽기 실패: {file_path} - {e}")
    
    return imports

def check_file_usage():
    """파일 사용 여부 점검"""
    
    # checkup_design 디렉토리의 모든 파일
    checkup_design_files = find_python_files(TARGET_DIR)
    
    # 백엔드 전체에서 import 패턴 검색
    backend_files = find_python_files(BACKEND_DIR)
    
    print("=" * 100)
    print("checkup_design 디렉토리 파일 사용 여부 점검")
    print("=" * 100)
    print()
    
    # 각 파일별 사용 여부 확인
    file_usage = {}
    
    for file_path in checkup_design_files:
        file_name = file_path.name
        relative_path = file_path.relative_to(BACKEND_DIR)
        module_path = str(relative_path).replace('/', '.').replace('.py', '')
        
        # __init__.py는 제외
        if file_name == '__init__.py':
            continue
        
        # 사용 여부 확인
        is_used = False
        used_in = []
        
        for backend_file in backend_files:
            if backend_file == file_path:
                continue
            
            try:
                with open(backend_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                    # 모듈 경로로 검색
                    patterns = [
                        f'from {module_path}',
                        f'import {module_path}',
                        f'from .{file_name.replace(".py", "")}',
                        f'from ..{file_name.replace(".py", "")}',
                    ]
                    
                    # 파일명으로도 검색 (상대 import)
                    if any(pattern in content for pattern in patterns):
                        is_used = True
                        used_in.append(str(backend_file.relative_to(BACKEND_DIR)))
                        
            except Exception:
                pass
        
        file_usage[file_name] = {
            'path': str(relative_path),
            'is_used': is_used,
            'used_in': used_in
        }
    
    # 결과 출력
    print("📋 파일별 사용 여부:")
    print("-" * 100)
    
    unused_files = []
    used_files = []
    
    for file_name, info in sorted(file_usage.items()):
        status = "✅ 사용됨" if info['is_used'] else "❌ 미사용"
        print(f"\n{status} | {file_name}")
        print(f"  경로: {info['path']}")
        
        if info['is_used']:
            used_files.append(file_name)
            if info['used_in']:
                print(f"  사용 위치:")
                for location in info['used_in'][:5]:  # 최대 5개만 표시
                    print(f"    - {location}")
                if len(info['used_in']) > 5:
                    print(f"    ... 외 {len(info['used_in']) - 5}개")
        else:
            unused_files.append(file_name)
    
    # 백업 파일 확인
    print("\n" + "=" * 100)
    print("📁 백업 파일 확인:")
    print("-" * 100)
    
    backup_files = [f for f in checkup_design_files if '.bak' in f.name]
    if backup_files:
        for backup_file in backup_files:
            print(f"❌ 백업 파일: {backup_file.name}")
            print(f"  경로: {backup_file.relative_to(BACKEND_DIR)}")
    else:
        print("✅ 백업 파일 없음")
    
    # 요약
    print("\n" + "=" * 100)
    print("📊 요약:")
    print("-" * 100)
    print(f"총 파일 수: {len(file_usage)}개")
    print(f"사용 중: {len(used_files)}개")
    print(f"미사용: {len(unused_files)}개")
    print(f"백업 파일: {len(backup_files)}개")
    
    if unused_files:
        print(f"\n⚠️  미사용 파일 목록:")
        for file_name in unused_files:
            print(f"  - {file_name}")
    
    if backup_files:
        print(f"\n⚠️  백업 파일 목록:")
        for backup_file in backup_files:
            print(f"  - {backup_file.name}")
    
    print("\n" + "=" * 100)

if __name__ == "__main__":
    check_file_usage()


