"""
Campaign 결제 API - 질병예측 리포트
KG 이니시스 모바일 결제 연동

작성일: 2026-01-24
"""

import json
import hashlib
import base64
import time
import logging
from fastapi import APIRouter, HTTPException, Request, Form
from fastapi.responses import RedirectResponse, JSONResponse
from typing import Dict, Any, Optional
from datetime import datetime

from ....config.payment_config import (
    INICIS_MOBILE_MID,
    INICIS_MOBILE_HASH_KEY,
    PAYMENT_AMOUNT,
    SERVICE_DOMAIN
)
from ....utils.partner_encryption import decrypt_user_data
from ....core.database import DatabaseManager
from ....services.mediarc import generate_mediarc_report_async
from ....services.campaigns.email_service import send_disease_prediction_report_email

logger = logging.getLogger(__name__)
router = APIRouter()

db_manager = DatabaseManager()


@router.post("/disease-prediction/init-payment/")
async def init_payment(request: Request):
    """
    결제 초기화 API: 주문번호 생성 및 P_CHKFAKE 서명 생성
    """
    try:
        data = await request.json()
        encrypted_data = data.get('data')
        uuid = data.get('uuid')
        
        # 1. 암호화된 데이터 복호화
        user_info = {}
        if encrypted_data:
            user_info = decrypt_user_data(encrypted_data)
            if not user_info:
                raise HTTPException(status_code=400, detail='Invalid encrypted data')
        else:
            # 기존 방식 호환 (직접 파라미터가 있는 경우)
            user_info = data
            
        user_name = user_info.get('name', '고객')
        email = user_info.get('email', '')
        
        # 주문번호 생성 (MID + timestamp)
        oid = f"{INICIS_MOBILE_MID}_{int(time.time() * 1000)}"
        timestamp = str(int(time.time() * 1000))
        
        # P_CHKFAKE 생성: BASE64_ENCODE(SHA512(P_AMT+P_OID+P_TIMESTAMP+HashKey))
        hash_str = f"{PAYMENT_AMOUNT}{oid}{timestamp}{INICIS_MOBILE_HASH_KEY}"
        chkfake = base64.b64encode(hashlib.sha512(hash_str.encode('utf-8')).digest()).decode('utf-8')
        
        # DB에 주문 정보 저장 (READY 상태)
        with db_manager.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO welno.tb_campaign_payments (oid, uuid, user_name, user_data, amount, status, email)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (oid, uuid, user_name, json.dumps(user_info), PAYMENT_AMOUNT, 'READY', email))
                conn.commit()
        
        return JSONResponse({
            'success': True,
            'P_MID': INICIS_MOBILE_MID,
            'P_OID': oid,
            'P_AMT': str(PAYMENT_AMOUNT),
            'P_TIMESTAMP': timestamp,
            'P_CHKFAKE': chkfake,
            'P_NEXT_URL': f"{SERVICE_DOMAIN}/api/v1/campaigns/disease-prediction/payment-callback/"
        })
        
    except Exception as e:
        logger.error(f"init_payment error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/disease-prediction/payment-callback/")
async def payment_callback(
    P_STATUS: str = Form(...),
    P_RMESG1: str = Form(default=''),
    P_TID: str = Form(...),
    P_REQ_URL: str = Form(...),
    P_NOTI: str = Form(...)  # oid
):
    """
    이니시스 결제 인증 콜백: 인증 결과를 받고 최종 승인 요청 수행
    """
    p_oid = P_NOTI
    
    logger.info(f"payment_callback received: status={P_STATUS}, oid={p_oid}, tid={P_TID}")

    if P_STATUS != '00':
        update_payment_status(p_oid, 'FAILED', error_msg=P_RMESG1)
        return RedirectResponse(
            url=f'{SERVICE_DOMAIN}/campaigns/disease-prediction/?page=result&status=fail&message={P_RMESG1}&oid={p_oid}'
        )

    # 최종 승인 요청 (Server to Server)
    try:
        import httpx
        
        # TID의 11~20번째 자리가 MID임
        mid_from_tid = P_TID[10:20]
        
        approval_data = {
            'P_MID': mid_from_tid,
            'P_TID': P_TID
        }
        
        logger.info(f"Requesting final approval to: {P_REQ_URL}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(P_REQ_URL, data=approval_data, timeout=30.0)
        
        # 응답 파싱 (이니시스 승인 결과는 query string 형식)
        approval_res = {}
        for pair in response.text.split('&'):
            if '=' in pair:
                key, value = pair.split('=', 1)
                approval_res[key] = value
        
        final_status = approval_res.get('P_STATUS')
        final_msg = approval_res.get('P_RMESG1', '')
        
        if final_status == '00':
            # 결제 성공!
            update_payment_status(
                p_oid, 'COMPLETED', 
                tid=P_TID,
                method=approval_res.get('P_TYPE'), 
                auth_date=approval_res.get('P_AUTH_DT')
            )
            
            # 결제 데이터 가져오기 및 리포트 생성 트리거
            order_data = get_payment_data(p_oid)
            if order_data:
                await trigger_report_generation(order_data)
            
            return RedirectResponse(
                url=f'{SERVICE_DOMAIN}/campaigns/disease-prediction/?page=result&status=success&oid={p_oid}'
            )
        else:
            update_payment_status(p_oid, 'FAILED', error_msg=final_msg)
            return RedirectResponse(
                url=f'{SERVICE_DOMAIN}/campaigns/disease-prediction/?page=result&status=fail&message={final_msg}&oid={p_oid}'
            )

    except Exception as e:
        logger.error(f"Approval error: {str(e)}", exc_info=True)
        update_payment_status(p_oid, 'FAILED', error_msg=str(e))
        return RedirectResponse(
            url=f'{SERVICE_DOMAIN}/campaigns/disease-prediction/?page=result&status=fail&message=Approval+Error&oid={p_oid}'
        )


@router.post("/disease-prediction/update-email/")
async def update_email_and_send(request: Request):
    """
    사후 이메일 등록 및 리포트 발송
    """
    try:
        data = await request.json()
        oid = data.get('oid')
        email = data.get('email')
        
        if not oid or not email:
            raise HTTPException(status_code=400, detail='OID and Email required')
        
        # DB에 이메일 업데이트
        with db_manager.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE welno.tb_campaign_payments
                    SET email = %s, updated_at = NOW()
                    WHERE oid = %s
                    RETURNING report_url, user_name
                """, (email, oid))
                
                result = cur.fetchone()
                conn.commit()
        
        if not result:
            raise HTTPException(status_code=404, detail='Order not found')
        
        report_url, user_name = result
        
        # 리포트가 이미 생성되어 있으면 즉시 발송
        if report_url:
            success = send_disease_prediction_report_email(email, user_name, report_url)
            return JSONResponse({
                'success': success,
                'message': '리포트가 발송되었습니다.' if success else '이메일 발송 실패'
            })
        else:
            # 리포트 생성 대기 중
            return JSONResponse({
                'success': True,
                'message': '리포트 생성 중입니다. 완료 시 이메일로 발송됩니다.'
            })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"update_email error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def update_payment_status(
    oid: str, 
    status: str, 
    tid: Optional[str] = None, 
    method: Optional[str] = None, 
    auth_date: Optional[str] = None, 
    error_msg: Optional[str] = None
):
    """결제 상태 업데이트"""
    try:
        with db_manager.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE welno.tb_campaign_payments
                    SET status = %s, tid = %s, payment_method = %s, auth_date = %s, 
                        error_message = %s, updated_at = NOW()
                    WHERE oid = %s
                """, (status, tid, method, auth_date, error_msg, oid))
                conn.commit()
    except Exception as e:
        logger.error(f"update_payment_status error: {str(e)}")


def get_payment_data(oid: str) -> Optional[Dict[str, Any]]:
    """결제 데이터 조회"""
    try:
        with db_manager.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT oid, uuid, user_name, user_data, email
                    FROM welno.tb_campaign_payments
                    WHERE oid = %s
                """, (oid,))
                
                row = cur.fetchone()
                if row:
                    return {
                        'oid': row[0],
                        'uuid': row[1],
                        'user_name': row[2],
                        'user_data': row[3],
                        'email': row[4]
                    }
        return None
    except Exception as e:
        logger.error(f"get_payment_data error: {str(e)}")
        return None


async def trigger_report_generation(order_data: Dict[str, Any]):
    """리포트 생성 트리거 (백그라운드)"""
    try:
        user_data = order_data['user_data']
        uuid = order_data['uuid']
        user_name = order_data['user_name']
        email = order_data.get('email')
        oid = order_data['oid']
        
        logger.info(f"🔄 Triggering Mediarc report for oid={oid}, uuid={uuid}")
        
        # Mediarc 리포트 생성 (비동기)
        # 기존 Mediarc 서비스 재사용
        result = await generate_mediarc_report_async(
            patient_uuid=uuid,
            hospital_id='kindhabit',  # 캠페인 전용 병원 ID
            user_data=user_data
        )
        
        if result and result.get('success'):
            report_url = result.get('report_url')
            
            # DB에 리포트 URL 저장
            with db_manager.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE welno.tb_campaign_payments
                        SET report_url = %s, 
                            mediarc_response = %s,
                            updated_at = NOW()
                        WHERE oid = %s
                    """, (report_url, json.dumps(result), oid))
                    conn.commit()
            
            # 이메일 발송
            if email and report_url:
                send_disease_prediction_report_email(email, user_name, report_url)
                logger.info(f"✅ Report generated and email sent: {email}")
            else:
                logger.info(f"✅ Report generated but no email: {report_url}")
        else:
            logger.error(f"❌ Mediarc report generation failed for oid={oid}")
            
    except Exception as e:
        logger.error(f"trigger_report_generation error: {str(e)}", exc_info=True)
