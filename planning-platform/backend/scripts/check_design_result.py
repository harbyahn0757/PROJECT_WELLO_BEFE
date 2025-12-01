#!/usr/bin/env python3
"""
검진 설계 결과 확인 스크립트
설계 값이 어떻게 왔는지 확인
"""
import asyncio
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import asyncpg
import json
from datetime import datetime

async def check_design_result():
    """검진 설계 결과 확인"""
    db_config = {
        "host": "10.0.1.10",
        "port": "5432",
        "database": "p9_mkt_biz",
        "user": "peernine",
        "password": "autumn3334!"
    }
    
    try:
        conn = await asyncpg.connect(**db_config)
        
        # 테이블 존재 여부 확인
        table_check = """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'wello' 
                AND table_name = 'wello_checkup_design_requests'
            )
        """
        table_exists = await conn.fetchval(table_check)
        
        if not table_exists:
            print("❌ 테이블이 존재하지 않습니다.")
            print("   다음 명령어로 테이블을 생성하세요:")
            print("   psql -h 10.0.1.10 -U peernine -d p9_mkt_biz -f backend/scripts/create_checkup_design_table.sql")
            await conn.close()
            return
        
        # 최근 검진 설계 요청 조회
        query = """
            SELECT 
                id, patient_id, 
                selected_concerns, 
                survey_responses, 
                additional_concerns,
                design_result,
                created_at
            FROM wello.wello_checkup_design_requests
            ORDER BY created_at DESC
            LIMIT 5
        """
        
        rows = await conn.fetch(query)
        
        if not rows:
            print("📭 검진 설계 요청 데이터가 없습니다.")
            print("   API를 호출하여 데이터를 생성하세요.")
            await conn.close()
            return
        
        print("=" * 80)
        print("검진 설계 결과 확인")
        print("=" * 80)
        print(f"총 {len(rows)}건의 요청이 있습니다.\n")
        
        for idx, row in enumerate(rows, 1):
            print(f"[{idx}] 요청 ID: {row['id']}")
            print(f"    환자 ID: {row['patient_id']}")
            print(f"    생성일: {row['created_at']}")
            print()
            
            # 선택한 염려 항목
            if row['selected_concerns']:
                concerns = row['selected_concerns']
                if isinstance(concerns, str):
                    concerns = json.loads(concerns)
                print(f"    📋 선택한 염려 항목: {len(concerns)}개")
                for concern in concerns[:3]:  # 최대 3개만 표시
                    print(f"       - {concern.get('type', 'N/A')}: {concern.get('name', concern.get('hospitalName', 'N/A'))}")
                if len(concerns) > 3:
                    print(f"       ... 외 {len(concerns) - 3}개")
                print()
            
            # 설문 응답
            if row['survey_responses']:
                survey = row['survey_responses']
                if isinstance(survey, str):
                    survey = json.loads(survey)
                print(f"    📝 설문 응답:")
                for key, value in list(survey.items())[:5]:  # 최대 5개만 표시
                    if key == 'family_history' and isinstance(value, list):
                        print(f"       - {key}: {', '.join(value)}")
                    elif key == 'additional_concerns':
                        print(f"       - {key}: {value[:50]}..." if len(str(value)) > 50 else f"       - {key}: {value}")
                    else:
                        print(f"       - {key}: {value}")
                print()
            
            # 검진 설계 결과
            if row['design_result']:
                result = row['design_result']
                if isinstance(result, str):
                    result = json.loads(result)
                
                recommended_items = result.get('recommended_items', [])
                total_count = result.get('total_count', 0)
                analysis = result.get('analysis', '')
                
                print(f"    🎯 검진 설계 결과:")
                print(f"       - 카테고리 수: {len(recommended_items)}개")
                print(f"       - 총 항목 수: {total_count}개")
                if analysis:
                    print(f"       - 분석 내용: {analysis[:100]}..." if len(analysis) > 100 else f"       - 분석 내용: {analysis}")
                print()
                
                # 카테고리별 상세
                for cat_idx, category in enumerate(recommended_items[:3], 1):  # 최대 3개만 표시
                    print(f"       [{cat_idx}] {category.get('category', 'N/A')}")
                    items = category.get('items', [])
                    print(f"           항목 수: {len(items)}개")
                    if items:
                        print(f"           첫 번째 항목: {items[0].get('name', 'N/A')}")
                        if items[0].get('reason'):
                            print(f"           추천 이유: {items[0].get('reason')[:50]}...")
                    if category.get('doctor_recommendation', {}).get('has_recommendation'):
                        print(f"           의사 추천: 있음")
                    print()
                
                if len(recommended_items) > 3:
                    print(f"       ... 외 {len(recommended_items) - 3}개 카테고리")
                    print()
            else:
                print("    ⚠️  검진 설계 결과가 없습니다.")
                print()
            
            print("-" * 80)
            print()
        
        await conn.close()
        
    except Exception as e:
        print(f"❌ 오류: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_design_result())


