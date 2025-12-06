#!/usr/bin/env python3
"""
병원별 검진 항목 그룹별 목록 출력 스크립트
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

async def list_hospital_checkup_items(hospital_id: str = "KIM_HW_CLINIC"):
    """병원별 검진 항목을 그룹별로 목록 출력"""
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("=" * 100)
        print(f"병원별 검진 항목 그룹별 목록: {hospital_id}")
        print("=" * 100)
        
        # 1. 병원 기본 정보 조회
        hospital_row = await conn.fetchrow("""
            SELECT hospital_id, hospital_name, 
                   national_checkup_items, recommended_items
            FROM wello.wello_hospitals 
            WHERE hospital_id = $1 AND is_active = true
        """, hospital_id)
        
        if not hospital_row:
            print(f"❌ 병원을 찾을 수 없습니다: {hospital_id}")
            return
        
        print(f"\n병원명: {hospital_row['hospital_name']}")
        print(f"병원 ID: {hospital_row['hospital_id']}\n")
        
        # 2. national_checkup_items 그룹별 목록
        print("=" * 100)
        print("📋 1. 일반검진 항목 (national_checkup_items)")
        print("=" * 100)
        
        national_checkup_items_raw = hospital_row.get('national_checkup_items')
        if not national_checkup_items_raw:
            print("⚠️  데이터 없음\n")
            national_checkup_items = []
        else:
            if isinstance(national_checkup_items_raw, str):
                national_checkup_items = json.loads(national_checkup_items_raw)
            elif isinstance(national_checkup_items_raw, (list, dict)):
                national_checkup_items = national_checkup_items_raw if isinstance(national_checkup_items_raw, list) else [national_checkup_items_raw]
            else:
                national_checkup_items = []
        
        if not national_checkup_items:
            print("⚠️  항목 없음\n")
        else:
            # 카테고리별 그룹화
            categories = {}
            for item in national_checkup_items:
                if not isinstance(item, dict):
                    continue
                category = item.get('category', '미분류')
                if category not in categories:
                    categories[category] = []
                categories[category].append(item)
            
            for category, items in sorted(categories.items()):
                print(f"\n  📁 카테고리: {category} ({len(items)}개)")
                print("  " + "-" * 96)
                for idx, item in enumerate(items, 1):
                    name = item.get('name', 'N/A')
                    description = item.get('description', '')
                    age_range = item.get('age_range', '')
                    gender = item.get('gender', 'all')
                    frequency = item.get('frequency', '')
                    items_list = item.get('items', [])
                    
                    print(f"    {idx}. {name}")
                    if description:
                        print(f"       설명: {description}")
                    if age_range:
                        print(f"       연령: {age_range}")
                    if gender != 'all':
                        print(f"       성별: {gender}")
                    if frequency:
                        print(f"       빈도: {frequency}")
                    if items_list:
                        print(f"       세부항목: {', '.join(items_list[:5])}")
                        if len(items_list) > 5:
                            print(f"                ... 외 {len(items_list) - 5}개")
                    print()
        
        # 3. recommended_items 그룹별 목록
        print("=" * 100)
        print("📋 2. 병원 추천 항목 (recommended_items)")
        print("=" * 100)
        
        recommended_items_raw = hospital_row.get('recommended_items')
        if not recommended_items_raw:
            print("⚠️  데이터 없음\n")
            recommended_items = []
        else:
            if isinstance(recommended_items_raw, str):
                recommended_items = json.loads(recommended_items_raw)
            elif isinstance(recommended_items_raw, (list, dict)):
                recommended_items = recommended_items_raw if isinstance(recommended_items_raw, list) else [recommended_items_raw]
            else:
                recommended_items = []
        
        if not recommended_items:
            print("⚠️  항목 없음\n")
        else:
            # 카테고리별 그룹화
            categories = {}
            for item in recommended_items:
                if not isinstance(item, dict):
                    continue
                category = item.get('category', '미분류')
                if category not in categories:
                    categories[category] = []
                categories[category].append(item)
            
            for category, items in sorted(categories.items()):
                print(f"\n  📁 카테고리: {category} ({len(items)}개)")
                print("  " + "-" * 96)
                for idx, item in enumerate(items, 1):
                    name = item.get('name', 'N/A')
                    description = item.get('description', '')
                    target_conditions = item.get('target_conditions', [])
                    upselling_priority = item.get('upselling_priority', 'N/A')
                    gender = item.get('gender', 'all')
                    age_range = item.get('age_range', '')
                    types = item.get('types', [])
                    meaning = item.get('meaning', '')
                    
                    print(f"    {idx}. {name}")
                    if description:
                        print(f"       설명: {description}")
                    if meaning:
                        print(f"       의미: {meaning}")
                    if target_conditions:
                        print(f"       추천 대상: {', '.join(target_conditions)}")
                    if upselling_priority != 'N/A':
                        print(f"       업셀링 우선순위: {upselling_priority}")
                    if gender != 'all':
                        print(f"       성별: {gender}")
                    if age_range:
                        print(f"       연령: {age_range}")
                    if types:
                        print(f"       종류: {', '.join(types)}")
                    print()
        
        # 4. external_checkup_items 그룹별 목록
        print("=" * 100)
        print("📋 3. 외부 검사 항목 (external_checkup_items)")
        print("=" * 100)
        
        try:
            external_checkup_items = await conn.fetch("""
                SELECT 
                    e.id,
                    e.category,
                    e.sub_category,
                    e.item_name,
                    e.item_name_en,
                    e.difficulty_level,
                    e.target_trigger,
                    e.gap_description,
                    e.solution_narrative,
                    e.description,
                    e.manufacturer,
                    e.target,
                    e.input_sample,
                    e.algorithm_class,
                    m.display_order
                FROM wello.wello_hospital_external_checkup_mapping m
                JOIN wello.wello_external_checkup_items e ON m.external_checkup_item_id = e.id
                WHERE m.hospital_id = $1 AND m.is_active = true AND e.is_active = true
                ORDER BY m.display_order, e.category, e.difficulty_level, e.item_name
            """, hospital_id)
            
            if not external_checkup_items:
                print("⚠️  항목 없음\n")
            else:
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
                                item_name_en = item.get('item_name_en', '')
                                target = item.get('target', '')
                                target_trigger = item.get('target_trigger', '')
                                algorithm_class = item.get('algorithm_class', '')
                                manufacturer = item.get('manufacturer', '')
                                input_sample = item.get('input_sample', '')
                                sub_category = item.get('sub_category', '')
                                
                                print(f"      {idx}. {item_name}")
                                if item_name_en:
                                    print(f"         영문명: {item_name_en}")
                                if sub_category:
                                    print(f"         세부분류: {sub_category}")
                                if target:
                                    print(f"         검사 대상: {target}")
                                if target_trigger:
                                    print(f"         추천 대상: {target_trigger}")
                                if algorithm_class:
                                    print(f"         알고리즘 분류: {algorithm_class}")
                                if manufacturer:
                                    print(f"         제조사: {manufacturer}")
                                if input_sample:
                                    print(f"         검체: {input_sample}")
                                print()
        
        except Exception as e:
            print(f"⚠️  external_checkup_items 조회 실패: {e}\n")
        
        # 5. 통계 요약
        print("=" * 100)
        print("📊 통계 요약")
        print("=" * 100)
        
        national_count = len(national_checkup_items) if national_checkup_items else 0
        recommended_count = len(recommended_items) if recommended_items else 0
        external_count = len(external_checkup_items) if external_checkup_items else 0
        
        print(f"\n  일반검진 항목: {national_count}개")
        print(f"  병원 추천 항목: {recommended_count}개")
        print(f"  외부 검사 항목: {external_count}개")
        print(f"  총계: {national_count + recommended_count + external_count}개\n")
        
        print("=" * 100)
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            await conn.close()

if __name__ == "__main__":
    import sys
    hospital_id = sys.argv[1] if len(sys.argv) > 1 else "KIM_HW_CLINIC"
    asyncio.run(list_hospital_checkup_items(hospital_id))


