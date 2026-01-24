import logging
import json
import time
from typing import Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from pydantic import BaseModel

from ....core.database import db_manager
from ....utils.partner_config import get_partner_config_by_api_key, get_partner_config
from ....utils.partner_encryption import decrypt_user_data

router = APIRouter()
logger = logging.getLogger(__name__)

def get_payment_amount(partner_id: str) -> int:
    """파트너별 결제 금액 조회 (기본 7,900원)"""
    try:
        config = get_partner_config(partner_id)
        if config and "config" in config:
            return config["config"].get("payment", {}).get("amount", 7900)
    except:
        pass
    return 7900

@router.post("/disease-report/check-partner-status")
async def check_partner_status(
    api_key: Optional[str] = Body(None),
    partner_id: Optional[str] = Body(None),
    uuid: str = Body(...),
    encrypted_data: Optional[str] = Body(None, alias="data")
):
    """
    파트너사 유입 사용자의 상태를 체크하고 적절한 페이지로 리다이렉트 정보를 반환합니다.
    """
    logger.info(f"[상태체크] 시작: partner={partner_id}, key={bool(api_key)}, uuid={uuid}")
    
    try:
        # 1. 파트너 식별 (api_key 우선)
        partner_config = None
        if api_key:
            partner_config = get_partner_config_by_api_key(api_key)
            if partner_config:
                partner_id = partner_config["partner_id"]
        
        if not partner_config and partner_id:
            partner_config = get_partner_config(partner_id)
            
        if not partner_config:
            logger.warning(f"[상태체크] 파트너 식별 실패: partner={partner_id}, api_key={api_key}")
            raise HTTPException(status_code=404, detail="유효하지 않은 파트너 정보입니다.")

        # API Key 검증 (설정되어 있는 경우)
        registered_api_key = partner_config.get("api_key")
        if registered_api_key and registered_api_key != api_key:
            logger.warning(f"[상태체크] API Key 불일치: partner={partner_id}")
            raise HTTPException(status_code=403, detail="유효하지 않은 API Key입니다.")
        
        payment_required = partner_config["config"]["payment"]["required"]
        payment_amount = get_payment_amount(partner_id)
        
        # redirect_url에 api_key가 있으면 유지하도록 헬퍼 함수 정의
        def get_final_url(base_url):
            if api_key:
                connector = "&" if "?" in base_url else "?"
                return f"{base_url}{connector}api_key={api_key}"
            return base_url

        # 변수 초기화
        has_checkup_data = False
        is_recorded_user = False
        decrypted = None
        welno_patient = None
        payment_record = None
        patient_id = None
        has_mediarc_report = False

        # ===== 1. DB 조회 및 기본 기록 =====
        with db_manager.get_connection() as conn:
            with conn.cursor() as cur:
                # 1-1. 파트너 결제 테이블 확인 (리포트 유무 및 유입 기록)
                cur.execute("""
                    SELECT oid, status, report_url, user_data, user_name
                    FROM welno.tb_campaign_payments
                    WHERE partner_id = %s AND uuid = %s
                    ORDER BY created_at DESC
                    LIMIT 1
                """, (partner_id, uuid))
                payment_record = cur.fetchone()
                
                if payment_record:
                    is_recorded_user = True
                    saved_user_data = payment_record[3]
                    saved_user_name = payment_record[4]
                    # 리포트가 이미 있다면 즉시 반환
                    if payment_record[2]: # report_url
                        oid = payment_record[0]
                        logger.info(f"[상태체크] 케이스 A1: 파트너 리포트 있음 (oid={oid})")
                        return {
                            "case_id": "A1",
                            "action": "show_report",
                            "redirect_url": get_final_url(f"/disease-report?oid={oid}"),
                            "message": "이미 생성된 리포트가 있습니다",
                            "has_report": True,
                            "has_checkup_data": True,
                            "has_payment": True,
                            "requires_payment": payment_required,
                            "payment_amount": payment_amount,
                            "partner_id": partner_id,
                            "is_welno_user": False,
                            "is_recorded_user": True
                        }

                # 1-2. WELNO 가입자 체크 (약관동의 여부 포함)
                cur.execute("""
                    SELECT id, has_mediarc_report, name, phone_number, birth_date, gender,
                           terms_agreement, terms_agreed_at
                    FROM welno.welno_patients
                    WHERE uuid = %s
                    LIMIT 1
                """, (uuid,))
                welno_patient = cur.fetchone()
                
                if welno_patient:
                    patient_id = welno_patient[0]
                    has_mediarc_report = welno_patient[1]
                    if has_mediarc_report:
                        logger.info(f"[상태체크] 케이스 A2: WELNO 리포트 있음 (uuid={uuid})")
                        return {
                            "case_id": "A2",
                            "action": "show_report",
                            "redirect_url": get_final_url(f"/disease-report?uuid={uuid}&hospital_id=PEERNINE"),
                            "has_report": True,
                            "has_checkup_data": True,
                            "has_payment": True,
                            "requires_payment": False,
                            "payment_amount": payment_amount,
                            "partner_id": partner_id,
                            "is_welno_user": True,
                            "is_recorded_user": True
                        }

                # 1-3. 유입 기록이 없다면 생성 (404 방지용 임시 기록)
                if not is_recorded_user:
                    try:
                        oid = f"TEMP_{int(time.time() * 1000)}"
                        cur.execute("""
                            INSERT INTO welno.tb_campaign_payments (oid, uuid, partner_id, status, amount)
                            VALUES (%s, %s, %s, 'READY', %s)
                        """, (oid, uuid, partner_id, payment_amount))
                        conn.commit()
                        is_recorded_user = True
                        logger.info(f"[상태체크] ✅ 신규 유입 기록 생성: {oid}")
                    except Exception as e:
                        logger.error(f"[상태체크] 기록 생성 실패: {e}")

                # ===== 2. 데이터 복호화 및 분석 =====
                if encrypted_data:
                    encryption_keys = partner_config["config"].get("encryption", {})
                    aes_key = encryption_keys.get("aes_key")
                    aes_iv = encryption_keys.get("aes_iv")
                    
                    if aes_key:
                        try:
                            decrypted = decrypt_user_data(encrypted_data, aes_key, aes_iv)
                            if decrypted:
                                # ✅ [추가] 인적 정보 보호 로직: 기존 기록이 있다면 인적 정보는 덮어쓰지 않음
                                if is_recorded_user and saved_user_data:
                                    try:
                                        old_info = saved_user_data if isinstance(saved_user_data, dict) else json.loads(saved_user_data)
                                        # 보호할 인적 정보 필드 목록
                                        personal_fields = ['name', 'birth', 'phone', 'gender', 'email']
                                        for field in personal_fields:
                                            if old_info.get(field):
                                                decrypted[field] = old_info[field]
                                        logger.info(f"[상태체크] 🛡️ 기존 인적 정보 보존 완료 (UUID: {uuid})")
                                    except:
                                        pass

                                # 지표 분석 로직 (메디링스 별칭 포함)
                                health_metrics = [
                                    'height', 'weight', 'waist', 'waist_circumference', 'bmi',
                                    'sbp', 'bphigh', 'dbp', 'bplwst', 'fbs', 'blds', 
                                    'tc', 'totchole', 'hdl', 'hdlchole', 'ldl', 'ldlchole', 
                                    'tg', 'triglyceride', 'ast', 'sgotast', 'alt', 'sgptalt', 'scr', 'creatinine'
                                ]
                                metric_count = sum(1 for field in health_metrics if decrypted.get(field) not in [None, '', 0, 0.0])
                                has_checkup_data = metric_count >= 5 # 5개 이상이면 충분
                                
                                # 데이터 업데이트
                                user_name = decrypted.get('name', '고객')
                                email = decrypted.get('email', '')
                                cur.execute("""
                                    UPDATE welno.tb_campaign_payments
                                    SET user_data = %s, user_name = %s, email = %s, updated_at = NOW()
                                    WHERE partner_id = %s AND uuid = %s
                                """, (json.dumps(decrypted), user_name, email, partner_id, uuid))
                                conn.commit()
                                logger.info(f"[상태체크] ✅ 복호화 데이터 업데이트 완료: {uuid} (지표={metric_count})")
                            else:
                                # ❌ 복호화 실패 로그 강화
                                logger.error(f"[상태체크] ❌ 복호화 실패 (데이터 파싱 불가능)")
                                logger.error(f"   - UUID: {uuid}")
                                logger.error(f"   - Partner: {partner_id}")
                                logger.error(f"   - Key: {aes_key[:4]}...{aes_key[-4:]}")
                                logger.error(f"   - IV: {aes_iv}")
                                logger.error(f"   - Encrypted Data Length: {len(encrypted_data)}")
                        except Exception as e:
                            logger.error(f"[상태체크] ❌ 복호화 중 예외 발생: {str(e)}")
                            import traceback
                            logger.error(traceback.format_exc())

                # 2-2. WELNO 검진 데이터 확인 (복호화 데이터 없을 시)
                if welno_patient and not has_checkup_data:
                    cur.execute("SELECT COUNT(*) FROM welno.welno_checkup_data WHERE patient_uuid = %s", (uuid,))
                    if cur.fetchone()[0] > 0:
                        has_checkup_data = True

                # ===== 3. 약관동의 여부 확인 =====
                terms_agreed = False
                if welno_patient and len(welno_patient) > 6:
                    terms_agreement = welno_patient[6]  # terms_agreement 필드
                    if terms_agreement:
                        if isinstance(terms_agreement, dict):
                            # terms_service와 terms_privacy가 모두 True인지 확인
                            terms_agreed = bool(
                                terms_agreement.get('terms_service') and 
                                terms_agreement.get('terms_privacy')
                            )
                        elif isinstance(terms_agreement, bool):
                            terms_agreed = terms_agreement
                
                # ===== 4. 최종 응답 생성 =====
                has_payment = payment_record and payment_record[1] == 'COMPLETED'
                
                base_response = {
                    "has_report": False,
                    "has_checkup_data": has_checkup_data,
                    "has_payment": has_payment,
                    "requires_payment": payment_required,
                    "payment_amount": payment_amount,
                    "partner_id": partner_id,
                    "is_welno_user": bool(welno_patient),
                    "is_recorded_user": is_recorded_user,
                    "terms_agreed": terms_agreed
                }

                # 리다이렉트 URL 결정
                if has_checkup_data:
                    case_id = "B1" if has_payment else ("B2" if payment_required else "B3")
                else:
                    case_id = "C1" if has_payment else ("C2" if payment_required else "C3")
                
                # 케이스별 액션 결정
                # B1, B2, B3 케이스에서 약관동의 여부 확인
                if has_checkup_data:
                    if not terms_agreed:
                        action = "redirect_to_auth"  # 약관동의 받기
                    else:
                        action = "show_intro"  # 약관동의 완료 → 바로 intro
                else:
                    action = "show_intro"  # 데이터 부족 케이스는 기존 로직 유지
                # C1: 결제는 완료했으나 데이터가 부족한 경우 -> 즉시 본인인증으로 유도
                if case_id == "C1":
                    if not terms_agreed:
                        action = "redirect_to_auth"
                    else:
                        action = "redirect_to_auth"  # 데이터 부족이므로 인증 필요
                    
                    # 1순위: 방금 복호화된 데이터, 2순위: DB에 저장된 데이터, 3순위: WELNO 가입 정보, 4순위: 고객
                    if decrypted:
                        u_info = decrypted
                    elif is_recorded_user and saved_user_data:
                        u_info = saved_user_data if isinstance(saved_user_data, dict) else json.loads(saved_user_data)
                    else:
                        u_info = {}
                        
                    user_name = u_info.get('name') or saved_user_name or (welno_patient[2] if welno_patient else '고객')
                    user_phone = u_info.get('phone') or (welno_patient[3] if welno_patient else '')
                    user_birth = u_info.get('birth') or (welno_patient[4] if welno_patient else '')
                    
                    user_name_encoded = user_name.replace(' ', '+')
                    
                    import urllib.parse
                    inner_return_path = f"/campaigns/disease-prediction?page=result&status=success&oid={payment_record[0]}"
                    encoded_return_path = urllib.parse.quote(inner_return_path)
                    
                    # URL에 이름, 전화번호, 생년월일 파라미터 추가
                    redirect_url = f"/login?return_to={encoded_return_path}&name={user_name_encoded}&mode=campaign&oid={payment_record[0]}"
                    if user_phone:
                        redirect_url += f"&phone={user_phone}"
                    if user_birth:
                        redirect_url += f"&birthdate={user_birth}"
                else:
                    redirect_url = f"/campaigns/disease-prediction?page=intro&partner={partner_id}&uuid={uuid}"
                    if encrypted_data:
                        redirect_url += f"&data={encrypted_data}"
                
                logger.info(f"[상태체크] 결과: case={case_id}, action={action}")
                return {**base_response, "case_id": case_id, "action": action, "redirect_url": get_final_url(redirect_url)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[상태체크] 서버 오류: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="서버 내부 오류가 발생했습니다.")
