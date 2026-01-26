"""
RAG 테스트 통합 스크립트

서브커맨드:
  simple [--limit N]     - 간단한 RAG 테스트
  quick [--limit N]       - 빠른 RAG 테스트 (5명, 각 2개 질문)
  real [--limit N]        - 실제 데이터로 RAG 테스트
  patients [--limit N]   - 실제 환자 데이터로 RAG 테스트
"""
import asyncio
import asyncpg
import aiohttp
import json
import os
import sys
import argparse
from datetime import datetime
from typing import List, Dict
from dotenv import load_dotenv

# .env.local 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    load_dotenv(env_path)

def get_db_config():
    """DB 연결 설정"""
    return {
        'host': os.getenv('DB_HOST', '10.0.1.10'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'p9_mkt_biz'),
        'user': os.getenv('DB_USER', 'peernine'),
        'password': os.getenv('DB_PASSWORD', 'autumn3334!')
    }


async def cmd_simple(limit: int = 3):
    """간단한 RAG 테스트"""
    db_config = get_db_config()
    
    print("=" * 80)
    print(f"🧪 RAG 간단 테스트 (환자 {limit}명)")
    print("=" * 80)
    print()
    
    conn = await asyncpg.connect(**db_config)
    
    try:
        # 검진 데이터가 있는 환자 조회
        patients = await conn.fetch("""
            SELECT 
                p.uuid,
                p.hospital_id,
                p.name,
                c.bmi,
                c.blood_pressure_high,
                c.blood_pressure_low,
                c.blood_sugar,
                c.cholesterol
            FROM welno.welno_patients p
            JOIN welno.welno_checkup_data c 
                ON p.uuid = c.patient_uuid AND p.hospital_id = c.hospital_id
            WHERE p.has_health_data = TRUE
            LIMIT $1
        """, limit)
        
        print(f"발견된 환자: {len(patients)}명")
        print()
        
        # RAG API 테스트
        url = "http://localhost:8082/api/v1/rag/test"
        
        async with aiohttp.ClientSession() as session:
            for idx, patient in enumerate(patients, 1):
                print(f"[{idx}] {patient['name']} (UUID: {patient['uuid']})")
                
                question = f"BMI가 {patient['bmi']}인 {patient['name']}님에게 추천할 검진 항목은?"
                
                try:
                    async with session.post(url, json={"question": question}) as response:
                        if response.status == 200:
                            result = await response.json()
                            print(f"   질문: {question}")
                            print(f"   응답: {result.get('answer', 'N/A')[:100]}...")
                        else:
                            print(f"   ❌ API 오류: {response.status}")
                except Exception as e:
                    print(f"   ❌ 오류: {e}")
                print()
        
        print("=" * 80)
        print("✅ 테스트 완료")
        print("=" * 80)
        
    finally:
        await conn.close()


async def cmd_quick(limit: int = 5):
    """빠른 RAG 테스트"""
    print("=" * 80)
    print(f"🧪 RAG 빠른 테스트 (환자 {limit}명, 각 2개 질문)")
    print("=" * 80)
    print()
    print("⚠️  이 기능은 복잡한 로직이 필요하므로 기존 test_rag_quick.py를 참고하세요.")
    print("   python scripts/test_rag_quick.py")
    print()


async def cmd_real(limit: int = 5):
    """실제 데이터로 RAG 테스트"""
    print("=" * 80)
    print(f"🧪 RAG 실제 데이터 테스트 (환자 {limit}명)")
    print("=" * 80)
    print()
    print("⚠️  이 기능은 복잡한 로직이 필요하므로 기존 test_rag_with_real_data.py를 참고하세요.")
    print("   python scripts/test_rag_with_real_data.py")
    print()


async def cmd_patients(limit: int = 10):
    """실제 환자 데이터로 RAG 테스트"""
    print("=" * 80)
    print(f"🧪 RAG 실제 환자 데이터 테스트 (환자 {limit}명)")
    print("=" * 80)
    print()
    print("⚠️  이 기능은 복잡한 로직이 필요하므로 기존 test_rag_with_real_patients.py를 참고하세요.")
    print("   python scripts/test_rag_with_real_patients.py")
    print()


def main():
    parser = argparse.ArgumentParser(description='RAG 테스트 통합 스크립트')
    subparsers = parser.add_subparsers(dest='command', help='서브커맨드')
    
    # simple 명령
    simple_parser = subparsers.add_parser('simple', help='간단한 RAG 테스트')
    simple_parser.add_argument('--limit', type=int, default=3, help='환자 수 (기본값: 3)')
    
    # quick 명령
    quick_parser = subparsers.add_parser('quick', help='빠른 RAG 테스트')
    quick_parser.add_argument('--limit', type=int, default=5, help='환자 수 (기본값: 5)')
    
    # real 명령
    real_parser = subparsers.add_parser('real', help='실제 데이터로 RAG 테스트')
    real_parser.add_argument('--limit', type=int, default=5, help='환자 수 (기본값: 5)')
    
    # patients 명령
    patients_parser = subparsers.add_parser('patients', help='실제 환자 데이터로 RAG 테스트')
    patients_parser.add_argument('--limit', type=int, default=10, help='환자 수 (기본값: 10)')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    if args.command == 'simple':
        asyncio.run(cmd_simple(args.limit))
    elif args.command == 'quick':
        asyncio.run(cmd_quick(args.limit))
    elif args.command == 'real':
        asyncio.run(cmd_real(args.limit))
    elif args.command == 'patients':
        asyncio.run(cmd_patients(args.limit))


if __name__ == "__main__":
    main()
