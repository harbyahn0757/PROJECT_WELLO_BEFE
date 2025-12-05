#!/usr/bin/env python3
"""
데이터베이스에 저장된 검사 항목 데이터 목록 출력 스크립트
(하드코딩된 데이터가 아닌 데이터베이스에서 조회)
"""
import asyncio
import asyncpg
import json
from typing import Dict, Any, List

DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

async def list_database_checkup_items():
    """데이터베이스에 저장된 검사 항목 목록 출력"""
    
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("=" * 100)
        print("데이터베이스에 저장된 검사 항목 데이터 목록")
        print("=" * 100)
        
        # 1. 외부 검사 항목 (wello_external_checkup_items 테이블)
        print("\n" + "=" * 100)
        print("📋 1. 외부 검사 항목 (wello_external_checkup_items)")
        print("=" * 100)
        
        external_checkup_items = await conn.fetch("""
            SELECT 
                id, category, sub_category, item_name, item_name_en,
                difficulty_level, target_trigger, gap_description,
                solution_narrative, description, manufacturer, target,
                input_sample, algorithm_class
            FROM wello.wello_external_checkup_items
            WHERE is_active = true
            ORDER BY category, difficulty_level, item_name
        """)
        
        if not external_checkup_items:
            print("⚠️  외부 검사 항목이 없습니다.\n")
            external_count = 0
        else:
            print(f"총 {len(external_checkup_items)}개 항목\n")
            external_count = len(external_checkup_items)
            
            # 카테고리별 그룹화
            categories = {}
            for item in external_checkup_items:
                category = item.get('category', '미분류')
                if category not in categories:
                    categories[category] = {}
                difficulty = item.get('difficulty_level', 'Unknown')
                if difficulty not in categories[category]:
                    categories[category][difficulty] = []
                categories[category][difficulty].append(item)
            
            for category in sorted(categories.keys()):
                category_items = categories[category]
                total_count = sum(len(items) for items in category_items.values())
                print(f"\n  📁 카테고리: {category} (총 {total_count}개)")
                print("  " + "-" * 96)
                
                # 난이도별로 정렬 (High -> Mid -> Low)
                difficulty_order = ['High', 'Mid', 'Low']
                for difficulty in difficulty_order:
                    if difficulty in category_items:
                        items = category_items[difficulty]
                        difficulty_label = {
                            'High': '프리미엄',
                            'Mid': '추천',
                            'Low': '부담없는'
                        }.get(difficulty, difficulty)
                        
                        print(f"\n    🔸 난이도: {difficulty} ({difficulty_label}) - {len(items)}개")
                        print("    " + "-" * 92)
                        
                        for idx, item in enumerate(items, 1):
                            item_name = item.get('item_name', 'N/A')
                            sub_category = item.get('sub_category', '')
                            target_trigger = item.get('target_trigger', '')
                            target = item.get('target', '')
                            
                            print(f"      {idx}. {item_name}")
                            if sub_category:
                                print(f"         세부분류: {sub_category}")
                            if target:
                                print(f"         검사 대상: {target}")
                            if target_trigger:
                                print(f"         추천 대상: {target_trigger}")
                            print()
        
        # 2. 병원 추천 항목 (wello_hospitals.recommended_items JSONB)
        print("=" * 100)
        print("📋 2. 병원 추천 항목 (wello_hospitals.recommended_items)")
        print("=" * 100)
        
        hospitals = await conn.fetch("""
            SELECT hospital_id, hospital_name, recommended_items
            FROM wello.wello_hospitals
            WHERE recommended_items IS NOT NULL 
              AND recommended_items != 'null'::jsonb
              AND recommended_items != '[]'::jsonb
              AND is_active = true
            ORDER BY hospital_name
        """)
        
        if not hospitals:
            print("⚠️  병원 추천 항목이 없습니다.\n")
            recommended_count = 0
        else:
            all_recommended_items = []
            for hospital in hospitals:
                recommended_items_raw = hospital.get('recommended_items')
                if recommended_items_raw:
                    if isinstance(recommended_items_raw, str):
                        recommended_items = json.loads(recommended_items_raw)
                    elif isinstance(recommended_items_raw, (list, dict)):
                        recommended_items = recommended_items_raw if isinstance(recommended_items_raw, list) else [recommended_items_raw]
                    else:
                        recommended_items = []
                    
                    for item in recommended_items:
                        if isinstance(item, dict):
                            item['hospital_id'] = hospital['hospital_id']
                            item['hospital_name'] = hospital['hospital_name']
                            all_recommended_items.append(item)
            
            if all_recommended_items:
                print(f"총 {len(all_recommended_items)}개 항목 (병원별 집계)\n")
                recommended_count = len(all_recommended_items)
                
                # 카테고리별 그룹화
                categories = {}
                for item in all_recommended_items:
                    category = item.get('category', '미분류')
                    if category not in categories:
                        categories[category] = []
                    categories[category].append(item)
                
                for category, items in sorted(categories.items()):
                    print(f"\n    📁 카테고리: {category} ({len(items)}개)")
                    print("    " + "-" * 92)
                    for idx, item in enumerate(items, 1):
                        name = item.get('name', 'N/A')
                        description = item.get('description', '')
                        target_conditions = item.get('target_conditions', [])
                        upselling_priority = item.get('upselling_priority', 'N/A')
                        meaning = item.get('meaning', '')
                        hospital_name = item.get('hospital_name', '')
                        
                        print(f"      {idx}. {name}")
                        if hospital_name:
                            print(f"         병원: {hospital_name}")
                        if description:
                            print(f"         설명: {description}")
                        if meaning:
                            print(f"         의미: {meaning}")
                        if target_conditions:
                            if isinstance(target_conditions, list):
                                print(f"         추천 대상: {', '.join(target_conditions)}")
                            else:
                                print(f"         추천 대상: {target_conditions}")
                        if upselling_priority != 'N/A':
                            print(f"         업셀링 우선순위: {upselling_priority}")
                        print()
            else:
                print("⚠️  병원 추천 항목이 없습니다.\n")
                recommended_count = 0
        
        # 3. 통계 요약
        print("=" * 100)
        print("📊 통계 요약")
        print("=" * 100)
        
        print(f"\n  외부 검사 항목 (DB): {external_count}개")
        print(f"  병원 추천 항목 (DB): {recommended_count}개")
        print(f"  총계: {external_count + recommended_count}개\n")
        
        if external_count > 0:
            # 난이도별 통계
            difficulty_stats = await conn.fetchrow("""
                SELECT 
                    COUNT(*) FILTER (WHERE difficulty_level = 'Low') as low_count,
                    COUNT(*) FILTER (WHERE difficulty_level = 'Mid') as mid_count,
                    COUNT(*) FILTER (WHERE difficulty_level = 'High') as high_count
                FROM wello.wello_external_checkup_items
                WHERE is_active = true
            """)
            
            print("  외부 검사 항목 난이도별 통계:")
            print(f"    - Low (부담없는): {difficulty_stats['low_count']}개")
            print(f"    - Mid (추천): {difficulty_stats['mid_count']}개")
            print(f"    - High (프리미엄): {difficulty_stats['high_count']}개")
        
        print("\n" + "=" * 100)
        print("💡 참고: 이 데이터들은 데이터베이스에서 직접 조회한 것입니다.")
        print("💡 초기 데이터 입력용 스크립트: insert_external_checkup_items.py, execute_hospital_checkup_items.py")
        print("=" * 100)
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            await conn.close()

if __name__ == "__main__":
    asyncio.run(list_database_checkup_items())

