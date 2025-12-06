#!/usr/bin/env python3
"""
외부 검사 항목 전체 조회 및 테이블 출력
"""
import asyncio
import asyncpg

DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

async def list_all_external_checkup():
    """외부 검사 항목 전체 조회 및 테이블 출력"""
    
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("=" * 150)
        print("외부 검사 항목 전체 목록")
        print("=" * 150)
        
        # 모든 외부 검사 항목 조회
        all_items = await conn.fetch("""
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
            WHERE is_active = true
            ORDER BY category, sub_category, difficulty_level, item_name
        """)
        
        if not all_items:
            print("\n⚠️  외부 검사 항목이 없습니다.\n")
            return
        
        print(f"\n총 {len(all_items)}개 항목 발견\n")
        
        # 테이블 형태로 출력
        print("=" * 150)
        print("테이블 형태 출력")
        print("=" * 150)
        print()
        
        # 헤더 출력
        header = f"{'ID':<5} | {'카테고리':<10} | {'세부분류':<20} | {'검진명':<35} | {'난이도':<8} | {'추천대상':<30}"
        print(header)
        print("-" * 150)
        
        # 데이터 출력
        for item in all_items:
            item_id = str(item.get('id', ''))
            category = item.get('category', '')[:10]
            sub_category = (item.get('sub_category') or '')[:20]
            item_name = item.get('item_name', '')[:35]
            difficulty = item.get('difficulty_level', '')
            difficulty_label = {
                'Low': '부담없는',
                'Mid': '추천',
                'High': '프리미엄'
            }.get(difficulty, difficulty)
            target = (item.get('target') or item.get('target_trigger') or '')[:30]
            
            row = f"{item_id:<5} | {category:<10} | {sub_category:<20} | {item_name:<35} | {difficulty_label:<8} | {target:<30}"
            print(row)
        
        # 상세 정보 출력
        print("\n" + "=" * 150)
        print("상세 정보")
        print("=" * 150)
        
        for idx, item in enumerate(all_items, 1):
            print(f"\n[{idx}] {item.get('item_name', 'N/A')}")
            print("-" * 150)
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
        
        # 통계 출력
        print("\n" + "=" * 150)
        print("통계")
        print("=" * 150)
        
        # 카테고리별 통계
        category_stats = {}
        difficulty_stats = {'Low': 0, 'Mid': 0, 'High': 0}
        
        for item in all_items:
            cat = item.get('category', '미분류')
            if cat not in category_stats:
                category_stats[cat] = 0
            category_stats[cat] += 1
            
            difficulty = item.get('difficulty_level', '')
            if difficulty in difficulty_stats:
                difficulty_stats[difficulty] += 1
        
        print(f"\n총 항목 수: {len(all_items)}개")
        print(f"\n카테고리별 통계:")
        for cat, count in sorted(category_stats.items()):
            print(f"  - {cat}: {count}개")
        
        print(f"\n난이도별 통계:")
        print(f"  - Low (부담없는): {difficulty_stats['Low']}개")
        print(f"  - Mid (추천): {difficulty_stats['Mid']}개")
        print(f"  - High (프리미엄): {difficulty_stats['High']}개")
        
        print("\n" + "=" * 150)
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            await conn.close()

if __name__ == "__main__":
    asyncio.run(list_all_external_checkup())

