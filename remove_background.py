#!/usr/bin/env python3
"""
이미지 배경 제거 스크립트 (개선 버전)
rembg 라이브러리를 사용하여 PNG 이미지의 배경을 제거합니다.
여러 모델과 옵션을 시도하여 최적의 결과를 얻습니다.
"""

import os
import sys
from pathlib import Path

try:
    from rembg import remove, new_session
    from PIL import Image
    import numpy as np
except ImportError:
    print("필요한 라이브러리가 설치되지 않았습니다.")
    print("다음 명령어로 설치해주세요:")
    print("  pip install rembg[new] pillow numpy")
    sys.exit(1)


def remove_background_advanced(input_path, output_path=None, model_name='isnet-general-use', alpha_matting=True):
    """
    이미지의 배경을 제거합니다 (고급 옵션 사용).
    
    Args:
        input_path: 입력 이미지 경로
        output_path: 출력 이미지 경로 (None이면 원본 파일명에 _nobg 추가)
        model_name: 사용할 모델 ('u2net', 'u2netp', 'silueta', 'isnet-general-use', 'sam')
        alpha_matting: 알파 매팅 사용 여부 (더 정교한 엣지 처리)
    """
    input_path = Path(input_path)
    
    if not input_path.exists():
        print(f"파일을 찾을 수 없습니다: {input_path}")
        return False
    
    if output_path is None:
        # 원본 파일명에 _nobg 추가
        output_path = input_path.parent / f"{input_path.stem}_nobg{input_path.suffix}"
    else:
        output_path = Path(output_path)
    
    try:
        print(f"처리 중: {input_path.name} -> {output_path.name}")
        print(f"  모델: {model_name}, 알파 매팅: {alpha_matting}")
        
        # 세션 생성 (모델 로드)
        session = new_session(model_name)
        
        # 이미지 읽기
        with open(input_path, 'rb') as input_file:
            input_data = input_file.read()
        
        # 알파 매팅 옵션 설정
        alpha_matting_params = None
        if alpha_matting:
            alpha_matting_params = {
                'foreground_threshold': 240,
                'background_threshold': 10,
                'erode_structure_size': 10,
                'base_size': 1000
            }
        
        # 배경 제거
        output_data = remove(
            input_data,
            session=session,
            alpha_matting=alpha_matting,
            alpha_matting_foreground_threshold=alpha_matting_params['foreground_threshold'] if alpha_matting_params else 240,
            alpha_matting_background_threshold=alpha_matting_params['background_threshold'] if alpha_matting_params else 10,
            alpha_matting_erode_structure_size=alpha_matting_params['erode_structure_size'] if alpha_matting_params else 10,
            alpha_matting_base_size=alpha_matting_params['base_size'] if alpha_matting_params else 1000
        )
        
        # 결과 저장
        with open(output_path, 'wb') as output_file:
            output_file.write(output_data)
        
        print(f"완료: {output_path}")
        return True
        
    except Exception as e:
        print(f"오류 발생 ({input_path.name}): {str(e)}")
        return False


def remove_background_simple(input_path, output_path=None):
    """
    간단한 배경 제거 (기본 모델 사용).
    """
    return remove_background_advanced(input_path, output_path, model_name='u2net', alpha_matting=False)


def main():
    # 작업 디렉토리 설정 (절대 경로 사용)
    images_dir = Path("/home/workspace/PROJECT_WELLO_BEFE/planning-platform/frontend/src/assets/images/gamgam")
    
    # 원본 파일만 찾기 (_nobg가 없는 파일)
    all_png_files = [f for f in images_dir.glob("*.png") if "_nobg" not in f.name]
    
    if not all_png_files:
        print(f"처리할 PNG 파일을 찾을 수 없습니다: {images_dir}")
        return
    
    print(f"발견된 PNG 파일: {len(all_png_files)}개")
    for f in all_png_files:
        print(f"  - {f.name}")
    
    print("=" * 50)
    print("이미지 배경 제거 스크립트 (개선 버전)")
    print("=" * 50)
    print()
    
    success_count = 0
    fail_count = 0
    
    # 각 파일별로 최적의 모델 선택
    for img_file in all_png_files:
        input_path = img_file
        
        # 의자.png는 더 정교한 모델 사용
        if "의자" in img_file.name:
            print(f"\n[의자.png - 고급 모델 사용]")
            result = remove_background_advanced(
                input_path, 
                model_name='isnet-general-use',
                alpha_matting=True
            )
        else:
            # 다른 파일들은 기본 모델 사용
            result = remove_background_advanced(
                input_path,
                model_name='isnet-general-use',
                alpha_matting=True
            )
        
        if result:
            success_count += 1
        else:
            fail_count += 1
        print()
    
    print("=" * 50)
    print(f"처리 완료: 성공 {success_count}개, 실패 {fail_count}개")
    print("=" * 50)
    
    if success_count > 0:
        print("\n결과 파일은 원본 파일과 같은 폴더에 '_nobg' 접미사가 추가된 이름으로 저장됩니다.")
        print(f"저장 위치: {images_dir}")
        print("\n참고: 기존 _nobg 파일은 덮어씌워집니다.")


if __name__ == "__main__":
    main()

