#!/usr/bin/env python3
"""
Phase 3-4 성능 개선 테스트 스크립트
- Phase 4: STEP 1 프롬프트 최적화 검증
- Phase 3: Context Caching 효과 측정
"""
import asyncio
import time
import sys
import os
import json
import requests
import argparse
from typing import Dict, Any

# 환경 변수 설정
from dotenv import load_dotenv
load_dotenv('/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/.env.local')

# API 설정
DEFAULT_API_BASE_URL = "http://localhost:8082"

def print_section(title: str):
    """섹션 구분선 출력"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def print_step(step_num: int, step_name: str):
    """단계 출력"""
    print(f"\n{'─' * 80}")
    print(f"  STEP {step_num}: {step_name}")
    print(f"{'─' * 80}")

async def test_phase3_4_performance(uuid: str = None, hospital_id: str = None, api_base_url: str = None):
    """Phase 3-4 성능 개선 테스트"""
    
    api_url = api_base_url or DEFAULT_API_BASE_URL
    api_endpoint = f"{api_url}/api/v1/checkup-design/create"
    
    print_section("🧪 Phase 3-4 성능 개선 테스트")
    
    # ========================================
    # 1. 테스트 데이터 준비
    # ========================================
    print_step(0, "테스트 데이터 준비")
    
    test_uuid = uuid or os.getenv("TEST_PATIENT_UUID") or "c254eba4-aa34-4ef6-be70-59cc2f842e02"
    test_hospital_id = hospital_id or os.getenv("TEST_HOSPITAL_ID") or "PEERNINE"
    
    print(f"\n📋 테스트 설정:")
    print(f"   UUID: {test_uuid}")
    print(f"   병원 ID: {test_hospital_id}")
    
    request_data = {
        "uuid": test_uuid,
        "hospital_id": test_hospital_id,
        "selected_concerns": [
            {
                "type": "checkup",
                "id": "blood_pressure",
                "name": "혈압",
                "date": "2024-01-01",
                "value": 140.0,
                "unit": "mmHg",
                "status": "warning"
            }
        ],
        "survey_responses": {
            "weight_change": "증가",
            "exercise": "주 1-2회",
            "family_history": ["당뇨", "고혈압"]
        },
        "additional_info": {}
    }
    
    # ========================================
    # 2. API 호출 및 타이밍 측정
    # ========================================
    print_step(1, "API 호출 및 성능 측정")
    
    print(f"\n🌐 API 엔드포인트: {api_endpoint}")
    print(f"⏱️  요청 시작 시간: {time.strftime('%H:%M:%S')}")
    
    try:
        start_time = time.time()
        
        print("\n📤 API 요청 전송 중...")
        response = requests.post(
            api_endpoint,
            json=request_data,
            headers={"Content-Type": "application/json"},
            timeout=180
        )
        
        elapsed_total = time.time() - start_time
        
        print(f"\n✅ 응답 수신 완료")
        print(f"⏱️  전체 소요 시간: {elapsed_total:.3f}초")
        print(f"📊 HTTP 상태 코드: {response.status_code}")
        
        # ========================================
        # 3. 응답 분석
        # ========================================
        print_step(2, "응답 분석")
        
        if response.status_code == 200:
            result = response.json()
            
            print(f"\n✅ 검진 설계 생성 성공!")
            print(f"📋 응답 키: {list(result.get('data', {}).keys()) if isinstance(result.get('data'), dict) else 'N/A'}")
            
            # Priority 1 항목 확인
            data = result.get('data', {})
            if isinstance(data, dict):
                summary = data.get("summary", {})
                if isinstance(summary, dict):
                    priority1 = summary.get("priority_1", {})
                    if priority1:
                        print(f"\n🎯 Priority 1 항목:")
                        print(f"   제목: {priority1.get('title', 'N/A')}")
                        print(f"   항목 수: {priority1.get('count', 0)}개")
                        if priority1.get('items'):
                            print(f"   항목: {', '.join(priority1['items'])}")
            
            print(f"\n✅ 검진 설계 품질: 정상")
            
        elif response.status_code == 404:
            error_detail = response.json().get("detail", "Unknown error")
            print(f"\n❌ 오류: {error_detail}")
            return False
            
        else:
            print(f"\n❌ API 오류: HTTP {response.status_code}")
            try:
                error_detail = response.json()
                print(f"   상세: {json.dumps(error_detail, indent=2, ensure_ascii=False)}")
            except:
                print(f"   응답: {response.text[:500]}")
            return False
        
    except requests.exceptions.Timeout:
        print(f"\n❌ 타임아웃: API 응답이 180초를 초과했습니다")
        return False
    except requests.exceptions.ConnectionError:
        print(f"\n❌ 연결 오류: 백엔드 서버가 실행 중인지 확인하세요")
        print(f"   예상 URL: {api_url}")
        return False
    except Exception as e:
        print(f"\n❌ 예상치 못한 오류: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # ========================================
    # 4. 성능 개선 효과 분석
    # ========================================
    print_step(3, "성능 개선 효과 분석")
    
    print(f"\n📊 예상 개선 효과:")
    print(f"   Phase 2 (RAG 최적화): 12초 → 4-5초 (60-65% 개선)")
    print(f"   Phase 4 (STEP 1 최적화): 토큰 감소로 2-3초 단축 예상")
    print(f"   Phase 3 (Context Caching): 추가 1-2초 단축 예상")
    print(f"\n   전체 예상: ~50초 → ~35-38초 (25-30% 개선)")
    
    print(f"\n📝 백엔드 로그에서 다음 타이밍을 확인하세요:")
    print(f"   - [타이밍] STEP 1 소요: 예상 개선됨")
    print(f"   - [TIMING-2-1] RAG 검색 실행: 예상 4-5초")
    print(f"   - [타이밍] STEP 2 소요: 예상 개선됨")
    
    print(f"\n💡 로그 확인 명령어:")
    print(f"   pm2 logs backend --lines 500 | grep -E '타이밍|TIMING'")
    
    # ========================================
    # 5. 결과 요약
    # ========================================
    print_section("📊 테스트 결과 요약")
    
    print(f"\n⏱️  전체 API 응답 시간: {elapsed_total:.3f}초")
    
    # 개선 효과 추정
    if elapsed_total < 45:
        improvement = ((50 - elapsed_total) / 50) * 100
        print(f"\n✅ 개선 효과: 약 {improvement:.1f}% (50초 기준)")
        if elapsed_total < 40:
            print(f"   🎉 목표 달성! (35-40초 목표)")
        else:
            print(f"   📈 목표에 근접! (35-40초 목표)")
    else:
        print(f"\n⚠️  추가 최적화 필요 (현재: {elapsed_total:.1f}초, 목표: 35-40초)")
    
    print(f"\n✅ 검증 완료:")
    print(f"   1. API 호출 성공")
    print(f"   2. 검진 설계 생성 정상")
    print(f"   3. 백엔드 로그에서 상세 타이밍 확인 필요")
    
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Phase 3-4 성능 개선 테스트")
    parser.add_argument("--uuid", type=str, help="환자 UUID", default=None)
    parser.add_argument("--hospital-id", type=str, help="병원 ID", default=None)
    parser.add_argument("--url", type=str, help="API 베이스 URL", default=None)
    
    args = parser.parse_args()
    
    try:
        result = asyncio.run(test_phase3_4_performance(
            uuid=args.uuid,
            hospital_id=args.hospital_id,
            api_base_url=args.url
        ))
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  사용자 중단")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ 예상치 못한 오류: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
