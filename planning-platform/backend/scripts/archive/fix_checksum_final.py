#!/usr/bin/env python3
"""
체크섬 수정 스크립트
"""
import json
import hashlib
import os

def fix_checksum(file_path):
    """파일의 체크섬을 수정"""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # raw_data의 체크섬 계산
    raw_data = data.get('raw_data', {})
    raw_data_str = json.dumps(raw_data, ensure_ascii=False, separators=(',', ':'))
    new_checksum = hashlib.sha256(raw_data_str.encode('utf-8')).hexdigest()
    
    # 메타데이터의 체크섬 업데이트
    if 'metadata' in data:
        old_checksum = data['metadata'].get('checksum', 'N/A')
        data['metadata']['checksum'] = new_checksum
        
        print(f"파일: {os.path.basename(file_path)}")
        print(f"  기존 체크섬: {old_checksum[:16]}...")
        print(f"  새로운 체크섬: {new_checksum[:16]}...")
        
        # 파일 저장
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"  ✅ 체크섬 수정 완료")
    else:
        print(f"❌ 메타데이터가 없습니다: {file_path}")

if __name__ == "__main__":
    pending_dir = "/home/workspace/PROJECT_WELLO_BEFE/tilko_data/pending"
    
    for filename in os.listdir(pending_dir):
        if filename.endswith('.json'):
            file_path = os.path.join(pending_dir, filename)
            fix_checksum(file_path)
    
    print("\n✅ 모든 파일의 체크섬 수정 완료")