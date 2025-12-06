#!/usr/bin/env python3
"""
데이터베이스의 카테고리 목록 확인
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

async def check_categories():
    """카테고리 목록 확인"""
    
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("=" * 80)
        print("카테고리 목록 확인")
        print("=" * 80)
        
        # 모든 카테고리 조회
        categories = await conn.fetch("""
            SELECT DISTINCT category, COUNT(*) as count
            FROM wello.wello_external_checkup_items
            WHERE is_active = true
            GROUP BY category
            ORDER BY category
        """)
        
        if not categories:
            print("\n⚠️  카테고리가 없습니다.\n")
            return
        
        print(f"\n총 {len(categories)}개 카테고리 발견\n")
        
        for cat in categories:
            print(f"  - {cat['category']}: {cat['count']}개")
        
        # 모든 항목의 카테고리와 세부분류 확인
        print("\n" + "=" * 80)
        print("전체 항목 목록 (카테고리별)")
        print("=" * 80)
        
        all_items = await conn.fetch("""
            SELECT 
                id,
                category,
                sub_category,
                item_name,
                difficulty_level
            FROM wello.wello_external_checkup_items
            WHERE is_active = true
            ORDER BY category, sub_category, item_name
        """)
        
        if all_items:
            current_category = None
            for item in all_items:
                if current_category != item['category']:
                    current_category = item['category']
                    print(f"\n[{current_category}]")
                    print("-" * 80)
                print(f"  - {item['item_name']} (세부분류: {item['sub_category'] or '없음'}, 난이도: {item['difficulty_level']})")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            await conn.close()

if __name__ == "__main__":
    asyncio.run(check_categories())

