"""
Mediarc API HTTP 호출 서비스
"""

import httpx
from typing import Dict, Any, Optional
from .constants import DEFAULT_RETURN_TYPE


async def call_mediarc_api(
    api_url: str,
    api_key: str,
    user_name: str,
    twobecon_data: Dict[str, Any],
    return_type: str = DEFAULT_RETURN_TYPE,
    timeout: int = 30
) -> Dict[str, Any]:
    """
    Mediarc API 호출
    
    Args:
        api_url: Mediarc API 엔드포인트 URL
        api_key: 파트너 API 키
        user_name: 사용자 이름
        twobecon_data: Twobecon 형식 데이터
        return_type: 반환 타입 ("both", "pdf", "data")
        timeout: 타임아웃 (초)
        
    Returns:
        API 응답 데이터
        {
            "success": True/False,
            "data": {
                "mkt_uuid": "...",
                "report_url": "...",
                "bodyage": 42,
                "rank": 15,
                "analyzed_at": "...",
                "disease_data": {...},
                "cancer_data": {...}
            },
            "error": "..." (실패 시)
        }
    """
    
    try:
        # 요청 페이로드 구성
        payload = {
            "api_key": api_key,
            "user_name": user_name,
            "twobecon_data": twobecon_data,
            "return_type": return_type
        }
        
        print(f"📡 [Mediarc API] 요청 시작:")
        print(f"   - URL: {api_url}")
        print(f"   - user_name: {user_name}")
        print(f"   - tid: {twobecon_data.get('tid')}")
        print(f"   - return_type: {return_type}")
        print(f"\n📦 [Mediarc API] 전송 payload:")
        import json
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        
        # HTTP POST 요청
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                api_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
        
        # 응답 상태 확인
        if response.status_code != 200:
            error_msg = f"API 호출 실패: HTTP {response.status_code}"
            try:
                error_detail = response.json()
                error_msg = f"{error_msg} - {error_detail.get('error', error_detail)}"
            except:
                error_msg = f"{error_msg} - {response.text}"
            
            print(f"❌ [Mediarc API] {error_msg}")
            return {
                "success": False,
                "error": error_msg
            }
        
        # 응답 데이터 파싱
        response_data = response.json()
        
        # mediarC 객체에서 분석 데이터 추출
        mediarc = response_data.get('mediarC', {})
        
        print(f"✅ [Mediarc API] 응답 성공:")
        print(f"   - mkt_uuid: {response_data.get('mkt_uuid')}")
        print(f"   - bodyage: {mediarc.get('bodyage')}")
        print(f"   - rank: {mediarc.get('rank')}")
        print(f"   - analyzed_at: {mediarc.get('analyzed_at')}")
        
        # disease와 cancer 데이터 분리
        all_data = mediarc.get('data', [])
        disease_data = [item for item in all_data if item.get('type') == 'disease']
        cancer_data = [item for item in all_data if item.get('type') == 'cancer']
        
        # 데이터 구조화
        result = {
            "success": True,
            "data": {
                "mkt_uuid": response_data.get('mkt_uuid'),
                "report_url": response_data.get('report_url'),
                "provider": mediarc.get('provider', 'twobecon'),
                "analyzed_at": mediarc.get('analyzed_at'),
                "bodyage": mediarc.get('bodyage'),
                "rank": mediarc.get('rank'),
                "disease_data": disease_data,
                "cancer_data": cancer_data,
            }
        }
        
        return result
        
    except httpx.TimeoutException:
        error_msg = f"API 호출 타임아웃 ({timeout}초 초과)"
        print(f"⏱️ [Mediarc API] {error_msg}")
        return {
            "success": False,
            "error": error_msg
        }
        
    except httpx.RequestError as e:
        error_msg = f"API 호출 네트워크 오류: {str(e)}"
        print(f"🌐 [Mediarc API] {error_msg}")
        return {
            "success": False,
            "error": error_msg
        }
        
    except Exception as e:
        error_msg = f"API 호출 예외: {str(e)}"
        print(f"❌ [Mediarc API] {error_msg}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": error_msg
        }
