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
    PAYMENT_AMOUNT,  # 기본값으로 사용
    SERVICE_DOMAIN
)
from ....utils.partner_config import (
    get_payment_amount, 
    get_partner_encryption_keys,
    get_partner_config_by_api_key,
    get_partner_config
)
from ....utils.partner_encryption import decrypt_user_data
from ....core.database import DatabaseManager
from ....services.mediarc.report_service import run_disease_report_pipeline
from ....services.mediarc.data_mapper import map_partner_data_to_twobecon
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
        api_key = data.get('api_key')
        partner_id = data.get('partner_id')
        
        # 1. 파트너 식별 및 설정 로드
        partner_config = None
        if api_key:
            partner_config = get_partner_config_by_api_key(api_key)
            if partner_config:
                partner_id = partner_config["partner_id"]
        
        if not partner_config and partner_id:
            partner_config = get_partner_config(partner_id)
            
        if not partner_config:
            partner_id = 'kindhabit'  # 최후의 보루
            
        # 2. 암호화된 데이터 복호화
        user_info = {}
        if encrypted_data:
            aes_key = None
            aes_iv = None
            if partner_config:
                enc_keys = partner_config["config"].get("encryption", {})
                aes_key = enc_keys.get("aes_key")
                aes_iv = enc_keys.get("aes_iv")
            
            user_info = decrypt_user_data(encrypted_data, aes_key, aes_iv)
            if not user_info:
                raise HTTPException(status_code=400, detail='Invalid encrypted data')
        else:
            # 기존 방식 호환 (직접 파라미터가 있는 경우)
            user_info = data
            
        user_name = user_info.get('name', '고객')
        email = user_info.get('email', '')
        
        # 3. 파트너별 결제 금액 조회
        payment_amount = get_payment_amount(partner_id)
        logger.info(f"파트너 {partner_id} 결제 금액: {payment_amount}원")
        
        # 주문번호 생성 (MID + timestamp)
        oid = f"{INICIS_MOBILE_MID}_{int(time.time() * 1000)}"
        timestamp = str(int(time.time() * 1000))
        
        # P_CHKFAKE 생성: BASE64_ENCODE(SHA512(P_AMT+P_OID+P_TIMESTAMP+HashKey))
        hash_str = f"{payment_amount}{oid}{timestamp}{INICIS_MOBILE_HASH_KEY}"
        chkfake = base64.b64encode(hashlib.sha512(hash_str.encode('utf-8')).digest()).decode('utf-8')
        
        # DB에 주문 정보 저장 (READY 상태, partner_id 포함)
        with db_manager.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO welno.tb_campaign_payments (oid, uuid, partner_id, user_name, user_data, amount, status, email)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (oid, uuid, partner_id, user_name, json.dumps(user_info), payment_amount, 'READY', email))
                conn.commit()
        
        return JSONResponse({
            'success': True,
            'P_MID': INICIS_MOBILE_MID,
            'P_OID': oid,
            'P_AMT': str(payment_amount),  # 파트너별 금액
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
            url=f'{SERVICE_DOMAIN}/campaigns/disease-prediction/?page=result&status=fail&message={P_RMESG1}&oid={p_oid}',
            status_code=303 # 405 Not Allowed 방지를 위해 303(See Other) 사용
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
            
            # 결제 데이터 가져오기
            order_data = get_payment_data(p_oid)
            if not order_data:
                return RedirectResponse(url=f'{SERVICE_DOMAIN}/campaigns/disease-prediction/?page=result&status=fail', status_code=303)

            uuid = order_data.get('uuid')
            user_data = order_data.get('user_data')
            
            # 데이터 개수 체크 (암호화된 경우 복호화 후 체크)
            metric_count = 0
            if isinstance(user_data, str):
                from ....utils.partner_config import get_partner_config_by_api_key, get_partner_config
                # OID에 해당하는 partner_id를 가져오기 위해 다시 조회
                with db_manager.get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT partner_id FROM welno.tb_campaign_payments WHERE oid = %s", (p_oid,))
                        p_row = cur.fetchone()
                        p_id = p_row[0] if p_row else 'kindhabit'
                
                from ....utils.partner_encryption import get_partner_encryption_keys, decrypt_user_data
                keys = get_partner_encryption_keys(p_id)
                if keys:
                    decrypted = decrypt_user_data(user_data, keys[0], keys[1])
                    if decrypted:
                        metric_count = get_metric_count(decrypted)
            elif isinstance(user_data, dict):
                metric_count = get_metric_count(user_data)

            logger.info(f"💳 [Payment] 결제 성공 후 데이터 체크: uuid={uuid}, metrics={metric_count}")

            # 1. 데이터가 충분한 경우 (5개 이상) -> 리포트 생성 트리거 및 결과 페이지로 이동
            if metric_count >= 5:
                # ✅ [추가] 데이터가 충분하므로 즉시 정식 환자로 등록 (마케팅 활용 목적)
                try:
                    from ....services.welno_data_service import welno_data_service
                    
                    # 1순위: 방금 복호화된 데이터, 2순위: order_data 내 user_data
                    u_info = decrypted if 'decrypted' in locals() and decrypted else order_data.get('user_data', {})
                    if isinstance(u_info, str):
                        u_info = json.loads(u_info)
                        
                    user_info_for_reg = {
                        "name": u_info.get('name', order_data.get('user_name', '사용자')),
                        "phone_number": u_info.get('phone', u_info.get('phone_number', '')),
                        "birth_date": u_info.get('birth', u_info.get('birth_date', '')),
                        "gender": u_info.get('gender', 'M')
                    }
                    
                    import asyncio
                    asyncio.create_task(welno_data_service.save_patient_data(
                        uuid=uuid,
                        hospital_id="PEERNINE",
                        user_info=user_info_for_reg,
                        session_id=f"CAMPAIGN_{p_oid}"
                    ))
                    logger.info(f"✅ [Payment] 데이터 충분 유저 즉시 정식 등록 완료: {uuid}")
                except Exception as reg_err:
                    logger.error(f"⚠️ [Payment] 정식 등록 실패 (무시): {reg_err}")

                update_pipeline_step(p_oid, 'REPORT_WAITING')
                import asyncio
                asyncio.create_task(trigger_report_generation(order_data))
                return RedirectResponse(
                    url=f'{SERVICE_DOMAIN}/campaigns/disease-prediction/?page=result&status=success&oid={p_oid}',
                    status_code=303
                )
            
            # 2. 데이터가 부족한 경우 (4개 이하) -> 틸코 인증 페이지로 즉시 이동
            else:
                logger.info(f"⚠️ [Payment] 데이터 부족({metric_count}개) -> 틸코 인증 유도")
                update_pipeline_step(p_oid, 'TILKO_READY')
                # return_to 경로 설정 (인증 완료 후 다시 돌아올 주소 - page=result로 변경)
                return_path = f"/campaigns/disease-prediction?page=result&status=success&oid={p_oid}"
                # 이름과 모드를 추가하여 맞춤 인사말 유도
                user_name_encoded = user_name.replace(' ', '+') # 단순 인코딩
                return RedirectResponse(
                    url=f'{SERVICE_DOMAIN}/login?return_to={return_path}&name={user_name_encoded}&mode=campaign&oid={p_oid}',
                    status_code=303
                )
        else:
            update_payment_status(p_oid, 'FAILED', error_msg=final_msg)
            return RedirectResponse(
                url=f'{SERVICE_DOMAIN}/campaigns/disease-prediction/?page=result&status=fail&message={final_msg}&oid={p_oid}',
                status_code=303 # 405 Not Allowed 방지를 위해 303(See Other) 사용
            )

    except Exception as e:
        logger.error(f"Approval error: {str(e)}", exc_info=True)
        update_payment_status(p_oid, 'FAILED', error_msg=str(e))
        return RedirectResponse(
            url=f'{SERVICE_DOMAIN}/campaigns/disease-prediction/?page=result&status=fail&message=Approval+Error&oid={p_oid}',
            status_code=303 # 405 Not Allowed 방지를 위해 303(See Other) 사용
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


def get_metric_count(data: Dict[str, Any]) -> int:
    """건강 지표 개수 산출"""
    health_metrics = [
        'height', 'weight', 'waist', 'waist_circumference', 'bmi',
        'sbp', 'bphigh', 'dbp', 'bplwst', 'fbs', 'blds', 
        'tc', 'totchole', 'hdl', 'hdlchole', 'ldl', 'ldlchole', 
        'tg', 'triglyceride', 'ast', 'sgotast', 'alt', 'sgptalt', 'scr', 'creatinine'
    ]
    return sum(1 for field in health_metrics if data.get(field) not in [None, '', 0, 0.0])


def update_pipeline_step(oid: str, step: str):
    """파이프라인 단계 업데이트 헬퍼"""
    try:
        with db_manager.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE welno.tb_campaign_payments SET pipeline_step = %s, updated_at = NOW() WHERE oid = %s",
                    (step, oid)
                )
                conn.commit()
                logger.info(f"📊 [Pipeline] Step updated: {oid} -> {step}")
    except Exception as e:
        logger.error(f"❌ [Pipeline] Step update failed: {e}")


async def trigger_report_generation(order_data: Dict[str, Any]):
    """리포트 생성 트리거 (통합 파이프라인 사용)"""
    try:
        oid = order_data['oid']
        uuid = order_data['uuid']
        partner_id = order_data.get('partner_id', 'kindhabit')
        user_name = order_data['user_name']
        email = order_data.get('email')
        
        logger.info(f"🔄 [Campaign] 리포트 생성 시작: oid={oid}, partner={partner_id}")
        
        # 1. Tilko 데이터 우선 확인 (welno_checkup_data)
        mapped_data = None
        health_data_result = None
        decrypted_data = None
        from ....services.welno_data_service import welno_data_service
        from ....services.mediarc.data_mapper import map_checkup_to_twobecon
        
        try:
            health_data_result = await welno_data_service.get_patient_health_data(uuid, "PEERNINE")
            if health_data_result and not health_data_result.get('error'):
                health_data_list = health_data_result.get('health_data', [])
                if health_data_list and len(health_data_list) > 0:
                    # 가장 최근 검진 데이터 사용
                    latest_checkup = health_data_list[0]
                    raw_data = latest_checkup.get('raw_data', {})
                    
                    # 환자 정보 조회
                    patient_info = health_data_result.get('patient', {})
                    if patient_info and raw_data:
                        # Tilko 데이터 형식으로 변환
                        tilko_checkup_data = {
                            'Inspections': raw_data.get('Inspections', []),
                            'CheckUpDate': latest_checkup.get('checkup_date', ''),
                            'Year': latest_checkup.get('year', '')
                        }
                        
                        mapped_data = map_checkup_to_twobecon(
                            checkup_data=tilko_checkup_data,
                            patient_info={
                                'name': patient_info.get('name', user_name),
                                'birth_date': patient_info.get('birth_date', ''),
                                'gender': patient_info.get('gender', 'M')
                            }
                        )
                        logger.info(f"✅ [Campaign] Tilko 데이터 사용: uuid={uuid}")
        except Exception as tilko_err:
            logger.warning(f"⚠️ [Campaign] Tilko 데이터 조회 실패, 파트너 데이터 사용: {tilko_err}")
        
        # 2. Tilko 데이터가 없으면 파트너 암호화 데이터 사용
        if not mapped_data:
            raw_user_data = order_data.get('user_data')
            
            # 파트너 키로 복호화
            if isinstance(raw_user_data, str):
                keys = get_partner_encryption_keys(partner_id)
                if keys:
                    aes_key, aes_iv = keys
                    try:
                        decrypted_data = decrypt_user_data(raw_user_data, aes_key, aes_iv)
                    except Exception as e:
                        logger.error(f"❌ [Campaign] 복호화 실패: {e}")
            else:
                decrypted_data = raw_user_data

            if not decrypted_data:
                logger.error(f"❌ [Campaign] 유효한 데이터가 없습니다. oid={oid}")
                return
                
            # 범용 매퍼를 통한 데이터 표준화 (MediLinx 약어 필드 대응 포함)
            mapped_data = map_partner_data_to_twobecon(decrypted_data, partner_id)
            logger.info(f"✅ [Campaign] 파트너 데이터 사용: oid={oid}")
        
        # 4. 통합 파이프라인 실행
        # run_disease_report_pipeline 내부에서 API 호출 + 통합 저장 + 알림까지 수행
        result = await run_disease_report_pipeline(
            mapped_data=mapped_data,
            user_info={
                "uuid": uuid,
                "name": user_name,
                "email": email
            },
            hospital_id="PEERNINE", # 캠페인 기본 병원 ID
            partner_id=partner_id,
            oid=oid
        )
        
        if result.get('success'):
            logger.info(f"✅ [Campaign] 리포트 생성 완료: oid={oid}, url={result.get('report_url')}")
            
            # 리포트 생성 성공 시에만 welno.welno_patients 테이블에 정식 등록
            try:
                from ....services.welno_data_service import welno_data_service
                
                # 환자 정보 추출 (Tilko 데이터 또는 파트너 데이터)
                patient_info = None
                if 'health_data_result' in locals() and health_data_result and not health_data_result.get('error'):
                    # Tilko 데이터에서 환자 정보 추출
                    patient_data = health_data_result.get('patient', {})
                    if patient_data:
                        patient_info = {
                            "name": patient_data.get('name', user_name),
                            "phone_number": patient_data.get('phone_number', ''),
                            "birth_date": patient_data.get('birth_date', ''),
                            "gender": patient_data.get('gender', 'M')
                        }
                
                # Tilko 데이터가 없으면 파트너 데이터 사용
                if not patient_info:
                    # decrypted_data는 파트너 데이터 사용 시에만 존재
                    if 'decrypted_data' in locals() and decrypted_data:
                        phone_number = decrypted_data.get('phone', decrypted_data.get('phone_number', ''))
                        birth_date_raw = decrypted_data.get('birth', decrypted_data.get('birth_date', ''))
                        gender = decrypted_data.get('gender', 'male')
                        
                        patient_info = {
                            "name": user_name,
                            "phone_number": phone_number,
                            "birth_date": birth_date_raw,
                            "gender": 'M' if gender in ['male', 'M'] else 'F' if gender in ['female', 'F'] else 'M'
                        }
                
                if patient_info:
                    await welno_data_service.save_patient_data(
                        uuid=uuid,
                        hospital_id="PEERNINE",
                        user_info=patient_info,
                        session_id=f"CAMPAIGN_{oid}"
                    )
                    logger.info(f"✅ [Campaign] 정식 환자 등록 완료: {uuid}")
                else:
                    logger.warning(f"⚠️ [Campaign] 환자 정보 부족으로 등록 건너뜀: uuid={uuid}")
            except Exception as e:
                logger.error(f"⚠️ [Campaign] 정식 환자 등록 실패 (리포트는 생성됨): {e}")
        else:
            logger.error(f"❌ [Campaign] 리포트 생성 실패: {result.get('error')}")
            
    except Exception as e:
        logger.error(f"❌ [Campaign] 트리거 오류: {str(e)}", exc_info=True)


@router.get("/disease-prediction/report")
async def get_campaign_report(oid: str):
    """주문번호로 리포트 정보 조회"""
    try:
        with db_manager.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT oid, status, report_url, error_message, updated_at,
                           mediarc_response, user_name
                    FROM welno.tb_campaign_payments
                    WHERE oid = %s
                """, (oid,))
                row = cur.fetchone()
                if row:
                    # mediarc_response가 {"success": true, "data": {...}} 형식이면 data만 추출
                    mediarc_response = row[5]
                    if mediarc_response and isinstance(mediarc_response, dict):
                        # response.data가 있으면 data만 반환 (하위 호환성 유지)
                        if "data" in mediarc_response and isinstance(mediarc_response.get("data"), dict):
                            mediarc_response = mediarc_response["data"]
                    
                    return {
                        "success": True,
                        "oid": row[0],
                        "status": row[1],
                        "report_url": row[2],
                        "error_message": row[3],
                        "updated_at": row[4],
                        "mediarc_response": mediarc_response,
                        "user_name": row[6]
                    }
        return {"success": False, "message": "주문 정보를 찾을 수 없습니다."}
    except Exception as e:
        logger.error(f"get_campaign_report error: {e}")
        return {"success": False, "message": str(e)}


@router.post("/disease-prediction/register-patient/")
async def register_patient_on_terms_agreement(request: Request):
    """
    약관동의 완료 시 welno_patients에 환자 등록
    파트너 데이터가 부족하면 유저 정보만 등록 (건강 데이터는 나중에 Tilko로 수집)
    """
    try:
        data = await request.json()
        uuid = data.get('uuid')
        oid = data.get('oid')
        user_info = data.get('user_info', {})
        terms_agreement = data.get('terms_agreement', {})
        api_key = data.get('api_key')
        partner_id = data.get('partner_id')
        
        if not uuid:
            raise HTTPException(status_code=400, detail="uuid가 필요합니다.")
        
        # 파트너 식별
        if api_key and not partner_id:
            partner_config = get_partner_config_by_api_key(api_key)
            if partner_config:
                partner_id = partner_config["partner_id"]
        
        if not partner_id:
            partner_id = 'kindhabit'
        
        logger.info(f"🚀 [환자등록] 약관동의 완료 시 등록: uuid={uuid}, oid={oid}, partner={partner_id}")
        
        # 1. oid로 기존 결제 정보 조회 (파트너 데이터 확인)
        decrypted_data = None
        with db_manager.get_connection() as conn:
            with conn.cursor() as cur:
                if oid:
                    cur.execute("""
                        SELECT user_data, user_name, email
                        FROM welno.tb_campaign_payments
                        WHERE oid = %s
                    """, (oid,))
                    row = cur.fetchone()
                    if row and row[0]:
                        user_data = row[0]
                        if isinstance(user_data, str):
                            import json
                            user_data = json.loads(user_data)
                        decrypted_data = user_data
                        logger.info(f"✅ [환자등록] 파트너 데이터 발견: oid={oid}")
        
        # 2. 환자 정보 추출 (user_info 우선, 없으면 decrypted_data 사용)
        patient_info = {}
        if user_info:
            patient_info = {
                "name": user_info.get('name', ''),
                "phone_number": user_info.get('phone', user_info.get('phone_number', '')),
                "birth_date": user_info.get('birth', user_info.get('birth_date', '')),
                "gender": user_info.get('gender', 'M')
            }
        elif decrypted_data:
            patient_info = {
                "name": decrypted_data.get('name', ''),
                "phone_number": decrypted_data.get('phone', decrypted_data.get('phone_number', '')),
                "birth_date": decrypted_data.get('birth', decrypted_data.get('birth_date', '')),
                "gender": 'M' if decrypted_data.get('gender', 'male') in ['male', 'M'] else 'F' if decrypted_data.get('gender') in ['female', 'F'] else 'M'
            }
        
        # 3. welno_patients에 등록 (기본 정보만, 건강 데이터는 나중에)
        if patient_info.get('name'):
            from ....services.welno_data_service import welno_data_service
            
            session_id = f"CAMPAIGN_TERMS_{oid}" if oid else f"CAMPAIGN_TERMS_{uuid}"
            patient_id = await welno_data_service.save_patient_data(
                uuid=uuid,
                hospital_id="PEERNINE",
                user_info=patient_info,
                session_id=session_id
            )
            
            if patient_id:
                # 4. 약관동의 정보 저장
                if terms_agreement:
                    try:
                        await welno_data_service.save_terms_agreement(
                            uuid=uuid,
                            hospital_id="PEERNINE",
                            terms_agreement=terms_agreement
                        )
                        logger.info(f"✅ [환자등록] 약관동의 정보 저장 완료: uuid={uuid}")
                    except Exception as e:
                        logger.warning(f"⚠️ [환자등록] 약관동의 저장 실패 (환자 등록은 완료): {e}")
                
                logger.info(f"✅ [환자등록] 환자 등록 완료: uuid={uuid}, patient_id={patient_id}")
                return {
                    "success": True,
                    "message": "환자 등록이 완료되었습니다.",
                    "patient_id": patient_id
                }
            else:
                logger.error(f"❌ [환자등록] 환자 등록 실패: uuid={uuid}")
                return {"success": False, "message": "환자 등록에 실패했습니다."}
        else:
            logger.warning(f"⚠️ [환자등록] 이름 정보 부족으로 등록 건너뜀: uuid={uuid}")
            return {"success": False, "message": "환자 이름 정보가 필요합니다."}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [환자등록] 오류: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/disease-prediction/generate")
async def trigger_generation_directly(request: Request):
    """결제 완료 유저를 위한 즉시 리포트 생성 트리거"""
    try:
        data = await request.json()
        oid = data.get('oid')
        uuid = data.get('uuid')
        api_key = data.get('api_key')
        partner_id = data.get('partner_id')
        
        # 파트너 식별
        if api_key and not partner_id:
            partner_config = get_partner_config_by_api_key(api_key)
            if partner_config:
                partner_id = partner_config["partner_id"]
        
        if not partner_id:
            partner_id = 'kindhabit'
            
        logger.info(f"🚀 [Direct Generate] 시작: oid={oid}, uuid={uuid}, partner={partner_id}")
        
        # 1. 기존 결제 정보 또는 사용자 정보 조회
        order_data = None
        with db_manager.get_connection() as conn:
            with conn.cursor() as cur:
                if oid:
                    cur.execute("SELECT oid, uuid, partner_id, user_name, user_data, email FROM welno.tb_campaign_payments WHERE oid = %s", (oid,))
                else:
                    cur.execute("SELECT oid, uuid, partner_id, user_name, user_data, email FROM welno.tb_campaign_payments WHERE uuid = %s AND partner_id = %s ORDER BY created_at DESC LIMIT 1", (uuid, partner_id))
                
                row = cur.fetchone()
                if row:
                    order_data = {
                        'oid': row[0], 'uuid': row[1], 'partner_id': row[2],
                        'user_name': row[3], 'user_data': row[4], 'email': row[5]
                    }

        if not order_data:
            raise HTTPException(status_code=404, detail="주문 정보를 찾을 수 없습니다.")

        # 2. 비동기로 리포트 생성 트리거
        import asyncio
        asyncio.create_task(trigger_report_generation(order_data))
        
        return {"success": True, "message": "리포트 생성이 시작되었습니다.", "oid": order_data['oid']}
        
    except Exception as e:
        logger.error(f"❌ [Direct Generate] 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))
