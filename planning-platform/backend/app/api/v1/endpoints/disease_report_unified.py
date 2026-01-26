import logging
import json
import time
import asyncpg
from typing import Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from pydantic import BaseModel

from ....core.database import db_manager
from ....core.config import settings
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
        saved_user_data = None
        saved_user_name = None

        # ===== 1. DB 조회 및 기본 기록 =====
        # asyncpg를 사용한 비동기 DB 연결
        db_config = {
            "host": settings.DB_HOST,
            "port": settings.DB_PORT,
            "database": settings.DB_NAME,
            "user": settings.DB_USER,
            "password": settings.DB_PASSWORD
        }
        
        conn = None
        try:
            conn = await asyncpg.connect(**db_config)
            
            # 1-0. 파트너 설정 조회 (asyncpg 사용)
            partner_config = None
            if api_key:
                partner_row = await conn.fetchrow("""
                    SELECT partner_id, partner_name, config, is_active
                    FROM welno.tb_partner_config
                    WHERE config->>'api_key' = $1 AND is_active = true
                    LIMIT 1
                """, api_key)
                if partner_row:
                    # JSONB 필드는 자동으로 dict로 변환되지만, 문자열일 수도 있으므로 확인
                    config_data = partner_row['config']
                    if isinstance(config_data, str):
                        import json
                        config_data = json.loads(config_data)
                    
                    partner_config = {
                        "partner_id": partner_row['partner_id'],
                        "partner_name": partner_row['partner_name'],
                        "config": config_data,
                        "is_active": partner_row['is_active']
                    }
                    partner_id = partner_config['partner_id']
            
            if not partner_config and partner_id:
                partner_row = await conn.fetchrow("""
                    SELECT partner_id, partner_name, config, is_active
                    FROM welno.tb_partner_config
                    WHERE partner_id = $1 AND is_active = true
                    LIMIT 1
                """, partner_id)
                if partner_row:
                    # JSONB 필드는 자동으로 dict로 변환되지만, 문자열일 수도 있으므로 확인
                    config_data = partner_row['config']
                    if isinstance(config_data, str):
                        import json
                        config_data = json.loads(config_data)
                    
                    partner_config = {
                        "partner_id": partner_row['partner_id'],
                        "partner_name": partner_row['partner_name'],
                        "config": config_data,
                        "is_active": partner_row['is_active']
                    }
            
            # 파트너 설정이 없으면 에러 처리
            if not partner_config:
                await conn.close()
                logger.warning(f"[상태체크] 파트너 식별 실패: partner={partner_id}, api_key={api_key}")
                raise HTTPException(status_code=404, detail="유효하지 않은 파트너 정보입니다.")
            
            # API Key 검증 (설정되어 있는 경우)
            registered_api_key = partner_config.get("config", {}).get("api_key")
            if registered_api_key and registered_api_key != api_key:
                await conn.close()
                logger.warning(f"[상태체크] API Key 불일치: partner={partner_id}")
                raise HTTPException(status_code=403, detail="유효하지 않은 API Key입니다.")
            
            payment_required = partner_config.get("config", {}).get("payment", {}).get("required", True)
            payment_amount = partner_config.get("config", {}).get("payment", {}).get("amount", 7900)
            # 1-1. 파트너 결제 테이블 확인 (리포트 유무 및 유입 기록)
            payment_row = await conn.fetchrow("""
                SELECT oid, status, report_url, user_data, user_name
                FROM welno.tb_campaign_payments
                WHERE partner_id = $1 AND uuid = $2
                ORDER BY created_at DESC
                LIMIT 1
            """, partner_id, uuid)
            
            if payment_row:
                is_recorded_user = True
                payment_record = dict(payment_row)
                saved_user_data = payment_record.get('user_data')
                saved_user_name = payment_record.get('user_name')
                # 리포트가 이미 있다면 즉시 반환
                if payment_record.get('report_url'):
                    oid = payment_record['oid']
                    await conn.close()
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
            welno_row = await conn.fetchrow("""
                SELECT id, has_mediarc_report, name, phone_number, birth_date, gender,
                       terms_agreement, terms_agreed_at
                FROM welno.welno_patients
                WHERE uuid = $1
                LIMIT 1
            """, uuid)
            
            if welno_row:
                welno_patient = dict(welno_row)
                patient_id = welno_patient['id']
                has_mediarc_report = welno_patient['has_mediarc_report']
                if has_mediarc_report:
                    await conn.close()
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
                    await conn.execute("""
                        INSERT INTO welno.tb_campaign_payments (oid, uuid, partner_id, status, amount)
                        VALUES ($1, $2, $3, 'READY', $4)
                    """, oid, uuid, partner_id, payment_amount)
                    is_recorded_user = True
                    logger.info(f"[상태체크] ✅ 신규 유입 기록 생성: {oid}")
                except Exception as e:
                    logger.error(f"[상태체크] 기록 생성 실패: {e}")

            # ===== 2. 데이터 복호화 및 분석 =====
            if encrypted_data:
                encryption_keys = partner_config.get("config", {}).get("encryption", {})
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

                            # 지표 분석 로직 (공통 유틸 사용)
                            from app.utils.health_metrics import get_metric_count, is_data_sufficient
                            
                            metric_count = get_metric_count(decrypted)
                            has_checkup_data = is_data_sufficient(decrypted, threshold=5)
                            
                            # 데이터 업데이트
                            user_name = decrypted.get('name', '고객')
                            email = decrypted.get('email', '')
                            
                            # 1. tb_campaign_payments 업데이트
                            await conn.execute("""
                                UPDATE welno.tb_campaign_payments
                                SET user_data = $1, user_name = $2, email = $3, updated_at = NOW()
                                WHERE partner_id = $4 AND uuid = $5
                            """, json.dumps(decrypted), user_name, email, partner_id, uuid)
                            
                            logger.info(f"[상태체크] ✅ 파트너 데이터 업데이트 완료: {uuid} (지표={metric_count})")
                        else:
                            # ❌ 복호화 실패 로그 강화
                            logger.error(f"[상태체크] ❌ 복호화 실패 (데이터 파싱 불가능)")
                            logger.error(f"   - UUID: {uuid}")
                            logger.error(f"   - Partner: {partner_id}")
                            if aes_key:
                                logger.error(f"   - Key: {aes_key[:4]}...{aes_key[-4:]}")
                            else:
                                logger.error(f"   - Key: None")
                            logger.error(f"   - IV: {aes_iv if aes_iv else 'None'}")
                            logger.error(f"   - Encrypted Data Length: {len(encrypted_data)}")
                    except Exception as e:
                        logger.error(f"[상태체크] ❌ 복호화 중 예외 발생: {str(e)}")
                        import traceback
                        logger.error(traceback.format_exc())
                else:
                    logger.warning(f"[상태체크] ⚠️ 암호화 키 없음: partner={partner_id}, encrypted_data={bool(encrypted_data)}")

            # 2-2. WELNO 검진 데이터 확인 (복호화 데이터 없을 시)
            if welno_patient and not has_checkup_data:
                count = await conn.fetchval("SELECT COUNT(*) FROM welno.welno_checkup_data WHERE patient_uuid = $1", uuid)
                if count and count > 0:
                    has_checkup_data = True

            # ===== 3. 기본 응답 정보 수집 (통합 상태 조회 전) =====

            # ===== 4. 통합 상태 조회 (get_unified_status 사용) =====
            from app.services.welno_data_service import welno_data_service
            
            unified_status = await welno_data_service.get_unified_status(
                uuid=uuid,
                hospital_id=partner_config.get('default_hospital_id', 'PEERNINE'),
                partner_id=partner_id
            )
            
            status = unified_status['status']
            terms_agreed = unified_status['terms_agreed']
            has_checkup_data = unified_status['has_checkup_data']
            has_report = unified_status['has_report']
            has_payment = unified_status['has_payment']
            requires_payment = unified_status['requires_payment']
            metric_count = unified_status['metric_count']
            is_sufficient = unified_status['is_sufficient']
            
            logger.info(
                f"[상태체크] 통합상태: status={status}, terms={terms_agreed}, data={has_checkup_data}({metric_count}), "
                f"report={has_report}, payment={has_payment}/{requires_payment}"
            )
            
            # ===== 5. 상태별 액션 및 리다이렉트 결정 =====
            # 상태 → 액션 매핑
            action_mapping = {
                "TERMS_REQUIRED": "show_terms_modal",
                "TERMS_REQUIRED_WITH_DATA": "show_terms_modal",
                "TERMS_REQUIRED_WITH_REPORT": "show_terms_modal",
                "REPORT_READY": "show_report",
                "REPORT_EXPIRED": "show_expired_message",
                "REPORT_PENDING": "show_loading",
                "PAYMENT_REQUIRED": "show_payment",
                "ACTION_REQUIRED": "redirect_to_auth",
                "ACTION_REQUIRED_PAID": "redirect_to_auth_auto",
            }
            
            action = action_mapping.get(status, "show_intro")
            
            # 케이스 ID 생성 (하위 호환성)
            if status.startswith("TERMS_REQUIRED"):
                case_id = "TERMS"
            elif status == "REPORT_READY":
                case_id = "A1" if has_payment else "A2"
            elif status == "REPORT_EXPIRED":
                case_id = "A_EXPIRED"
            elif status == "REPORT_PENDING":
                case_id = "B1"
            elif status == "PAYMENT_REQUIRED":
                case_id = "B2"
            elif status == "ACTION_REQUIRED":
                case_id = "C2" if requires_payment else "C3"
            elif status == "ACTION_REQUIRED_PAID":
                case_id = "C1"
            else:
                case_id = "UNKNOWN"
            
            # redirect_url 생성
            if status.startswith("TERMS_REQUIRED"):
                # 약관 모달로 리다이렉트
                redirect_url = f"/campaigns/disease-prediction?page=terms&uuid={uuid}&partner={partner_id}"
                if encrypted_data:
                    redirect_url += f"&data={encrypted_data}"
                    
            elif status == "REPORT_READY":
                # 리포트 표시
                redirect_url = f"/disease-report?oid={payment_record['oid']}" if payment_record else f"/disease-report?uuid={uuid}&hospital=PEERNINE"
                
            elif status == "REPORT_EXPIRED":
                # 만료 메시지 + 새로고침 옵션
                redirect_url = f"/disease-report?uuid={uuid}&hospital=PEERNINE&expired=true"
                
            elif status == "REPORT_PENDING":
                # 로딩 페이지
                redirect_url = f"/campaigns/disease-prediction?page=loading&oid={payment_record['oid']}" if payment_record else f"/disease-report?uuid={uuid}"
                
            elif status == "PAYMENT_REQUIRED":
                # 결제 페이지
                redirect_url = f"/campaigns/disease-prediction?page=payment&partner={partner_id}&uuid={uuid}"
                if encrypted_data:
                    redirect_url += f"&data={encrypted_data}"
                    
            elif status in ["ACTION_REQUIRED", "ACTION_REQUIRED_PAID"]:
                # Tilko 인증 페이지
                # 사용자 정보 우선순위: 복호화 > DB저장 > WELNO가입 > 기본값
                if decrypted:
                    u_info = decrypted
                elif is_recorded_user and saved_user_data:
                    u_info = saved_user_data if isinstance(saved_user_data, dict) else json.loads(saved_user_data)
                else:
                    u_info = {}
                
                user_name = u_info.get('name') or saved_user_name or (welno_patient.get('name') if welno_patient else '고객')
                user_phone = u_info.get('phone') or (welno_patient.get('phone_number') if welno_patient else '')
                user_birth = u_info.get('birth') or (str(welno_patient.get('birth_date')) if welno_patient and welno_patient.get('birth_date') else '')
                user_name_encoded = user_name.replace(' ', '+')
                
                import urllib.parse
                inner_return_path = f"/campaigns/disease-prediction?page=result&status=success&oid={payment_record['oid']}" if payment_record else "/disease-report"
                encoded_return_path = urllib.parse.quote(inner_return_path)
                
                redirect_url = f"/login?return_to={encoded_return_path}&name={user_name_encoded}&mode=campaign"
                if payment_record:
                    redirect_url += f"&oid={payment_record['oid']}"
                if user_phone:
                    redirect_url += f"&phone={user_phone}"
                if user_birth:
                    redirect_url += f"&birthdate={user_birth}"
            else:
                # 기본: 소개 페이지
                redirect_url = f"/campaigns/disease-prediction?page=intro&partner={partner_id}&uuid={uuid}"
                if encrypted_data:
                    redirect_url += f"&data={encrypted_data}"
            
            # ===== 6. 최종 응답 생성 =====
            logger.info(f"[상태체크] 최종: case={case_id}, action={action}, redirect={redirect_url[:50]}...")
            
            base_response = {
                "has_report": has_report,
                "has_checkup_data": has_checkup_data,
                "has_payment": has_payment,
                "requires_payment": requires_payment,
                "payment_amount": payment_amount,
                "partner_id": partner_id,
                "is_welno_user": bool(welno_patient),
                "is_recorded_user": is_recorded_user,
                "terms_agreed": terms_agreed
            }
            
            await conn.close()
            
            return {
                **base_response,
                "case_id": case_id,
                "action": action,
                "redirect_url": get_final_url(redirect_url),
                **unified_status  # 전체 통합 상태 포함
            }
        finally:
            if conn and not conn.is_closed():
                await conn.close()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[상태체크] 서버 오류: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"서버 내부 오류가 발생했습니다: {str(e)}")
