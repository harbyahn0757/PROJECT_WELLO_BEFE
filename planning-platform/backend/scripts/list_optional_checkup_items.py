#!/usr/bin/env python3
"""
옵셔널 검진 항목 조회 스크립트
데이터베이스에서 category가 'optional'인 검진 항목들을 테이블 형태로 출력
"""
import asyncio
import asyncpg
from tabulate import tabulate

DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

async def list_optional_checkup_items():
    """옵셔널 검진 항목 조회 및 테이블 출력"""
    
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("=" * 120)
        print("옵셔널 검진 항목 조회")
        print("=" * 120)
        
        # 옵셔널 검진 항목 조회
        optional_items = await conn.fetch("""
            SELECT 
                id,
                category,
                sub_category,
                item_name,
                item_name_en,
                difficulty_level,
                target_trigger,
                gap_description,
                solution_narrative,
                description,
                manufacturer,
                target,
                input_sample,
                algorithm_class,
                is_active,
                created_at,
                updated_at
            FROM wello.wello_external_checkup_items
            WHERE category = 'optional' AND is_active = true
            ORDER BY sub_category, difficulty_level, item_name
        """)
        
        if not optional_items:
            print("\n⚠️  옵셔널 검진 항목이 없습니다.\n")
            return
        
        print(f"\n총 {len(optional_items)}개 항목 발견\n")
        
        # 테이블 형태로 출력할 데이터 준비
        table_data = []
        for item in optional_items:
            table_data.append([
                item.get('id', ''),
                item.get('item_name', ''),
                item.get('sub_category', ''),
                item.get('difficulty_level', ''),
                item.get('target', '') or item.get('target_trigger', '')[:50] if item.get('target_trigger') else '',
                item.get('gap_description', '')[:80] if item.get('gap_description') else '',
                item.get('solution_narrative', '')[:80] if item.get('solution_narrative') else '',
                item.get('description', '')[:60] if item.get('description') else '',
            ])
        
        # 테이블 헤더
        headers = [
            'ID',
            '검진명',
            '세부분류',
            '난이도',
            '추천대상',
            '결핍/한계 (Gap)',
            '설득논리 (Solution)',
            '설명'
        ]
        
        # 테이블 출력
        print(tabulate(table_data, headers=headers, tablefmt='grid', maxcolwidths=[5, 25, 15, 8, 20, 25, 25, 20]))
        
        # 상세 정보 출력 (긴 텍스트 포함)
        print("\n" + "=" * 120)
        print("상세 정보")
        print("=" * 120)
        
        for idx, item in enumerate(optional_items, 1):
            print(f"\n[{idx}] {item.get('item_name', 'N/A')}")
            print("-" * 120)
            print(f"  ID: {item.get('id', 'N/A')}")
            print(f"  카테고리: {item.get('category', 'N/A')}")
            if item.get('sub_category'):
                print(f"  세부분류: {item.get('sub_category')}")
            if item.get('item_name_en'):
                print(f"  영문명: {item.get('item_name_en')}")
            print(f"  난이도: {item.get('difficulty_level', 'N/A')} ({'부담없는' if item.get('difficulty_level') == 'Low' else '추천' if item.get('difficulty_level') == 'Mid' else '프리미엄' if item.get('difficulty_level') == 'High' else 'N/A'})")
            if item.get('target'):
                print(f"  검사 대상: {item.get('target')}")
            if item.get('target_trigger'):
                print(f"  추천 대상 (Trigger): {item.get('target_trigger')}")
            if item.get('gap_description'):
                print(f"  결핍/한계 (Gap): {item.get('gap_description')}")
            if item.get('solution_narrative'):
                print(f"  설득 논리 (Solution): {item.get('solution_narrative')}")
            if item.get('description'):
                print(f"  설명: {item.get('description')}")
            if item.get('manufacturer'):
                print(f"  제조사: {item.get('manufacturer')}")
            if item.get('input_sample'):
                print(f"  입력 샘플: {item.get('input_sample')}")
            if item.get('algorithm_class'):
                print(f"  알고리즘 클래스: {item.get('algorithm_class')}")
            print(f"  활성화: {'예' if item.get('is_active') else '아니오'}")
            if item.get('created_at'):
                print(f"  생성일: {item.get('created_at')}")
            if item.get('updated_at'):
                print(f"  수정일: {item.get('updated_at')}")
        
        # 통계 출력
        print("\n" + "=" * 120)
        print("통계")
        print("=" * 120)
        
        # 세부분류별 통계
        sub_category_stats = {}
        difficulty_stats = {'Low': 0, 'Mid': 0, 'High': 0}
        
        for item in optional_items:
            sub_cat = item.get('sub_category', '미분류')
            if sub_cat not in sub_category_stats:
                sub_category_stats[sub_cat] = 0
            sub_category_stats[sub_cat] += 1
            
            difficulty = item.get('difficulty_level', '')
            if difficulty in difficulty_stats:
                difficulty_stats[difficulty] += 1
        
        print(f"\n총 항목 수: {len(optional_items)}개")
        print(f"\n세부분류별 통계:")
        for sub_cat, count in sorted(sub_category_stats.items()):
            print(f"  - {sub_cat}: {count}개")
        
        print(f"\n난이도별 통계:")
        print(f"  - Low (부담없는): {difficulty_stats['Low']}개")
        print(f"  - Mid (추천): {difficulty_stats['Mid']}개")
        print(f"  - High (프리미엄): {difficulty_stats['High']}개")
        
        print("\n" + "=" * 120)
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            await conn.close()

if __name__ == "__main__":
    asyncio.run(list_optional_checkup_items())

