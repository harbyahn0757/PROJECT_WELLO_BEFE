"""
Mediarc API HTTP 호출 서비스
"""

import httpx
import json
import logging
from typing import Dict, Any, Optional
from .constants import DEFAULT_RETURN_TYPE, MEDIARC_API_URL, MEDIARC_API_KEY
from ...core.database import DatabaseManager

logger = logging.getLogger(__name__)
db_manager = DatabaseManager()


async def run_disease_report_pipeline(
    mapped_data: Dict[str, Any],
    user_info: Dict[str, Any],
    hospital_id: str = "PEERNINE",
    partner_id: Optional[str] = None,
    oid: Optional[str] = None,
    session_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    통합 질병예측 리포트 생성 파이프라인
    
    1. Mediarc API 호출
    2. welno.welno_mediarc_reports 통합 저장 (필수)
    3. welno.tb_campaign_payments 업데이트 (선택 - 파트너 케이스)
    4. 알림 (이메일, WebSocket)
    
    Args:
        mapped_data: 표준 Twobecon 형식 데이터 (매퍼에서 변환됨)
        user_info: 사용자 정보 (name, uuid, email 등)
        hospital_id: 병원 ID (기본: PEERNINE)
        partner_id: 파트너사 ID (선택)
        oid: 결제 주문번호 (선택 - 파트너 케이스)
        session_id: WebSocket 세션 ID (선택)
        
    Returns:
        결과 딕셔너리
    """
    patient_uuid = user_info.get('uuid')
    user_name = user_info.get('name', '사용자')
    email = user_info.get('email')
    
    logger.info(f"🚀 [Pipeline] 시작: uuid={patient_uuid}, name={user_name}, partner={partner_id}")
    
    try:
        # 1. Mediarc API 호출 (표준 규격 사용)
        response = await call_mediarc_api(
            api_url=MEDIARC_API_URL,
            api_key=MEDIARC_API_KEY,
            user_name=user_name,
            twobecon_data=mapped_data,
            return_type='both'
        )
        
        if not response.get('success'):
            error_msg = response.get('error', 'API 호출 실패')
            logger.error(f"❌ [Pipeline] API 실패: {error_msg}")
            return {"success": False, "error": error_msg}
            
        report_data = response.get('data', {})
        report_url = report_data.get('report_url')
        
        # 2. 통합 DB (welno_mediarc_reports) 저장 로직
        with db_manager.get_connection() as conn:
            with conn.cursor() as cur:
                # 2-1. welno_patients 테이블에 patient_uuid가 있는지 확인 (없으면 파트너 유저)
                cur.execute("SELECT id FROM welno.welno_patients WHERE uuid = %s", (patient_uuid,))
                patient_row = cur.fetchone()
                
                # 2-2. welno_mediarc_reports에 저장 (모든 케이스 통합 관리)
                cur.execute("""
                    INSERT INTO welno.welno_mediarc_reports (
                        patient_uuid, hospital_id, report_url, 
                        bodyage, rank, disease_data, cancer_data,
                        provider, analyzed_at, raw_response
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (patient_uuid, hospital_id) DO UPDATE SET
                        report_url = EXCLUDED.report_url,
                        bodyage = EXCLUDED.bodyage,
                        rank = EXCLUDED.rank,
                        disease_data = EXCLUDED.disease_data,
                        cancer_data = EXCLUDED.cancer_data,
                        analyzed_at = EXCLUDED.analyzed_at,
                        raw_response = EXCLUDED.raw_response,
                        updated_at = NOW()
                """, (
                    patient_uuid, hospital_id, report_url,
                    report_data.get('bodyage'), report_data.get('rank'),
                    json.dumps(report_data.get('disease_data', [])),
                    json.dumps(report_data.get('cancer_data', [])),
                    report_data.get('provider', 'twobecon'),
                    report_data.get('analyzed_at'),
                    json.dumps(response) # 전체 응답 저장
                ))
                
                # 2-3. 파트너사인 경우 tb_campaign_payments 업데이트
                if partner_id and oid:
                    cur.execute("""
                        UPDATE welno.tb_campaign_payments
                        SET report_url = %s,
                            mediarc_response = %s,
                            updated_at = NOW()
                        WHERE oid = %s
                    """, (report_url, json.dumps(response), oid))
                    
                # 2-4. WELNO 환자 플래그 업데이트 (환자 테이블에 존재할 때만)
                if patient_row:
                    cur.execute("""
                        UPDATE welno.welno_patients
                        SET has_mediarc_report = true,
                            updated_at = NOW()
                        WHERE uuid = %s
                    """, (patient_uuid,))
                
                conn.commit()
        
        # 3. 알림 (WebSocket 및 이메일)
        # 3-1. WebSocket 알림 (프론트엔드 실시간 갱신용)
        if session_id:
            try:
                from app.api.v1.endpoints.websocket_auth import notify_mediarc_completed
                await notify_mediarc_completed(session_id, {
                    "bodyage": report_data.get('bodyage'),
                    "rank": report_data.get('rank'),
                    "report_url": report_url
                })
                logger.info(f"📢 [Pipeline] WebSocket 알림 전송 완료 (session={session_id})")
            except Exception as e:
                logger.warning(f"⚠️ [Pipeline] WebSocket 알림 실패: {e}")

        # 3-2. 이메일 발송
        if email and report_url:
            try:
                from app.services.campaigns.email_service import send_disease_prediction_report_email
                send_disease_prediction_report_email(email, user_name, report_url)
                logger.info(f"📧 [Pipeline] 이메일 발송 완료: {email}")
            except Exception as e:
                logger.warning(f"⚠️ [Pipeline] 이메일 발송 실패: {e}")
                
        logger.info(f"✅ [Pipeline] 전체 프로세스 성공: oid={oid}")
        return {"success": True, "report_url": report_url, "data": report_data}
        
    except Exception as e:
        logger.error(f"❌ [Pipeline] 예외 발생: {str(e)}", exc_info=True)
        return {"success": False, "error": str(e)}


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
