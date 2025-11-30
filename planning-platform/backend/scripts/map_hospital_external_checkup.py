#!/usr/bin/env python3
"""
병원별 외부 검사 매핑 스크립트
병원에 외부 검사 항목을 매핑하는 예시 스크립트
"""
import asyncio
import asyncpg
import json

DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

async def map_hospital_external_checkup(hospital_id: str, item_names: list, display_order: int = 0):
    """
    병원에 외부 검사 항목 매핑
    
    Args:
        hospital_id: 병원 ID
        item_names: 매핑할 검사명 리스트
        display_order: 표시 순서 시작 번호
    """
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("=" * 80)
        print(f"병원별 외부 검사 매핑: {hospital_id}")
        print("=" * 80)
        
        # 병원 존재 확인
        hospital = await conn.fetchrow(
            "SELECT hospital_id, hospital_name FROM wello.wello_hospitals WHERE hospital_id = $1",
            hospital_id
        )
        
        if not hospital:
            print(f"❌ 병원을 찾을 수 없습니다: {hospital_id}")
            return
        
        print(f"✅ 병원 확인: {hospital['hospital_name']}")
        
        mapped_count = 0
        skipped_count = 0
        
        for idx, item_name in enumerate(item_names, start=display_order):
            try:
                # 검사 항목 ID 조회
                item = await conn.fetchrow(
                    "SELECT id FROM wello.wello_external_checkup_items WHERE item_name = $1 AND is_active = true",
                    item_name
                )
                
                if not item:
                    print(f"⏭️  건너뜀: {item_name} (검사 항목을 찾을 수 없음)")
                    skipped_count += 1
                    continue
                
                item_id = item['id']
                
                # 중복 체크
                existing = await conn.fetchrow(
                    "SELECT id FROM wello.wello_hospital_external_checkup_mapping WHERE hospital_id = $1 AND external_checkup_item_id = $2",
                    hospital_id, item_id
                )
                
                if existing:
                    print(f"⏭️  건너뜀: {item_name} (이미 매핑됨)")
                    skipped_count += 1
                    continue
                
                # 매핑 생성
                await conn.execute("""
                    INSERT INTO wello.wello_hospital_external_checkup_mapping 
                    (hospital_id, external_checkup_item_id, is_active, display_order)
                    VALUES ($1, $2, $3, $4)
                """,
                    hospital_id,
                    item_id,
                    True,
                    idx
                )
                
                mapped_count += 1
                print(f"✅ 매핑 완료: {item_name} (순서: {idx})")
                
            except Exception as e:
                print(f"❌ 오류 발생 ({item_name}): {e}")
        
        print("\n" + "=" * 80)
        print(f"매핑 완료: {mapped_count}개, 건너뜀: {skipped_count}개")
        print("=" * 80)
        
        # 매핑된 항목 조회
        mapped_items = await conn.fetch("""
            SELECT 
                m.id,
                m.display_order,
                e.item_name,
                e.category,
                e.sub_category,
                e.difficulty_level
            FROM wello.wello_hospital_external_checkup_mapping m
            JOIN wello.wello_external_checkup_items e ON m.external_checkup_item_id = e.id
            WHERE m.hospital_id = $1 AND m.is_active = true
            ORDER BY m.display_order
        """, hospital_id)
        
        if mapped_items:
            print(f"\n📋 매핑된 항목 목록 ({len(mapped_items)}개):")
            for item in mapped_items:
                badge = {
                    'Low': '부담없는',
                    'Mid': '추천',
                    'High': '프리미엄'
                }.get(item['difficulty_level'], item['difficulty_level'])
                print(f"  [{item['display_order']}] {item['item_name']} ({item['category']} - {badge})")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            await conn.close()

async def list_all_external_checkup_items():
    """모든 외부 검사 항목 목록 출력"""
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        items = await conn.fetch("""
            SELECT id, category, sub_category, item_name, difficulty_level
            FROM wello.wello_external_checkup_items
            WHERE is_active = true
            ORDER BY category, sub_category, item_name
        """)
        
        print("=" * 80)
        print("외부 검사 항목 전체 목록")
        print("=" * 80)
        
        current_category = None
        for item in items:
            if current_category != item['category']:
                current_category = item['category']
                print(f"\n[{current_category}]")
            
            badge = {
                'Low': '부담없는',
                'Mid': '추천',
                'High': '프리미엄'
            }.get(item['difficulty_level'], item['difficulty_level'])
            
            print(f"  - {item['item_name']} ({item['sub_category']}) [{badge}]")
        
        print(f"\n총 {len(items)}개 항목")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
    finally:
        if conn:
            await conn.close()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("사용법:")
        print("  1. 전체 목록 보기: python map_hospital_external_checkup.py list")
        print("  2. 병원 매핑: python map_hospital_external_checkup.py map <hospital_id> <item_name1> <item_name2> ...")
        print("\n예시:")
        print("  python map_hospital_external_checkup.py list")
        print("  python map_hospital_external_checkup.py map KIM_HW_CLINIC '얼리텍 (대장암)' '아이파인더/아이스크린'")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "list":
        asyncio.run(list_all_external_checkup_items())
    elif command == "map":
        if len(sys.argv) < 3:
            print("❌ 병원 ID가 필요합니다")
            sys.exit(1)
        
        hospital_id = sys.argv[2]
        item_names = sys.argv[3:] if len(sys.argv) > 3 else []
        
        asyncio.run(map_hospital_external_checkup(hospital_id, item_names))
    else:
        print(f"❌ 알 수 없는 명령어: {command}")

