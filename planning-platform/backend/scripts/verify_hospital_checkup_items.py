#!/usr/bin/env python3
"""
병원별 검진 항목 데이터 검증 스크립트
- 데이터베이스에 충분한 정보가 있는지 확인
- 프롬프트에 전달 가능한지 검증
- 추천 항목으로 사용 가능한지 확인
"""
import asyncio
import asyncpg
import json
from typing import Dict, Any, List, Optional

DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

async def verify_hospital_checkup_items(hospital_id: str = "KIM_HW_CLINIC"):
    """병원별 검진 항목 데이터 검증"""
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("=" * 80)
        print(f"병원별 검진 항목 데이터 검증: {hospital_id}")
        print("=" * 80)
        
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
        
        print(f"\n✅ 병원 정보 조회 성공")
        print(f"   병원명: {hospital_row['hospital_name']}")
        
        # 2. national_checkup_items 검증
        print("\n" + "-" * 80)
        print("1. 일반검진 항목 (national_checkup_items) 검증")
        print("-" * 80)
        
        national_checkup_items_raw = hospital_row.get('national_checkup_items')
        if not national_checkup_items_raw:
            print("⚠️  national_checkup_items가 없습니다.")
            national_checkup_items = []
        else:
            # JSONB 파싱 (이미 파싱되어 있거나 문자열일 수 있음)
            if isinstance(national_checkup_items_raw, str):
                national_checkup_items = json.loads(national_checkup_items_raw)
            elif isinstance(national_checkup_items_raw, (list, dict)):
                national_checkup_items = national_checkup_items_raw if isinstance(national_checkup_items_raw, list) else [national_checkup_items_raw]
            else:
                national_checkup_items = []
        
        if not national_checkup_items:
            print("⚠️  national_checkup_items가 비어있습니다.")
        else:
            print(f"✅ 항목 수: {len(national_checkup_items)}개")
            
            # 카테고리별 분류
            categories = {}
            for item in national_checkup_items:
                # item이 딕셔너리인지 확인
                if not isinstance(item, dict):
                    continue
                category = item.get('category', '미분류')
                if category not in categories:
                    categories[category] = []
                categories[category].append(item)
            
            print(f"   카테고리별 분류:")
            for cat, items in categories.items():
                print(f"   - {cat}: {len(items)}개")
                for item in items[:3]:  # 처음 3개만 표시
                    name = item.get('name', 'N/A')
                    print(f"     * {name}")
                if len(items) > 3:
                    print(f"     ... 외 {len(items) - 3}개")
            
            # 필수 필드 확인
            required_fields = ['name', 'category']
            missing_fields = []
            for item in national_checkup_items:
                for field in required_fields:
                    if field not in item or not item[field]:
                        missing_fields.append(f"{item.get('name', 'N/A')}.{field}")
            
            if missing_fields:
                print(f"⚠️  필수 필드 누락: {set(missing_fields)}")
            else:
                print("✅ 모든 항목에 필수 필드가 있습니다.")
        
        # 3. recommended_items 검증
        print("\n" + "-" * 80)
        print("2. 병원 추천 항목 (recommended_items) 검증")
        print("-" * 80)
        
        recommended_items_raw = hospital_row.get('recommended_items')
        if not recommended_items_raw:
            print("⚠️  recommended_items가 없습니다.")
            recommended_items = []
        else:
            # JSONB 파싱 (이미 파싱되어 있거나 문자열일 수 있음)
            if isinstance(recommended_items_raw, str):
                recommended_items = json.loads(recommended_items_raw)
            elif isinstance(recommended_items_raw, (list, dict)):
                recommended_items = recommended_items_raw if isinstance(recommended_items_raw, list) else [recommended_items_raw]
            else:
                recommended_items = []
        
        if not recommended_items:
            print("⚠️  recommended_items가 비어있습니다.")
        else:
            print(f"✅ 항목 수: {len(recommended_items)}개")
            
            # 카테고리별 분류
            categories = {}
            for item in recommended_items:
                category = item.get('category', '미분류')
                if category not in categories:
                    categories[category] = []
                categories[category].append(item)
            
            print(f"   카테고리별 분류:")
            for cat, items in categories.items():
                print(f"   - {cat}: {len(items)}개")
                for item in items:
                    name = item.get('name', 'N/A')
                    priority = item.get('upselling_priority', 'N/A')
                    target = item.get('target_conditions', [])
                    print(f"     * {name} (우선순위: {priority}, 대상: {target})")
            
            # 추천 항목으로 사용 가능한 필드 확인
            useful_fields = ['name', 'category', 'description', 'target_conditions', 'upselling_priority', 'gender', 'age_range']
            available_fields = set()
            for item in recommended_items:
                for field in useful_fields:
                    if field in item and item[field]:
                        available_fields.add(field)
            
            print(f"   사용 가능한 필드: {sorted(available_fields)}")
            
            # 필수 필드 확인
            required_fields = ['name', 'category']
            missing_fields = []
            for item in recommended_items:
                for field in required_fields:
                    if field not in item or not item[field]:
                        missing_fields.append(f"{item.get('name', 'N/A')}.{field}")
            
            if missing_fields:
                print(f"⚠️  필수 필드 누락: {set(missing_fields)}")
            else:
                print("✅ 모든 항목에 필수 필드가 있습니다.")
        
        # 4. external_checkup_items 검증
        print("\n" + "-" * 80)
        print("3. 외부 검사 항목 (external_checkup_items) 검증")
        print("-" * 80)
        
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
                ORDER BY m.display_order
            """, hospital_id)
            
            if not external_checkup_items:
                print("⚠️  external_checkup_items가 없습니다.")
            else:
                print(f"✅ 항목 수: {len(external_checkup_items)}개")
                
                # 난이도별 분류
                difficulty_stats = {}
                for item in external_checkup_items:
                    level = item['difficulty_level']
                    difficulty_stats[level] = difficulty_stats.get(level, 0) + 1
                
                print(f"   난이도별 분류:")
                for level, count in sorted(difficulty_stats.items()):
                    print(f"   - {level}: {count}개")
                
                # 카테고리별 분류
                categories = {}
                for item in external_checkup_items:
                    category = item.get('category', '미분류')
                    if category not in categories:
                        categories[category] = []
                    categories[category].append(item)
                
                print(f"   카테고리별 분류:")
                for cat, items in categories.items():
                    print(f"   - {cat}: {len(items)}개")
                    for item in items[:2]:  # 처음 2개만 표시
                        name = item.get('item_name', 'N/A')
                        difficulty = item.get('difficulty_level', 'N/A')
                        target = item.get('target', 'N/A')
                        print(f"     * {name} ({difficulty}, 대상: {target})")
                    if len(items) > 2:
                        print(f"     ... 외 {len(items) - 2}개")
                
                # 추천 항목으로 사용 가능한 필드 확인
                useful_fields = ['item_name', 'category', 'difficulty_level', 'target_trigger', 
                               'gap_description', 'solution_narrative', 'target', 'algorithm_class']
                available_fields = set()
                for item in external_checkup_items:
                    for field in useful_fields:
                        if field in item and item[field]:
                            available_fields.add(field)
                
                print(f"   사용 가능한 필드: {sorted(available_fields)}")
                
                # 필수 필드 확인
                required_fields = ['item_name', 'category', 'difficulty_level']
                missing_fields = []
                for item in external_checkup_items:
                    for field in required_fields:
                        if field not in item or not item[field]:
                            missing_fields.append(f"{item.get('item_name', 'N/A')}.{field}")
                
                if missing_fields:
                    print(f"⚠️  필수 필드 누락: {set(missing_fields)}")
                else:
                    print("✅ 모든 항목에 필수 필드가 있습니다.")
        
        except Exception as e:
            print(f"⚠️  external_checkup_items 조회 실패: {e}")
            print("   (테이블이 없거나 매핑 데이터가 없을 수 있습니다)")
        
        # 5. 프롬프트 전달 가능 여부 확인
        print("\n" + "-" * 80)
        print("4. 프롬프트 전달 가능 여부 검증")
        print("-" * 80)
        
        # 카테고리별 분류 시뮬레이션
        if national_checkup_items:
            classified = {
                "일반": [],
                "기본검진": [],
                "종합": [],
                "옵션": []
            }
            
            for item in national_checkup_items:
                category = item.get("category", "").strip()
                if category in ["일반", "기본검진"]:
                    classified["일반"].append(item)
                    classified["기본검진"].append(item)
                elif category == "종합":
                    classified["종합"].append(item)
                elif category == "옵션":
                    classified["옵션"].append(item)
                else:
                    classified["일반"].append(item)  # 기본값
            
            print("   카테고리별 분류 결과:")
            print(f"   - 일반/기본검진 (priority_1): {len(classified['일반'])}개")
            print(f"   - 종합 (priority_2): {len(classified['종합'])}개")
            print(f"   - 옵션 (priority_3): {len(classified['옵션'])}개")
        
        # 추천 항목으로 사용 가능 여부
        print("\n   추천 항목으로 사용 가능 여부:")
        can_recommend = True
        
        if recommended_items and len(recommended_items) > 0:
            print(f"   ✅ recommended_items: {len(recommended_items)}개 항목 사용 가능")
        else:
            print("   ⚠️  recommended_items가 없거나 비어있습니다.")
            can_recommend = False
        
        if external_checkup_items and len(external_checkup_items) > 0:
            print(f"   ✅ external_checkup_items: {len(external_checkup_items)}개 항목 사용 가능")
        else:
            print("   ⚠️  external_checkup_items가 없거나 비어있습니다.")
            can_recommend = False
        
        if can_recommend:
            print("\n✅ 병원별 항목이 추천 항목으로 사용 가능합니다!")
        else:
            print("\n⚠️  병원별 항목이 부족하여 추천 항목으로 사용하기 어려울 수 있습니다.")
        
        # 6. 데이터베이스 정보 충분성 평가
        print("\n" + "-" * 80)
        print("5. 데이터베이스 정보 충분성 평가")
        print("-" * 80)
        
        score = 0
        max_score = 5
        
        # national_checkup_items 존재 여부
        if national_checkup_items and len(national_checkup_items) > 0:
            score += 1
            print("✅ national_checkup_items 존재")
        else:
            print("❌ national_checkup_items 없음")
        
        # recommended_items 존재 여부
        if recommended_items and len(recommended_items) > 0:
            score += 1
            print("✅ recommended_items 존재")
        else:
            print("❌ recommended_items 없음")
        
        # external_checkup_items 존재 여부
        if external_checkup_items and len(external_checkup_items) > 0:
            score += 1
            print("✅ external_checkup_items 존재")
        else:
            print("❌ external_checkup_items 없음")
        
        # 카테고리 정보 충분성
        if national_checkup_items:
            has_category = all(item.get('category') for item in national_checkup_items)
            if has_category:
                score += 1
                print("✅ 카테고리 정보 충분")
            else:
                print("⚠️  일부 항목에 카테고리 정보 없음")
        
        # 추천에 필요한 필드 충분성
        if recommended_items or external_checkup_items:
            has_useful_fields = False
            if recommended_items:
                has_useful_fields = any(
                    item.get('target_conditions') or item.get('description')
                    for item in recommended_items
                )
            if external_checkup_items:
                has_useful_fields = has_useful_fields or any(
                    item.get('target_trigger') or item.get('gap_description')
                    for item in external_checkup_items
                )
            
            if has_useful_fields:
                score += 1
                print("✅ 추천에 필요한 필드 충분")
            else:
                print("⚠️  추천에 필요한 필드 부족")
        
        print(f"\n📊 충분성 점수: {score}/{max_score}")
        
        if score >= 4:
            print("✅ 데이터베이스 정보가 충분합니다!")
        elif score >= 2:
            print("⚠️  데이터베이스 정보가 부분적으로 충분합니다. 일부 항목 추가 권장.")
        else:
            print("❌ 데이터베이스 정보가 부족합니다. 항목 추가 필요.")
        
        print("\n" + "=" * 80)
        
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
    asyncio.run(verify_hospital_checkup_items(hospital_id))

