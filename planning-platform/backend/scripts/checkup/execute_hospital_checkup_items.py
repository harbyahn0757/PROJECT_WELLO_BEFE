#!/usr/bin/env python3
"""
병원 검진 항목 DB 추가 스크립트 (초기 데이터 입력용)

⚠️ 주의: 이 스크립트는 초기 데이터 입력용입니다.
실제 서비스 코드에서는 데이터베이스에서 직접 조회합니다.
하드코딩된 데이터는 이 스크립트에만 존재하며, 서비스 코드에서는 사용하지 않습니다.
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

async def execute_sql():
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("=" * 80)
        print("1. 병원 테이블에 검진 항목 필드 추가")
        print("=" * 80)
        
        # 컬럼 추가
        await conn.execute("""
            ALTER TABLE welno.welno_hospitals 
            ADD COLUMN IF NOT EXISTS checkup_items JSONB,
            ADD COLUMN IF NOT EXISTS national_checkup_items JSONB,
            ADD COLUMN IF NOT EXISTS recommended_items JSONB
        """)
        print("✅ 컬럼 추가 완료")
        
        # 인덱스 추가
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_hospitals_checkup_items 
            ON welno.welno_hospitals USING GIN (checkup_items);
            
            CREATE INDEX IF NOT EXISTS idx_hospitals_national_checkup 
            ON welno.welno_hospitals USING GIN (national_checkup_items);
            
            CREATE INDEX IF NOT EXISTS idx_hospitals_recommended_items 
            ON welno.welno_hospitals USING GIN (recommended_items);
        """)
        print("✅ 인덱스 추가 완료")
        
        print("\n" + "=" * 80)
        print("2. 김현우내과 검진 항목 데이터 입력")
        print("=" * 80)
        
        # 김현우내과 검진 항목 데이터
        national_checkup_items = [
            {
                "name": "일반건강검진",
                "category": "기본검진",
                "description": "국가에서 시행하는 의무 건강검진",
                "age_range": "40-64",
                "gender": "all",
                "frequency": "2년마다",
                "items": ["신체계측", "혈압측정", "혈액검사", "소변검사", "흉부X선", "시력검사", "청력검사"]
            },
            {
                "name": "암검진",
                "category": "암검진",
                "description": "국가 암검진 프로그램",
                "age_range": "40-74",
                "gender": "all",
                "frequency": "1-2년마다",
                "items": ["위암검진", "대장암검진", "간암검진", "유방암검진", "자궁경부암검진"]
            }
        ]
        
        recommended_items = [
            {
                "name": "심전도 검사",
                "category": "심혈관검진",
                "description": "심장의 전기적 활동을 측정하는 검사",
                "types": ["12유도 심전도", "운동부하 심전도", "24시간 홀터 심전도"],
                "target_conditions": ["고혈압", "당뇨", "심장질환 가족력"],
                "upselling_priority": 1,
                "meaning": "심장 질환 조기 발견 및 모니터링"
            },
            {
                "name": "유전자 검사",
                "category": "유전자검진",
                "description": "유전적 질환 위험도 평가",
                "types": ["암 유전자 검사", "심혈관 질환 유전자 검사", "대사질환 유전자 검사"],
                "target_conditions": ["가족력 있는 질환", "조기 발병 질환"],
                "upselling_priority": 2,
                "meaning": "개인 맞춤형 예방 의학"
            },
            {
                "name": "여성 검진",
                "category": "여성검진",
                "description": "여성 특화 검진 항목",
                "age_range": "20-65",
                "gender": "F",
                "items": ["골밀도 검사", "갑상선 초음파", "유방 초음파", "부인과 검진"],
                "upselling_priority": 2,
                "meaning": "여성 건강 특화 검진"
            },
            {
                "name": "정밀 검진",
                "category": "특화검진",
                "description": "별도 회사에서 시행하는 정밀 검진",
                "types": ["PET-CT", "MRI 전신 스캔", "초음파 전신 검사"],
                "upselling_priority": 3,
                "meaning": "전신 정밀 건강 상태 평가"
            }
        ]
        
        # UPDATE 실행
        await conn.execute("""
            UPDATE welno.welno_hospitals 
            SET 
                national_checkup_items = $1::jsonb,
                recommended_items = $2::jsonb
            WHERE hospital_id = 'KIM_HW_CLINIC'
        """, json.dumps(national_checkup_items, ensure_ascii=False), json.dumps(recommended_items, ensure_ascii=False))
        
        print("✅ 김현우내과 검진 항목 데이터 입력 완료")
        
        # 확인
        print("\n" + "=" * 80)
        print("3. 입력된 데이터 확인")
        print("=" * 80)
        
        result = await conn.fetchrow("""
            SELECT hospital_id, hospital_name, 
                   national_checkup_items, recommended_items
            FROM welno.welno_hospitals 
            WHERE hospital_id = 'KIM_HW_CLINIC'
        """)
        
        if result:
            print(f"병원 ID: {result['hospital_id']}")
            print(f"병원명: {result['hospital_name']}")
            print(f"\n일반검진 항목 수: {len(result['national_checkup_items']) if result['national_checkup_items'] else 0}개")
            if result['national_checkup_items']:
                for item in result['national_checkup_items']:
                    print(f"  - {item['name']} ({item['category']})")
            print(f"\n병원 추천 항목 수: {len(result['recommended_items']) if result['recommended_items'] else 0}개")
            if result['recommended_items']:
                for item in result['recommended_items']:
                    print(f"  - {item['name']} ({item['category']}, 우선순위: {item.get('upselling_priority', 'N/A')})")
        else:
            print("❌ KIM_HW_CLINIC 데이터를 찾을 수 없습니다")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            await conn.close()

if __name__ == "__main__":
    asyncio.run(execute_sql())


