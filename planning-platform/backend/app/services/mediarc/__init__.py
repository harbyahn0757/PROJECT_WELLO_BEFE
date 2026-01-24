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
    Mediarc 질병예측 리포트 자동 생성 (통합 파이프라인 사용)
    """
    try:
        print(f"🔄 [Mediarc] 리포트 생성 시작 (통합 파이프라인): {patient_uuid}")
        
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
        
        latest_checkup = checkup_list[0]
        checkup_raw_data = latest_checkup.get('raw_data', {})
        
        # 4. 검진 데이터 → 투비콘 형식 변환 (Tilko 매퍼 사용)
        twobecon_data = map_checkup_to_twobecon(
            checkup_data=checkup_raw_data,
            patient_info=patient,
            questionnaire_data=questionnaire_data
        )
        
        # 5. 통합 파이프라인 실행
        from .report_service import run_disease_report_pipeline
        result = await run_disease_report_pipeline(
            mapped_data=twobecon_data,
            user_info={
                "uuid": patient_uuid,
                "name": patient.get('name', '사용자'),
                "email": patient.get('email') # 웰노 유저 이메일 정보 포함
            },
            hospital_id=hospital_id,
            session_id=session_id
        )
        
        # 6. 최종 완료 상태 업데이트 (캠페인인 경우)
        try:
            from app.api.v1.endpoints.campaign_payment import update_pipeline_step
            import asyncpg
            from app.core.config import settings
            
            conn = await asyncpg.connect(
                host=settings.DB_HOST if hasattr(settings, 'DB_HOST') else '10.0.1.10',
                port=settings.DB_PORT if hasattr(settings, 'DB_PORT') else 5432,
                database=settings.DB_NAME if hasattr(settings, 'DB_NAME') else 'p9_mkt_biz',
                user=settings.DB_USER if hasattr(settings, 'DB_USER') else 'peernine',
                password=settings.DB_PASSWORD if hasattr(settings, 'DB_PASSWORD') else 'autumn3334!'
            )
            oid = await conn.fetchval("SELECT oid FROM welno.tb_campaign_payments WHERE uuid = $1 AND status = 'COMPLETED' ORDER BY created_at DESC LIMIT 1", patient_uuid)
            await conn.close()
            
            if oid and result.get('success'):
                update_pipeline_step(oid, 'COMPLETED')
        except:
            pass

        return result.get('success', False)
        
    except Exception as e:
        print(f"❌ [Mediarc통합] 예외: {e}")
        return False


__all__ = [
    'generate_mediarc_report_async',
    'map_checkup_to_twobecon',
    'map_questionnaire_to_codes',
    'call_mediarc_api',
]
