#!/usr/bin/env python3
"""
완성된 프롬프트 출력 스크립트
로그 파일과 데이터베이스에서 데이터를 확인하여 실제로 완성된 프롬프트를 출력
"""
import asyncio
import sys
import json
import os
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import asyncpg

# 데이터베이스 설정
DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

# 로그 디렉토리
LOG_DIR = project_root / "logs"


def find_latest_prompt_log(log_type: str = "perplexity") -> Optional[Path]:
    """최신 프롬프트 로그 파일 찾기"""
    pattern = f"{log_type}_prompt_*.json"
    log_files = list(LOG_DIR.glob(pattern))
    
    if not log_files:
        return None
    
    # 파일명의 타임스탬프 기준으로 정렬 (최신순)
    log_files.sort(key=lambda x: x.stem.split("_")[-1], reverse=True)
    return log_files[0]


def load_prompt_log(log_file: Path) -> Dict[str, Any]:
    """프롬프트 로그 파일 로드"""
    with open(log_file, "r", encoding="utf-8") as f:
        return json.load(f)


async def get_patient_info(conn, uuid: str, hospital_id: str) -> Optional[Dict[str, Any]]:
    """환자 정보 조회"""
    query = """
        SELECT 
            p.id, p.uuid, p.hospital_id, p.name, p.birth_date, p.gender,
            h.hospital_name
        FROM welno.welno_patients p
        LEFT JOIN welno.welno_hospitals h ON p.hospital_id = h.hospital_id
        WHERE p.uuid = $1 AND p.hospital_id = $2
    """
    row = await conn.fetchrow(query, uuid, hospital_id)
    
    if not row:
        return None
    
    return {
        "id": row["id"],
        "uuid": row["uuid"],
        "hospital_id": row["hospital_id"],
        "name": row["name"],
        "birth_date": row["birth_date"],
        "gender": row["gender"],
        "hospital_name": row["hospital_name"]
    }


async def get_latest_design_request(conn, patient_id: int) -> Optional[Dict[str, Any]]:
    """최신 검진 설계 요청 조회"""
    query = """
        SELECT 
            id, patient_id,
            selected_concerns,
            survey_responses,
            additional_concerns,
            design_result,
            created_at
        FROM welno.welno_checkup_design_requests
        WHERE patient_id = $1
        ORDER BY created_at DESC
        LIMIT 1
    """
    row = await conn.fetchrow(query, patient_id)
    
    if not row:
        return None
    
    return {
        "id": row["id"],
        "patient_id": row["patient_id"],
        "selected_concerns": row["selected_concerns"],
        "survey_responses": row["survey_responses"],
        "additional_concerns": row["additional_concerns"],
        "design_result": row["design_result"],
        "created_at": row["created_at"]
    }


async def get_health_data(conn, uuid: str, hospital_id: str) -> List[Dict[str, Any]]:
    """건강검진 데이터 조회"""
    query = """
        SELECT 
            raw_data,
            year,
            checkup_date,
            location
        FROM welno.welno_checkup_data
        WHERE patient_id = (
            SELECT id FROM welno.welno_patients 
            WHERE uuid = $1 AND hospital_id = $2
        )
        ORDER BY year DESC, checkup_date DESC
        LIMIT 10
    """
    rows = await conn.fetch(query, uuid, hospital_id)
    
    return [dict(row) for row in rows]


async def get_prescription_data(conn, uuid: str, hospital_id: str) -> List[Dict[str, Any]]:
    """처방전 데이터 조회"""
    query = """
        SELECT 
            raw_data,
            prescription_date,
            hospital_name
        FROM welno.welno_prescription_data
        WHERE patient_id = (
            SELECT id FROM welno.welno_patients 
            WHERE uuid = $1 AND hospital_id = $2
        )
        ORDER BY prescription_date DESC
        LIMIT 10
    """
    rows = await conn.fetch(query, uuid, hospital_id)
    
    return [dict(row) for row in rows]


def print_prompt_details(log_data: Dict[str, Any], db_data: Optional[Dict[str, Any]] = None):
    """프롬프트 상세 정보 출력"""
    print("=" * 80)
    print("완성된 프롬프트 정보")
    print("=" * 80)
    print()
    
    # 로그 파일 정보
    print("📝 로그 파일 정보:")
    print(f"   타임스탬프: {log_data.get('timestamp', 'N/A')}")
    print(f"   모델: {log_data.get('model', 'N/A')}")
    print(f"   Temperature: {log_data.get('temperature', 'N/A')}")
    print(f"   Max Tokens: {log_data.get('max_tokens', 'N/A')}")
    print(f"   건강검진 데이터: {log_data.get('health_data_count', 0)}건")
    print(f"   처방전 데이터: {log_data.get('prescription_data_count', 0)}건")
    print()
    
    # 데이터베이스 정보
    if db_data:
        print("💾 데이터베이스 정보:")
        print(f"   환자 이름: {db_data.get('patient_name', 'N/A')}")
        print(f"   환자 UUID: {db_data.get('patient_uuid', 'N/A')}")
        print(f"   병원 ID: {db_data.get('hospital_id', 'N/A')}")
        print(f"   선택 항목: {len(db_data.get('selected_concerns', []))}개")
        print(f"   설문 응답: {'있음' if db_data.get('survey_responses') else '없음'}")
        print(f"   건강검진 데이터: {len(db_data.get('health_data', []))}건")
        print(f"   처방전 데이터: {len(db_data.get('prescription_data', []))}건")
        print()
    
    # 시스템 메시지
    print("=" * 80)
    print("시스템 메시지 (System Message)")
    print("=" * 80)
    print(log_data.get('system_message', ''))
    print()
    
    # 사용자 메시지 (완성된 프롬프트)
    print("=" * 80)
    print("사용자 메시지 (완성된 프롬프트)")
    print("=" * 80)
    print(log_data.get('user_message', ''))
    print()
    
    # 프롬프트 통계
    system_msg = log_data.get('system_message', '')
    user_msg = log_data.get('user_message', '')
    
    print("=" * 80)
    print("프롬프트 통계")
    print("=" * 80)
    print(f"   시스템 메시지 길이: {len(system_msg):,} 문자")
    print(f"   사용자 메시지 길이: {len(user_msg):,} 문자")
    print(f"   전체 프롬프트 길이: {len(system_msg) + len(user_msg):,} 문자")
    print()


async def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description="완성된 프롬프트 출력")
    parser.add_argument(
        "--log-type",
        choices=["gpt", "perplexity"],
        default="perplexity",
        help="로그 타입 (gpt 또는 perplexity)"
    )
    parser.add_argument(
        "--log-file",
        type=str,
        help="특정 로그 파일 경로 (지정하지 않으면 최신 파일 사용)"
    )
    parser.add_argument(
        "--uuid",
        type=str,
        help="환자 UUID (데이터베이스 데이터 조회용)"
    )
    parser.add_argument(
        "--hospital-id",
        type=str,
        help="병원 ID (데이터베이스 데이터 조회용)"
    )
    parser.add_argument(
        "--db-only",
        action="store_true",
        help="데이터베이스에서만 데이터 조회 (로그 파일 사용 안 함)"
    )
    
    args = parser.parse_args()
    
    # 로그 파일 로드
    log_data = None
    if not args.db_only:
        if args.log_file:
            log_file = Path(args.log_file)
            if not log_file.exists():
                print(f"❌ 로그 파일을 찾을 수 없습니다: {log_file}")
                return
        else:
            log_file = find_latest_prompt_log(args.log_type)
            if not log_file:
                print(f"❌ {args.log_type} 프롬프트 로그 파일을 찾을 수 없습니다.")
                return
        
        print(f"📂 로그 파일: {log_file}")
        log_data = load_prompt_log(log_file)
        print()
    
    # 데이터베이스 데이터 조회
    db_data = None
    if args.uuid and args.hospital_id:
        try:
            conn = await asyncpg.connect(**DB_CONFIG)
            
            # 환자 정보 조회
            patient_info = await get_patient_info(conn, args.uuid, args.hospital_id)
            if not patient_info:
                print(f"❌ 환자 정보를 찾을 수 없습니다: {args.uuid} @ {args.hospital_id}")
                await conn.close()
                return
            
            # 최신 검진 설계 요청 조회
            design_request = await get_latest_design_request(conn, patient_info["id"])
            
            # 건강검진 데이터 조회
            health_data = await get_health_data(conn, args.uuid, args.hospital_id)
            
            # 처방전 데이터 조회
            prescription_data = await get_prescription_data(conn, args.uuid, args.hospital_id)
            
            db_data = {
                "patient_name": patient_info["name"],
                "patient_uuid": patient_info["uuid"],
                "hospital_id": patient_info["hospital_id"],
                "hospital_name": patient_info.get("hospital_name"),
                "selected_concerns": design_request["selected_concerns"] if design_request else [],
                "survey_responses": design_request["survey_responses"] if design_request else None,
                "additional_concerns": design_request["additional_concerns"] if design_request else None,
                "health_data": health_data,
                "prescription_data": prescription_data,
                "design_result": design_request["design_result"] if design_request else None
            }
            
            await conn.close()
        except Exception as e:
            print(f"❌ 데이터베이스 조회 중 오류: {str(e)}")
            import traceback
            traceback.print_exc()
    
    # 프롬프트 출력
    if log_data:
        print_prompt_details(log_data, db_data)
    elif db_data:
        print("=" * 80)
        print("데이터베이스 데이터")
        print("=" * 80)
        print(json.dumps(db_data, ensure_ascii=False, indent=2, default=str))
    else:
        print("❌ 출력할 데이터가 없습니다.")


if __name__ == "__main__":
    asyncio.run(main())


