"""
Mediarc 질병예측 리포트 생성 서비스
"""

from typing import Dict, Any, Optional
from .constants import MEDIARC_API_URL, MEDIARC_API_KEY
from .data_mapper import map_checkup_to_twobecon, map_questionnaire_to_codes
from .report_service import call_mediarc_api


async def generate_mediarc_report_async(
    patient_uuid: str,
    hospital_id: str,
    session_id: str,
    service: 'WelnoDataService',
    questionnaire_data: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Mediarc 질병예측 리포트 자동 생성 (백그라운드)
    
    이 함수는 asyncio.create_task()로 호출되어 독립 실행됩니다.
    틸코 검진 데이터 수집 완료 후 백그라운드에서 병렬로 실행되며,
    처방전 데이터 수집을 방해하지 않습니다.
    
    Args:
        patient_uuid: 환자 UUID
        hospital_id: 병원 ID
        session_id: 세션 ID
        service: WelnoDataService 인스턴스
        
    Returns:
        bool: 성공 여부
    """
    try:
        print(f"🔄 [Mediarc] 리포트 생성 시작: {patient_uuid}")
        
        # 1. 환자 정보 조회
        patient = await service.get_patient_by_uuid(patient_uuid)
        if not patient or 'error' in patient:
            print(f"❌ [Mediarc] 환자 정보 없음: {patient_uuid}")
            return False
        
        # 2. 검진 데이터 조회 (최신 데이터)
        health_data_result = await service.get_patient_health_data(patient_uuid, hospital_id)
        if not health_data_result or not health_data_result.get('health_data'):
            print(f"❌ [Mediarc] 검진 데이터 없음: {patient_uuid}")
            return False
        
        # 3. 최신 검진 데이터 추출
        checkup_list = health_data_result['health_data']
        if not checkup_list or len(checkup_list) == 0:
            print(f"❌ [Mediarc] 검진 기록 없음")
            return False
        
        latest_checkup = checkup_list[0]  # 가장 최근 검진
        
        # raw_data에서 전체 검진 정보 추출
        checkup_raw_data = latest_checkup.get('raw_data', {})
        if not checkup_raw_data or not isinstance(checkup_raw_data, dict):
            print(f"❌ [Mediarc] 검진 raw_data 없음")
            return False
        
        print(f"✅ [Mediarc] 검진 데이터 확인: Year={checkup_raw_data.get('Year')}, Date={checkup_raw_data.get('CheckUpDate')}")
        
        # 4. 검진 데이터 → 투비콘 형식 변환
        twobecon_data = map_checkup_to_twobecon(
            checkup_data=checkup_raw_data,
            patient_info=patient,
            questionnaire_data=questionnaire_data  # 문진 데이터 추가
        )
        
        if questionnaire_data:
            print(f"✅ [Mediarc] 문진 데이터 포함하여 변환 완료")
        print(f"✅ [Mediarc] Twobecon 데이터 변환 완료: tid={twobecon_data.get('tid')}")
        
        # 5. Mediarc API 호출
        print(f"📡 [Mediarc] API 호출 시작")
        response = await call_mediarc_api(
            api_url=MEDIARC_API_URL,
            api_key=MEDIARC_API_KEY,
            user_name=patient.get('name', '사용자'),
            twobecon_data=twobecon_data,
            return_type='both'  # PDF + 데이터
        )
        
        if not response.get('success'):
            print(f"❌ [Mediarc] API 실패: {response.get('error')}")
            return False
        
        print(f"✅ [Mediarc] API 응답 성공")
        
        # 6. DB 저장
        saved = await service.save_mediarc_report(
            patient_uuid=patient_uuid,
            hospital_id=hospital_id,
            mediarc_response=response,
            has_questionnaire=bool(questionnaire_data),  # 문진 데이터 있으면 True
            questionnaire_data=questionnaire_data  # 문진 데이터 저장
        )
        
        if not saved:
            print(f"❌ [Mediarc] DB 저장 실패")
            return False
        
        print(f"✅ [Mediarc] 리포트 생성 및 저장 완료")
        
        # ⭐ 7. WebSocket으로 프론트엔드에 Mediarc 완료 알림
        try:
            from app.api.v1.endpoints.websocket_auth import notify_mediarc_completed
            
            # Mediarc 응답에서 핵심 정보 추출
            mediarc_data = response.get('data', {})
            report_data = {
                "bodyage": mediarc_data.get('bodyage'),
                "rank": mediarc_data.get('rank'),
                "has_questionnaire": bool(questionnaire_data),  # 문진 데이터 반영 여부
                "mkt_uuid": mediarc_data.get('mkt_uuid'),
                "report_url": mediarc_data.get('report_url')
            }
            
            await notify_mediarc_completed(session_id, report_data)
            print(f"📢 [Mediarc] 프론트엔드 알림 전송 완료")
            
        except Exception as notify_error:
            # 알림 실패는 로그만 남기고 진행
            print(f"⚠️ [Mediarc] WebSocket 알림 실패 (데이터는 저장됨): {notify_error}")
        
        return True
        
    except Exception as e:
        # ⚠️ 에러 발생해도 전체 플로우 영향 없음 (독립 실행)
        print(f"❌ [Mediarc독립태스크] 예외: {e}")
        import traceback
        traceback.print_exc()
        return False


__all__ = [
    'generate_mediarc_report_async',
    'map_checkup_to_twobecon',
    'map_questionnaire_to_codes',
    'call_mediarc_api',
]
