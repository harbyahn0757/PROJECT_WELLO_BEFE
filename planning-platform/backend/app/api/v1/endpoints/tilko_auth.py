"""
틸코 인증 관련 API 엔드포인트
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any, Optional
import os
from datetime import datetime
from app.utils.tilko_utils import (
    get_public_key,
    simple_auth,
    get_health_screening_data,
    get_prescription_data,
    check_auth_status
)
from app.data.redis_session_manager import redis_session_manager as session_manager
from pydantic import BaseModel
import asyncio
from datetime import datetime

router = APIRouter()

# WebSocket 라우터는 별도로 등록됨

class SimpleAuthRequest(BaseModel):
    private_auth_type: str
    user_name: str
    birthdate: str
    phone_no: str

class SimpleAuthWithSessionRequest(BaseModel):
    private_auth_type: str
    user_name: str
    birthdate: str
    phone_no: str
    gender: str = "M"
    patient_uuid: Optional[str] = None  # 환자 UUID
    hospital_id: Optional[str] = None   # 병원 ID

class HealthDataRequest(BaseModel):
    cx_id: str
    private_auth_type: str
    req_tx_id: str
    token: str
    tx_id: str
    user_name: str
    birthday: str
    phone_no: str

class SessionStatusRequest(BaseModel):
    session_id: str

@router.get("/public-key")
async def get_tilko_public_key() -> Dict[str, Any]:
    """
    틸코 공개키 조회
    """
    try:
        public_key = await get_public_key()
        return {
            "success": True,
            "data": {
                "publicKey": public_key
            },
            "message": "틸코 공개키를 조회했습니다."
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"틸코 공개키 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/simple-auth")
async def request_simple_auth(request: SimpleAuthRequest) -> Dict[str, Any]:
    """
    카카오 간편인증 요청
    """
    try:
        result = await simple_auth(
            request.private_auth_type,
            request.user_name,
            request.birthdate,
            request.phone_no
        )
        return {
            "success": True,
            "data": result,
            "message": "카카오 간편인증을 요청했습니다."
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"카카오 간편인증 요청 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/health-screening")
async def get_health_screening(request: HealthDataRequest) -> Dict[str, Any]:
    """
    건강검진 데이터 조회
    """
    try:
        result = await get_health_screening_data({
            "CxId": request.cx_id,
            "PrivateAuthType": request.private_auth_type,
            "ReqTxId": request.req_tx_id,
            "Token": request.token,
            "TxId": request.tx_id,
            "UserName": request.user_name,
            "BirthDate": request.birthday,
            "UserCellphoneNumber": request.phone_no
        })
        return {
            "success": True,
            "data": result,
            "message": "건강검진 데이터를 조회했습니다."
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"건강검진 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/prescription")
async def get_prescription(request: HealthDataRequest) -> Dict[str, Any]:
    """
    처방전 데이터 조회
    """
    try:
        result = await get_prescription_data({
            "CxId": request.cx_id,
            "PrivateAuthType": request.private_auth_type,
            "ReqTxId": request.req_tx_id,
            "Token": request.token,
            "TxId": request.tx_id,
            "UserName": request.user_name,
            "BirthDate": request.birthday,
            "UserCellphoneNumber": request.phone_no
        })
        return {
            "success": True,
            "data": result,
            "message": "처방전 데이터를 조회했습니다."
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"처방전 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )

# 새로운 세션 기반 엔드포인트들

@router.post("/session/start")
async def start_auth_session(request: SimpleAuthWithSessionRequest) -> Dict[str, Any]:
    """
    새로운 인증 세션 시작
    """
    try:
        # 받은 데이터 로그 출력 (디버깅)
        print(f"📥 [세션시작] 받은 요청 데이터:")
        print(f"   - user_name: {request.user_name}")
        print(f"   - birthdate: {request.birthdate} (타입: {type(request.birthdate)}, 길이: {len(request.birthdate) if request.birthdate else 0})")
        print(f"   - phone_no: {request.phone_no[:3]}*** (마스킹)")
        print(f"   - gender: {request.gender}")
        print(f"   - private_auth_type: {request.private_auth_type} (타입: {type(request.private_auth_type)})")
        
        # 생년월일 검증
        if not request.birthdate or len(request.birthdate.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="생년월일이 전달되지 않았습니다. 생년월일을 입력해주세요."
            )
        
        # 인증 방식 검증
        VALID_AUTH_TYPES = ["0", "4", "6"]
        private_auth_type = str(request.private_auth_type).strip() if request.private_auth_type else ""
        
        if not private_auth_type:
            raise HTTPException(
                status_code=400,
                detail="인증 방식을 선택해주세요."
            )
        
        if private_auth_type not in VALID_AUTH_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"유효하지 않은 인증 방식입니다: {private_auth_type}. 지원되는 방식: {VALID_AUTH_TYPES}"
            )
        
        # 이름 정규화 (suffix 제거: "-웰로", "-님" 등)
        clean_name = request.user_name
        for suffix in ["-웰로", "-님", " 님"]:
            if clean_name.endswith(suffix):
                clean_name = clean_name[:-len(suffix)]
                print(f"🔧 [이름정규화] '{request.user_name}' → '{clean_name}'")
                break
        
        # 세션 생성 (환자 정보 포함)
        user_info = {
            "name": clean_name,
            "birthdate": request.birthdate.strip(),  # 공백 제거
            "phone_no": request.phone_no,
            "gender": request.gender,
            "private_auth_type": private_auth_type  # 검증된 인증 방식 저장
        }
        
        print(f"💾 [세션생성] 저장할 user_info:")
        print(f"   - name: {user_info['name']}")
        print(f"   - birthdate: {user_info['birthdate']} (길이: {len(user_info['birthdate'])})")
        print(f"   - phone_no: {user_info['phone_no'][:3]}*** (마스킹)")
        print(f"   - gender: {user_info['gender']}")
        print(f"   - private_auth_type: '{user_info['private_auth_type']}' (타입: {type(user_info['private_auth_type'])})")
        
        session_id = session_manager.create_session(user_info)
        
        # 환자 UUID와 병원 ID를 세션에 추가로 저장
        if request.patient_uuid and request.hospital_id:
            session_data = session_manager.get_session(session_id)
            session_data["patient_uuid"] = request.patient_uuid
            session_data["hospital_id"] = request.hospital_id
            session_manager._save_session(session_id, session_data)
            print(f"✅ [세션생성] 환자 정보 저장: {request.patient_uuid} @ {request.hospital_id}")
        else:
            print(f"⚠️ [세션생성] 환자 정보 누락 - patient_uuid: {request.patient_uuid}, hospital_id: {request.hospital_id}")
        
        return {
            "success": True,
            "session_id": session_id,
            "message": f"{request.user_name}님의 인증 세션이 시작되었습니다.",
            "next_step": "simple_auth"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"세션 시작 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/session/simple-auth")
async def session_simple_auth(
    background_tasks: BackgroundTasks,
    session_id: str
) -> Dict[str, Any]:
    """
    세션 기반 카카오 간편인증 요청 (중복 요청 방지)
    """
    try:
        session_data = session_manager.get_session(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
        
        # 🚨 중복 요청 방지: 이미 인증 요청이 진행 중인지 확인
        current_status = session_data.get("status", "")
        temp_auth_data = session_data.get("temp_auth_data")
        
        if current_status in ["auth_pending", "auth_completed", "authenticated"] or temp_auth_data:
            print(f"⚠️ [중복방지] 세션 {session_id}는 이미 인증 진행 중 (상태: {current_status})")
            return {
                "success": True,
                "session_id": session_id,
                "message": "이미 인증이 진행 중입니다. 카카오톡에서 인증을 완료해주세요.",
                "next_step": "wait_for_auth",
                "status": current_status,
                "duplicate_request_prevented": True
            }
        
        user_info = session_data["user_info"]
        
        # 세션에 저장된 데이터 확인 (디버깅)
        print(f"📋 [simple-auth] 세션에서 가져온 user_info:")
        print(f"   - name: {user_info.get('name', 'N/A')}")
        print(f"   - birthdate: {user_info.get('birthdate', 'N/A')} (타입: {type(user_info.get('birthdate'))}, 길이: {len(user_info.get('birthdate', '')) if user_info.get('birthdate') else 0})")
        print(f"   - phone_no: {user_info.get('phone_no', 'N/A')[:3]}*** (마스킹)")
        print(f"   - private_auth_type: {user_info.get('private_auth_type', 'N/A')} (타입: {type(user_info.get('private_auth_type'))})")
        
        # 생년월일 검증
        birthdate = user_info.get("birthdate", "").strip() if user_info.get("birthdate") else ""
        if not birthdate or len(birthdate) == 0:
            error_msg = "세션에 저장된 생년월일이 없습니다. 다시 입력해주세요."
            print(f"❌ [simple-auth] {error_msg}")
            session_manager.add_error_message(session_id, error_msg)
            session_manager.update_session_status(session_id, "error", error_msg)
            raise HTTPException(status_code=400, detail=error_msg)
        
        # 선택된 인증 방법 확인 (기본값 없이 필수 필드로 처리)
        private_auth_type_raw = user_info.get("private_auth_type")
        if not private_auth_type_raw:
            error_msg = "세션에 저장된 인증 방식이 없습니다. 다시 시작해주세요."
            print(f"❌ [simple-auth] {error_msg}")
            session_manager.add_error_message(session_id, error_msg)
            session_manager.update_session_status(session_id, "error", error_msg)
            raise HTTPException(status_code=400, detail=error_msg)
        
        private_auth_type = str(private_auth_type_raw).strip()
        
        # 유효한 인증 방식인지 검증
        VALID_AUTH_TYPES = ["0", "4", "6"]
        if private_auth_type not in VALID_AUTH_TYPES:
            error_msg = f"유효하지 않은 인증 방식입니다: {private_auth_type}. 지원되는 방식: {VALID_AUTH_TYPES}"
            print(f"❌ [simple-auth] {error_msg}")
            session_manager.add_error_message(session_id, error_msg)
            session_manager.update_session_status(session_id, "error", error_msg)
            raise HTTPException(status_code=400, detail=error_msg)
        
        auth_type_names = {
            "0": "카카오톡",
            "4": "통신사Pass",
            "6": "네이버"
        }
        auth_type_name = auth_type_names.get(private_auth_type, f"알 수 없음({private_auth_type})")
        
        print(f"🚨 [틸코API최종검증] simple_auth 호출 전 최종 확인:")
        print(f"   - 세션 ID: {session_id}")
        print(f"   - 사용자: {user_info['name']}")
        print(f"   - 인증방법: {auth_type_name} (코드: {private_auth_type})")
        print(f"   - 세션에 저장된 값: {user_info.get('private_auth_type')}")
        print(f"   - 최종 전달값: {private_auth_type}")
        print(f"   - 유효성 검증: ✅ 통과")
        print(f"🔍 [틸코API] simple_auth 파라미터:")
        print(f"   - private_auth_type: '{private_auth_type}'")
        print(f"   - user_name: '{user_info['name']}'")
        print(f"   - birthdate: '{birthdate}' (길이: {len(birthdate)})")
        print(f"   - phone_no: '{user_info['phone_no'][:3]}***' (마스킹)")
        
        # 간편인증 요청
        auth_messages = {
            "0": "카카오 간편인증을 요청하고 있습니다...",
            "4": "통신사Pass 인증을 요청하고 있습니다...",
            "6": "네이버 인증을 요청하고 있습니다..."
        }
        auth_message = auth_messages.get(private_auth_type, "간편인증을 요청하고 있습니다...")
        
        session_manager.update_session_status(
            session_id, 
            "auth_requesting", 
            auth_message
        )
        
        result = await simple_auth(
            private_auth_type,
            user_info["name"],
            birthdate,  # 검증된 birthdate 사용
            user_info["phone_no"]
        )
        print(f"🔍 [틸코API] simple_auth 응답: {result}")
        print(f"🔍 [틸코API] Status 값: '{result.get('Status')}'")
        print(f"🔍 [틸코API] 전체 키들: {list(result.keys()) if isinstance(result, dict) else 'dict가 아님'}")

        # 틸코 API 응답 상세 분석 - 강제 출력
        import sys
        print(f"🚨🚨🚨 [틸코검증] 틸코 API 전체 응답 분석:", flush=True)
        print(f"   - 응답 타입: {type(result)}", flush=True)
        print(f"   - 응답 내용: {result}", flush=True)
        sys.stdout.flush()
        sys.stderr.flush()
        if isinstance(result, dict):
            for key, value in result.items():
                print(f"   - {key}: {value} (타입: {type(value)})", flush=True)
        
        # 틸코 API 응답에 따른 분기 처리
        tilko_status = result.get("Status")
        cx_id = result.get("ResultData", {}).get("CxId") if result.get("ResultData") else None
        print(f"🚨 [틸코검증] 틸코 Status 확인: '{tilko_status}'")
        print(f"🚨 [틸코검증] CxId 확인: '{cx_id}'")
        
        if tilko_status == "OK" and cx_id is not None:
            # 인증 요청 성공 - CxId가 존재하므로 카카오톡 메시지 발송됨
            print(f"✅ [틸코성공] 카카오톡 인증 메시지 발송 성공 - CxId: {cx_id}")
            
            # 인증 데이터를 임시 저장 (사용자가 실제 인증 완료 시까지)
            session_data = session_manager.get_session(session_id)
            user_info = session_data.get("user_info", {})
            
            # private_auth_type 필수 확인
            private_auth_type_for_temp = user_info.get("private_auth_type")
            if not private_auth_type_for_temp:
                error_msg = "세션에 저장된 인증 방식이 없습니다. 다시 시작해주세요."
                print(f"❌ [simple-auth] {error_msg}")
                session_manager.add_error_message(session_id, error_msg)
                session_manager.update_session_status(session_id, "error", error_msg)
                raise HTTPException(status_code=400, detail=error_msg)
            
            temp_auth_data = {
                "cxId": cx_id,
                "privateAuthType": str(private_auth_type_for_temp).strip(),
                "reqTxId": result.get("ResultData", {}).get("ReqTxId", ""),
                "token": result.get("ResultData", {}).get("Token", ""),
                "txId": result.get("ResultData", {}).get("TxId", ""),
                "userName": result.get("ResultData", {}).get("UserName", user_info.get("name", "")),
                "birthDate": result.get("ResultData", {}).get("BirthDate", user_info.get("birthdate", "")),
                "userCellphoneNumber": result.get("ResultData", {}).get("UserCellphoneNumber", user_info.get("phone_no", ""))
            }
            
            # 임시 인증 데이터 저장 (완료되지 않은 상태)
            session_data["temp_auth_data"] = temp_auth_data
            session_manager._save_session(session_id, session_data)
            
            # 인증 방법에 따른 메시지 설정
            auth_type = str(private_auth_type_for_temp).strip()
            auth_messages = {
                "0": "카카오톡에서 인증을 진행해주세요. 인증 완료를 기다리고 있습니다...",
                "4": "통신사Pass에서 인증을 진행해주세요. 인증 완료를 기다리고 있습니다...", 
                "6": "네이버에서 인증을 진행해주세요. 인증 완료를 기다리고 있습니다..."
            }
            auth_message = auth_messages.get(auth_type, "선택한 방법으로 인증을 진행해주세요.")
            
            session_manager.update_session_status(
                session_id,
                "auth_completed",  # CX, TX 받으면 즉시 완료 처리
                f"인증이 완료되었습니다!\n아래 버튼을 눌러 데이터를 수집해주세요."
            )
            
            # 세션 연장 (활동 감지) - 5분 연장
            session_manager.extend_session(session_id, 300)
            
            # 실시간 스트리밍 알림 - 틸코 키값 수신
            try:
                from .websocket_auth import notify_tilko_key_received, notify_auth_waiting, notify_session_extended
                print(f"🔔 [스트리밍] WebSocket 알림 시작 - 세션: {session_id}, CxId: {cx_id}")
                
                await notify_tilko_key_received(session_id, cx_id)
                print(f"✅ [스트리밍] 틸코 키 수신 알림 완료")
                
                await notify_auth_waiting(session_id)
                print(f"✅ [스트리밍] 인증 대기 알림 완료")
                
                await notify_session_extended(session_id, 30)
                print(f"✅ [스트리밍] 세션 연장 알림 완료")
                
            except Exception as e:
                import traceback
                print(f"⚠️ [스트리밍] WebSocket 알림 실패: {e}")
                print(f"⚠️ [스트리밍] 상세 에러: {traceback.format_exc()}")
                print(f"⚠️ [스트리밍] 실패 위치 - 세션: {session_id}, CxId: {cx_id}")
            
            # 백엔드 자동 폴링 비활성화 - 사용자 수동 트리거 방식 사용
            # background_tasks.add_task(streaming_auth_monitor, session_id)  # 비활성화
            
            return {
                "success": True,
                "session_id": session_id,
                "message": "카카오 간편인증이 요청되었습니다. 카카오톡에서 인증을 진행해주세요.",
                "next_step": "wait_for_auth"
            }
        elif tilko_status == "OK" and cx_id is None:
            # 틸코 API는 성공했지만 CxId가 없음 - 카카오톡 미연동 사용자
            error_msg = "카카오톡이 연동되지 않은 사용자입니다. 카카오톡 설치 및 본인인증을 확인해주세요."
            print(f"⚠️ [틸코경고] CxId가 null - 카카오톡 미연동: {user_info['name']}")
            
            session_manager.add_error_message(session_id, error_msg)
            session_manager.update_session_status(session_id, "error", error_msg)
            
            raise HTTPException(status_code=400, detail=error_msg)
        else:
            # 틸코 API 에러 처리
            error_code = result.get("ErrorCode", "알 수 없음")
            error_msg = result.get("Message", "인증 요청 실패")
            error_log = result.get("ErrorLog", "")
            
            print(f"❌ [틸코에러] ErrorCode: {error_code}, Message: {error_msg}")
            if error_log:
                print(f"❌ [틸코에러] ErrorLog: {error_log}")
            
            # ErrorLog가 있으면 더 상세한 메시지 생성
            if error_log:
                detailed_error_msg = f"틸코 API 에러 ({error_code}): {error_msg}\n\n상세 오류: {error_log}"
            else:
                detailed_error_msg = f"틸코 API 에러 ({error_code}): {error_msg}"
            
            session_manager.add_error_message(session_id, detailed_error_msg)
            session_manager.update_session_status(session_id, "error", detailed_error_msg)
            
            raise HTTPException(status_code=400, detail=detailed_error_msg)
            
    except HTTPException:
        raise
    except Exception as e:
        session_manager.add_error_message(session_id, str(e))
        raise HTTPException(
            status_code=500,
            detail=f"카카오 간편인증 요청 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/session/status/{session_id}")
async def get_session_status(session_id: str) -> Dict[str, Any]:
    """
    세션 상태 조회 - 인증 완료 여부 및 다음 단계 안내 포함
    """
    try:
        session_data = session_manager.get_session(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
        
        # 임시 인증 데이터가 있는 경우 실제 인증 완료 여부 확인
        temp_auth_data = session_data.get("temp_auth_data")
        auth_completed = False
        next_step = "unknown"
        
        if temp_auth_data and temp_auth_data.get("cxId"):
            print(f"🔍 [인증확인] 세션 {session_id}의 인증 완료 여부 확인 중...")
            
            # 틸코 API로 실제 인증 완료 여부 확인
            try:
                from ....utils.tilko_utils import check_auth_status
                auth_result = await check_auth_status(
                    temp_auth_data.get("cxId"),
                    temp_auth_data.get("txId")
                )
                
                print(f"🔍 [인증확인] 틸코 응답: {auth_result}")
                
                # 인증이 완료되었는지 확인 (틸코 응답에 따라 조건 조정 필요)
                if auth_result.get("Status") == "OK" and auth_result.get("ResultData"):
                    print(f"✅ [인증완료] 사용자 인증 완료 감지!")
                    session_manager.update_session_status(session_id, "auth_completed", "인증이 완료되었습니다.")
                    auth_completed = True
                    next_step = "collect_health_data"
                else:
                    next_step = "wait_for_auth"
            except Exception as e:
                print(f"⚠️ [인증확인] 틸코 API 호출 실패: {e}")
                # 에러 시 기존 로직 사용
                if session_data.get("status") == "auth_completed":
                    auth_completed = True
                    next_step = "collect_health_data"
                else:
                    next_step = "wait_for_auth"
        
        # 수집된 데이터 포함 (완료 상태일 때)
        response_data = {
            "success": True,
            "session_id": session_id,
            "status": session_data.get("status", "unknown"),
            "auth_completed": auth_completed,
            "next_step": next_step,
            "progress": session_data.get("progress", {}),
            "messages": session_data.get("messages", []),
            "user_info": session_data.get("user_info", {}),
            "temp_auth_data": {
                "has_cxid": bool(temp_auth_data and temp_auth_data.get("cxId")),
                "cxid": temp_auth_data.get("cxId") if temp_auth_data else None
            } if temp_auth_data else None,
            "created_at": session_data.get("created_at"),
            "updated_at": session_data.get("updated_at")
        }
        
        # 데이터 수집이 완료된 경우 실제 데이터 포함
        if session_data.get("status") == "completed":
            health_data = session_data.get("health_data")
            prescription_data = session_data.get("prescription_data")
            
            if health_data:
                response_data["health_data"] = health_data
            if prescription_data:
                response_data["prescription_data"] = prescription_data
        
        return response_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"세션 상태 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/session/messages/{session_id}")
async def get_session_messages(session_id: str) -> Dict[str, Any]:
    """
    세션 메시지 조회
    """
    try:
        session_data = session_manager.get_session(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
        
        return {
            "success": True,
            "messages": session_data.get("messages", []),
            "status": session_data.get("status"),
            "progress": session_data.get("progress")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"세션 메시지 조회 중 오류가 발생했습니다: {str(e)}"
        )

# 백그라운드 작업 함수 (사용 중지됨 - 사용자가 직접 인증 완료를 확인해야 함)
async def monitor_auth_and_fetch_data_DISABLED(session_id: str, auth_result: Dict[str, Any]):
    """
    인증 완료 모니터링 및 데이터 수집
    """
    try:
        # 인증 결과에서 필요한 정보 추출
        result_data = auth_result.get("ResultData", {})
        
        if not result_data:
            session_manager.add_error_message(session_id, "인증 응답 데이터가 올바르지 않습니다.")
            return
        
        # 인증 데이터 저장
        auth_data = {
            "cxId": result_data.get("CxId", ""),
            "privateAuthType": auth_result.get("PrivateAuthType", "0"),
            "reqTxId": result_data.get("ReqTxId", ""),
            "token": result_data.get("Token", ""),
            "txId": result_data.get("TxId", "")
        }
        
        session_manager.update_auth_data(session_id, auth_data)
        
        # 세션에서 사용자 정보 가져오기
        session_data = session_manager.get_session(session_id)
        user_info = session_data["user_info"]
        
        # 데이터 수집 요청 준비
        request_login = {
            "cxId": auth_data["cxId"],
            "privateAuthType": auth_data["privateAuthType"],
            "reqTxId": auth_data["reqTxId"],
            "token": auth_data["token"],
            "txId": auth_data["txId"],
            "userName": user_info["name"],
            "birthday": user_info["birthdate"],
            "phoneNo": user_info["phone_no"]
        }
        
        # 건강검진 데이터 수집
        session_manager.update_session_status(
            session_id,
            "fetching_health_data", 
            "건강검진 데이터를 가져오고 있습니다..."
        )
        
        try:
            health_data = await get_health_screening_data(request_login)
            # 틸코 API 응답에서 에러 확인
            if health_data.get("Status") == "Error":
                error_msg = health_data.get("Message", "건강검진 데이터 수집 실패")
                session_manager.add_error_message(session_id, f"건강검진 데이터 오류: {error_msg}")
            else:
                session_manager.update_health_data(session_id, health_data)
        except Exception as e:
            session_manager.add_error_message(session_id, f"건강검진 데이터 수집 실패: {str(e)}")
        
        # 처방전 데이터 수집
        session_manager.update_session_status(
            session_id,
            "fetching_prescription_data",
            "처방전 데이터를 가져오고 있습니다..."
        )
        
        try:
            prescription_data = await get_prescription_data(request_login)
            session_manager.update_prescription_data(session_id, prescription_data)
        except Exception as e:
            session_manager.add_error_message(session_id, f"처방전 데이터 수집 실패: {str(e)}")
        
        # 모든 데이터 수집 완료
        session_manager.complete_session(session_id)
        
    except Exception as e:
        session_manager.add_error_message(session_id, f"데이터 수집 중 오류 발생: {str(e)}")

@router.post("/session/confirm-auth/{session_id}")
async def confirm_auth_and_fetch_data(
    session_id: str,
    background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """
    사용자가 카카오톡에서 인증을 완료한 후 데이터 수집 시작
    """
    try:
        session_data = session_manager.get_session(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
        
        if session_data["status"] != "auth_pending":
            raise HTTPException(status_code=400, detail="인증 대기 상태가 아닙니다.")
        
        # 임시 인증 데이터가 있는지 확인
        temp_auth_data = session_data.get("temp_auth_data")
        if not temp_auth_data:
            raise HTTPException(status_code=400, detail="인증 요청이 되지 않았습니다.")
        
        # 임시 인증 데이터를 실제 인증 데이터로 변환
        session_manager.update_auth_data(session_id, temp_auth_data)
        
        # 백그라운드에서 데이터 수집 시작
        background_tasks.add_task(fetch_health_data_after_auth, session_id)
        
        return {
            "success": True,
            "message": "인증이 확인되었습니다. 건강정보를 수집하기 시작합니다."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        session_manager.add_error_message(session_id, str(e))
        raise HTTPException(
            status_code=500,
            detail=f"인증 확인 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/session/confirm-auth-sync/{session_id}")
async def confirm_auth_and_fetch_data_sync(session_id: str) -> Dict[str, Any]:
    """
    동기적 인증 확인 및 데이터 수집 (XOG 방식)
    """
    try:
        session_data = session_manager.get_session(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
        
        # 재시도 가능한 상태 확인 (auth_pending 또는 error 상태에서 재시도 허용)
        if session_data["status"] not in ["auth_pending", "error"]:
            raise HTTPException(status_code=400, detail=f"현재 상태({session_data['status']})에서는 인증 확인을 할 수 없습니다.")
        
        # 임시 인증 데이터가 있는지 확인
        temp_auth_data = session_data.get("temp_auth_data")
        if not temp_auth_data:
            raise HTTPException(status_code=400, detail="인증 요청이 되지 않았습니다.")
        
        # 에러 상태에서 재시도하는 경우 상태 초기화
        if session_data["status"] == "error":
            session_manager.update_session_status(
                session_id,
                "authenticated",
                "재시도를 시작합니다..."
            )
        
        # 임시 인증 데이터를 실제 인증 데이터로 변환
        session_manager.update_auth_data(session_id, temp_auth_data)
        
        # 동기적으로 데이터 수집 진행
        auth_data = temp_auth_data
        user_info = session_data.get("user_info")
        
        # 인증 성공 시 환자 정보 저장/업데이트 (전화번호, 생년월일 포함)
        patient_uuid = session_data.get("patient_uuid")
        hospital_id = session_data.get("hospital_id")
        
        if patient_uuid and hospital_id and user_info:
            try:
                from ....services.wello_data_service import WelloDataService
                wello_service = WelloDataService()
                
                # user_info 키 이름 변환 (phone_no → phone_number, birthdate → birth_date)
                user_info_for_save = {
                    "name": user_info.get("name"),
                    "phone_number": user_info.get("phone_no"),  # phone_no → phone_number
                    "birth_date": user_info.get("birthdate"),   # birthdate → birth_date
                    "gender": user_info.get("gender")
                }
                
                print(f"💾 [인증성공] 환자 정보 저장 시작 - UUID: {patient_uuid}, Hospital: {hospital_id}")
                print(f"   - 이름: {user_info_for_save['name']}")
                print(f"   - 전화번호: {user_info_for_save['phone_number'][:3]}*** (마스킹)")
                print(f"   - 생년월일: {user_info_for_save['birth_date']}")
                print(f"   - 성별: {user_info_for_save['gender']}")
                
                patient_id = await wello_service.save_patient_data(
                    uuid=patient_uuid,
                    hospital_id=hospital_id,
                    user_info=user_info_for_save,
                    session_id=session_id
                )
                
                if patient_id:
                    print(f"✅ [인증성공] 환자 정보 저장 완료 - Patient ID: {patient_id}")
                else:
                    print(f"⚠️ [인증성공] 환자 정보 저장 실패")
            except Exception as e:
                print(f"❌ [인증성공] 환자 정보 저장 중 오류: {e}")
                # 환자 정보 저장 실패해도 데이터 수집은 계속 진행
        
        # 데이터 수집 요청 준비
        request_login = {
            "cxId": auth_data["cxId"],
            "privateAuthType": auth_data["privateAuthType"],
            "reqTxId": auth_data["reqTxId"],
            "token": auth_data["token"],
            "txId": auth_data["txId"],
            "userName": user_info["name"],
            "birthday": user_info["birthdate"],
            "phoneNo": user_info["phone_no"]
        }
        
        # 건강검진 데이터 수집
        session_manager.update_session_status(
            session_id,
            "fetching_health_data", 
            "건강검진 데이터를 가져오고 있습니다..."
        )
        
        try:
            health_data = await get_health_screening_data(request_login)
            # 틸코 API 응답에서 에러 확인
            if health_data.get("Status") == "Error":
                error_msg = health_data.get("Message", "건강검진 데이터 수집 실패")
                session_manager.add_error_message(session_id, f"건강검진 데이터 오류: {error_msg}")
                raise HTTPException(status_code=400, detail=error_msg)
            
            session_manager.update_health_data(session_id, health_data)
            
        except HTTPException:
            raise
        except Exception as e:
            error_msg = f"건강검진 데이터 수집 실패: {str(e)}"
            session_manager.add_error_message(session_id, error_msg)
            raise HTTPException(status_code=500, detail=error_msg)
        
        # 처방전 데이터 수집
        session_manager.update_session_status(
            session_id,
            "fetching_prescription_data",
            "처방전 데이터를 가져오고 있습니다..."
        )
        
        try:
            prescription_data = await get_prescription_data(request_login)
            # 틸코 API 응답에서 에러 확인
            if prescription_data.get("Status") == "Error":
                error_msg = prescription_data.get("Message", "처방전 데이터 수집 실패")
                session_manager.add_error_message(session_id, f"처방전 데이터 오류: {error_msg}")
                raise HTTPException(status_code=400, detail=error_msg)
            
            session_manager.update_prescription_data(session_id, prescription_data)
            
        except HTTPException:
            raise
        except Exception as e:
            error_msg = f"처방전 데이터 수집 실패: {str(e)}"
            session_manager.add_error_message(session_id, error_msg)
            raise HTTPException(status_code=500, detail=error_msg)
        
        # 완료 처리
        session_manager.complete_session(session_id)
        
        return {
            "success": True,
            "message": "모든 건강정보 수집이 완료되었습니다!",
            "status": "completed"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        session_manager.add_error_message(session_id, str(e))
        raise HTTPException(
            status_code=500,
            detail=f"데이터 수집 중 오류가 발생했습니다: {str(e)}"
        )

async def fetch_health_data_after_auth(session_id: str):
    """
    실제 인증 완료 후 건강 데이터 수집
    """
    try:
        session_data = session_manager.get_session(session_id)
        if not session_data:
            return
        
        auth_data = session_data.get("auth_data")
        user_info = session_data.get("user_info")
        
        if not auth_data or not user_info:
            session_manager.add_error_message(session_id, "인증 데이터 또는 사용자 정보가 없습니다.")
            return
        
        # 인증 성공 시 환자 정보 저장/업데이트 (전화번호, 생년월일 포함)
        patient_uuid = session_data.get("patient_uuid")
        hospital_id = session_data.get("hospital_id")
        
        if patient_uuid and hospital_id and user_info:
            try:
                from ....services.wello_data_service import WelloDataService
                wello_service = WelloDataService()
                
                # user_info 키 이름 변환 (phone_no → phone_number, birthdate → birth_date)
                user_info_for_save = {
                    "name": user_info.get("name"),
                    "phone_number": user_info.get("phone_no"),  # phone_no → phone_number
                    "birth_date": user_info.get("birthdate"),   # birthdate → birth_date
                    "gender": user_info.get("gender")
                }
                
                print(f"💾 [인증성공-백그라운드] 환자 정보 저장 시작 - UUID: {patient_uuid}, Hospital: {hospital_id}")
                print(f"   - 이름: {user_info_for_save['name']}")
                print(f"   - 전화번호: {user_info_for_save['phone_number'][:3]}*** (마스킹)")
                print(f"   - 생년월일: {user_info_for_save['birth_date']}")
                print(f"   - 성별: {user_info_for_save['gender']}")
                
                patient_id = await wello_service.save_patient_data(
                    uuid=patient_uuid,
                    hospital_id=hospital_id,
                    user_info=user_info_for_save,
                    session_id=session_id
                )
                
                if patient_id:
                    print(f"✅ [인증성공-백그라운드] 환자 정보 저장 완료 - Patient ID: {patient_id}")
                else:
                    print(f"⚠️ [인증성공-백그라운드] 환자 정보 저장 실패")
            except Exception as e:
                print(f"❌ [인증성공-백그라운드] 환자 정보 저장 중 오류: {e}")
                # 환자 정보 저장 실패해도 데이터 수집은 계속 진행
        
        # 데이터 수집 요청 준비
        request_login = {
            "cxId": auth_data["cxId"],
            "privateAuthType": auth_data["privateAuthType"],
            "reqTxId": auth_data["reqTxId"],
            "token": auth_data["token"],
            "txId": auth_data["txId"],
            "userName": user_info["name"],
            "birthday": user_info["birthdate"],
            "phoneNo": user_info["phone_no"]
        }
        
        # 건강검진 데이터 수집
        session_manager.update_session_status(
            session_id,
            "fetching_health_data", 
            "건강검진 데이터를 가져오고 있습니다..."
        )
        
        try:
            health_data = await get_health_screening_data(request_login)
            # 틸코 API 응답에서 에러 확인
            if health_data.get("Status") == "Error":
                error_msg = health_data.get("Message", "건강검진 데이터 수집 실패")
                session_manager.add_error_message(session_id, f"건강검진 데이터 오류: {error_msg}")
                return
            else:
                session_manager.update_health_data(session_id, health_data)
        except Exception as e:
            session_manager.add_error_message(session_id, f"건강검진 데이터 수집 실패: {str(e)}")
            return
        
        # 처방전 데이터 수집
        session_manager.update_session_status(
            session_id,
            "fetching_prescription_data",
            "처방전 데이터를 가져오고 있습니다..."
        )
        
        try:
            prescription_data = await get_prescription_data(request_login)
            # 틸코 API 응답에서 에러 확인
            if prescription_data.get("Status") == "Error":
                error_msg = prescription_data.get("Message", "처방전 데이터 수집 실패")
                session_manager.add_error_message(session_id, f"처방전 데이터 오류: {error_msg}")
                return
            else:
                session_manager.update_prescription_data(session_id, prescription_data)
        except Exception as e:
            session_manager.add_error_message(session_id, f"처방전 데이터 수집 실패: {str(e)}")
            return
        
        # 모든 데이터 수집 완료
        session_manager.complete_session(session_id)
        
    except Exception as e:
        session_manager.add_error_message(session_id, f"데이터 수집 중 오류 발생: {str(e)}")

@router.delete("/session/{session_id}")
async def cleanup_session(session_id: str) -> Dict[str, Any]:
    """
    세션 정리 (사용자 요청)
    """
    try:
        session_data = session_manager.get_session(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
        
        # 세션 파일 삭제
        import os
        file_path = os.path.join(session_manager.data_dir, f"{session_id}.json")
        if os.path.exists(file_path):
            os.remove(file_path)
        
        return {
            "success": True,
            "message": "세션이 정리되었습니다."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"세션 정리 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/session/cleanup")
async def cleanup_expired_sessions() -> Dict[str, Any]:
    """
    만료된 세션들 정리
    """
    try:
        cleaned_count = session_manager.cleanup_expired_sessions()
        return {
            "success": True,
            "message": f"{cleaned_count}개의 만료된 세션을 정리했습니다.",
            "cleaned_count": cleaned_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"세션 정리 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/session/cleanup-user/{user_name}")
async def cleanup_user_sessions(user_name: str) -> Dict[str, Any]:
    """
    특정 사용자의 모든 세션 정리
    """
    try:
        cleaned_count = session_manager.force_cleanup_user_sessions(user_name)
        return {
            "success": True,
            "message": f"{user_name}님의 {cleaned_count}개 세션을 정리했습니다.",
            "cleaned_count": cleaned_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"사용자 세션 정리 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/session/stats")
async def get_session_stats() -> Dict[str, Any]:
    """
    세션 통계 조회
    """
    try:
        stats = {
            "total_sessions": 0,
            "active_sessions": 0,
            "expired_sessions": 0,
            "error_sessions": 0,
            "completed_sessions": 0,
            "by_status": {}
        }
        
        current_time = datetime.now()
        
        for filename in os.listdir(session_manager.data_dir):
            if filename.endswith('.json'):
                session_id = filename[:-5]
                session_data = session_manager.get_session(session_id)
                if session_data:
                    stats["total_sessions"] += 1
                    status = session_data.get("status", "unknown")
                    stats["by_status"][status] = stats["by_status"].get(status, 0) + 1
                    
                    expires_at = datetime.fromisoformat(session_data["expires_at"])
                    if current_time > expires_at:
                        stats["expired_sessions"] += 1
                    elif status == "error":
                        stats["error_sessions"] += 1
                    elif status == "completed":
                        stats["completed_sessions"] += 1
                    else:
                        stats["active_sessions"] += 1
        
        return {
            "success": True,
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"세션 통계 조회 중 오류가 발생했습니다: {str(e)}"
        )


# 새로운 폴링용 엔드포인트들
@router.get("/session/{session_id}/status")
async def get_session_status_for_polling(session_id: str):
    """세션 상태 조회 (폴링용)"""
    print(f"📊 [틸코API] 세션 상태 조회 - 세션: {session_id}")
    
    # 세션 데이터 조회
    session_data = session_manager.get_session(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    
    response_data = {
        "success": True,
        "session_id": session_id,
        "status": session_data.get("status", "unknown"),
        "progress": session_data.get("progress", {}),
        "messages": session_data.get("messages", [])[-3:],  # 최근 3개 메시지만
        "updated_at": session_data.get("updated_at"),
        "user_name": session_data.get("user_info", {}).get("name", ""),
        "patient_uuid": session_data.get("patient_uuid"),
        "hospital_id": session_data.get("hospital_id")
    }
    
    # 데이터 수집이 완료된 경우 실제 데이터 포함 (프론트엔드 완료 감지용)
    if session_data.get("status") == "completed":
        health_data = session_data.get("health_data")
        prescription_data = session_data.get("prescription_data")
        
        if health_data:
            response_data["health_data"] = health_data
        if prescription_data:
            response_data["prescription_data"] = prescription_data
    
    return response_data


@router.post("/session/{session_id}/collect-data")
async def collect_data_unified(session_id: str, background_tasks: BackgroundTasks):
    """통합 데이터 수집 API (자동 폴링용) - 중복 수집 방지 강화"""
    try:
        session_data = session_manager.get_session(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
        
        # 🚨 중복 수집 방지: 이미 데이터 수집이 진행 중인지 확인
        current_status = session_data.get("status", "")
        collection_started = session_data.get("collection_started", False)
        
        if current_status in ["fetching_health_data", "fetching_prescription_data", "completed"] or collection_started:
            print(f"⚠️ [중복방지] 세션 {session_id}는 이미 데이터 수집 중 또는 완료됨 (상태: {current_status}, 플래그: {collection_started})")
            return {
                "success": True,
                "session_id": session_id,
                "message": f"데이터 수집이 이미 진행 중이거나 완료되었습니다. (상태: {current_status})",
                "status": current_status,
                "collection_started": collection_started,
                "duplicate_collection_prevented": True
            }
        
        # temp_auth_data를 auth_data로 변환 (인증 완료 상태로 전환)
        temp_auth_data = session_data.get("temp_auth_data")
        if not temp_auth_data:
            raise HTTPException(status_code=400, detail="인증 데이터가 없습니다.")
        
        # auth_data 생성
        auth_data = {
            "CxId": temp_auth_data.get("cxId"),
            "PrivateAuthType": temp_auth_data.get("privateAuthType", "0"),
            "ReqTxId": temp_auth_data.get("reqTxId"),
            "Token": temp_auth_data.get("token"),
            "TxId": temp_auth_data.get("txId")
        }
        session_data["auth_data"] = auth_data
        session_manager._save_session(session_id, session_data)
        
        # 백그라운드에서 데이터 수집 (직접 실행으로 변경)
        print(f"🚀 [통합수집] 백그라운드 작업 직접 실행 시작: {session_id}")
        await collect_health_data_background_task(session_id)
        
        return {
            "success": True,
            "message": "데이터 수집을 시작했습니다.",
            "session_id": session_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [통합수집] 오류: {e}")
        raise HTTPException(status_code=500, detail=f"데이터 수집 중 오류가 발생했습니다: {str(e)}")

@router.post("/session/{session_id}/manual-auth-complete")
async def manual_auth_complete(session_id: str) -> Dict[str, Any]:
    """수동으로 인증 완료 상태로 변경 (디버깅용)"""
    try:
        session_data = session_manager.get_session(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
        
        print(f"🔧 [수동인증완료] 세션 {session_id}를 인증 완료 상태로 변경")
        
        # 세션 상태를 인증 완료로 변경
        session_manager.update_session_status(session_id, "auth_completed", "수동으로 인증 완료 처리되었습니다.")
        session_manager.add_error_message(session_id, "인증이 완료되었습니다. 건강검진 데이터를 수집할 수 있습니다.")
        
        # temp_auth_data를 실제 auth_data로 변환
        temp_auth_data = session_data.get("temp_auth_data", {})
        if temp_auth_data:
            auth_data = {
                "CxId": temp_auth_data.get("cxId"),
                "PrivateAuthType": temp_auth_data.get("privateAuthType", "0"),
                "ReqTxId": temp_auth_data.get("reqTxId"),
                "Token": temp_auth_data.get("token"),
                "TxId": temp_auth_data.get("txId")
            }
            session_data["auth_data"] = auth_data
            session_manager._save_session(session_id, session_data)
        
        return {
            "success": True,
            "session_id": session_id,
            "message": "인증 완료 상태로 변경되었습니다.",
            "next_step": "collect_health_data"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"수동 인증 완료 처리 중 오류: {str(e)}")

@router.post("/session/{session_id}/collect-health-data")
async def start_health_data_collection(session_id: str, background_tasks: BackgroundTasks):
    """건강정보 수집 시작"""
    print(f"🏥 [틸코API] 건강정보 수집 시작 - 세션: {session_id}")
    
    # 세션 데이터 조회
    session_data = session_manager.get_session(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    
    # 인증 완료 상태인지 확인
    if session_data.get("status") not in ["authenticated", "auth_completed"]:
        raise HTTPException(status_code=400, detail=f"인증이 완료되지 않았습니다. 현재 상태: {session_data.get('status')}")
    
    # 세션 상태 업데이트
    session_manager.update_session_status(session_id, "fetching_health_data", "건강검진 데이터를 수집하고 있습니다...")
    
    try:
        # 백그라운드에서 건강정보 수집 시작
        background_tasks.add_task(collect_health_data_background_task, session_id)
        
        return {
            "success": True,
            "message": "건강정보 수집을 시작했습니다.",
            "session_id": session_id,
            "status": "fetching_health_data"
        }
        
    except Exception as e:
        error_msg = f"건강정보 수집 시작 중 오류 발생: {str(e)}"
        print(f"❌ [틸코API] {error_msg}")
        session_manager.add_error_message(session_id, error_msg)
        session_manager.update_session_status(session_id, "error", error_msg)
        raise HTTPException(status_code=500, detail=error_msg)


async def collect_health_data_background_task(session_id: str):
    """건강정보 수집 백그라운드 작업 (실제 Tilko API 호출) - 중복 실행 방지 강화"""
    try:
        print(f"🔄 [백그라운드] 실제 건강정보 수집 시작 - 세션: {session_id}")
        
        session_data = session_manager.get_session(session_id)
        if not session_data:
            print(f"❌ [백그라운드] 세션 {session_id} 없음 - 작업 중단")
            return
        
        # 🚨 중복 실행 방지: 이미 수집이 진행 중이거나 완료된 경우 중단
        current_status = session_data.get("status", "")
        collection_started = session_data.get("collection_started", False)
        
        if current_status in ["fetching_health_data", "fetching_prescription_data", "completed"] or collection_started:
            print(f"⚠️ [백그라운드중복방지] 세션 {session_id}는 이미 수집 중/완료 (상태: {current_status}, 플래그: {collection_started}) - 작업 중단")
            return
        
        # 🔒 수집 시작 플래그 설정 (다른 백그라운드 작업 차단)
        session_data["collection_started"] = True
        session_data["collection_start_time"] = datetime.now().isoformat()
        session_manager._save_session(session_id, session_data)
        print(f"🔒 [백그라운드] 수집 시작 플래그 설정 - 세션: {session_id}")
        
        # 사용자 정보 가져오기
        user_info = session_data.get("user_info")
        if not user_info:
            session_manager.add_error_message(session_id, "사용자 정보가 없습니다.")
            return
        
        # 인증이 완료된 세션에서 auth_data 가져오기 (simple-auth 완료 시 설정됨)
        auth_data = session_data.get("auth_data")
        
        # 인증 데이터가 없으면 오류 처리 (실제 인증이 완료되어야만 진행)
        if not auth_data:
            error_msg = "인증이 완료되지 않았습니다. 카카오톡에서 인증을 먼저 완료해주세요."
            session_manager.add_error_message(session_id, error_msg)
            print(f"❌ [백그라운드] {error_msg}")
            return
        
        # 데이터 수집 요청 준비 (대문자 키 사용)
        request_login = {
            "CxId": auth_data.get("CxId", ""),
            "PrivateAuthType": auth_data.get("PrivateAuthType", user_info["private_auth_type"]),
            "ReqTxId": auth_data.get("ReqTxId", ""),
            "Token": auth_data.get("Token", ""),
            "TxId": auth_data.get("TxId", ""),
            "UserName": user_info["name"],
            "BirthDate": user_info["birthdate"],
            "UserCellphoneNumber": user_info["phone_no"]
        }
        
        # 건강검진 데이터 수집
        session_manager.update_session_status(
            session_id,
            "fetching_health_data", 
            "건강검진 데이터를 수집하고 있습니다..."
        )
        
        # 진행 상황 WebSocket 알림
        try:
            from app.api.v1.endpoints.websocket_auth import notify_streaming_status
            await notify_streaming_status(
                session_id,
                "fetching_health_data", 
                "건강검진 데이터를 수집하고 있습니다..."
            )
        except Exception as e:
            print(f"⚠️ [백그라운드] 건강검진 진행 알림 실패: {e}")
        
        try:
            print(f"🏥 [백그라운드] === 건강검진 데이터 API 호출 시작 ===")
            print(f"🏥 [백그라운드] 인증 정보 - CxId: {auth_data.get('CxId', '')[:10]}...")
            print(f"🏥 [백그라운드] 사용자: {user_info['name']}")
            
            health_data = await get_health_screening_data(request_login)
            
            if health_data.get("Status") == "Error":
                error_msg = health_data.get("Message", "건강검진 데이터 수집 실패")
                error_code = health_data.get("ErrorCode", 0)
                error_log = health_data.get("ErrorLog", "")
                
                # 사용자 정보 오류인 경우 (인증 정보 불일치)
                is_user_info_error = (
                    "입력하신 정보" in error_msg or 
                    "인증을 진행할 수 없습니다" in error_msg or
                    "사용자 정보" in error_msg or
                    "확인 후 다시 시도" in error_msg
                )
                
                if is_user_info_error:
                    # 사용자 정보 재확인 필요 상태로 변경
                    detailed_error = {
                        "type": "user_info_error",
                        "title": "사용자 정보 확인 필요",
                        "message": error_msg,
                        "error_code": error_code,
                        "error_log": error_log,
                        "requires_info_recheck": True,
                        "retry_available": True
                    }
                    session_manager.add_error_message(session_id, detailed_error)
                    session_manager.update_session_status(
                        session_id, 
                        "info_required", 
                        "입력하신 정보를 확인해주세요. 이름, 생년월일, 전화번호가 정확한지 확인 후 다시 시도해주세요."
                    )
                    print(f"❌ [백그라운드] 건강검진 데이터 오류 (사용자 정보 오류): {error_msg}")
                    print(f"   ErrorCode: {error_code}, ErrorLog: {error_log}")
                    # 사용자 정보 오류인 경우 처방전 수집도 중단
                    return
                else:
                    # 기타 오류 (일시적 오류 등)
                    detailed_error = {
                        "type": "health_data_error",
                        "title": "건강검진 데이터 수집 실패",
                        "message": f"건강검진 데이터 수집에 실패했습니다.\n{error_msg}\n\n확인 버튼을 누르면 메인 페이지로 이동합니다.",
                        "error_code": error_code,
                        "error_log": error_log,
                        "retry_available": False,
                        "redirect_to_landing": True
                    }
                    session_manager.add_error_message(session_id, detailed_error)
                    
                    # 건강검진 실패 메시지 전송
                    try:
                        await notify_streaming_status(
                            session_id,
                            "health_data_failed",
                            f"건강검진 데이터 수집에 실패했습니다.\n{error_msg}",
                            {"redirect": True}
                        )
                    except Exception as e:
                        print(f"⚠️ [백그라운드] 건강검진 실패 알림 실패: {e}")
                    
                    print(f"❌ [백그라운드] 건강검진 데이터 오류: {error_msg}")
                    # 기타 오류는 처방전 수집 계속 진행
            else:
                session_manager.update_health_data(session_id, health_data)
                
                # 건강검진 기록 수 확인
                result_list = health_data.get("ResultList", [])
                health_count = len(result_list) if isinstance(result_list, list) else 0
                
                # 건강검진 수집 완료 메시지 전송
                health_success_message = f"건강검진 데이터 {health_count}건 수집했습니다."
                try:
                    await notify_streaming_status(
                        session_id,
                        "health_data_completed",
                        health_success_message,
                        {"count": health_count}
                    )
                except Exception as e:
                    print(f"⚠️ [백그라운드] 건강검진 완료 알림 실패: {e}")
                
                print(f"✅ [백그라운드] 건강검진 데이터 수집 성공 - {health_count}건")
                print(f"✅ [백그라운드] JSON 파일 저장 완료")
                
        except Exception as e:
            session_manager.add_error_message(session_id, f"건강검진 데이터 수집 실패: {str(e)}")
            print(f"❌ [백그라운드] 건강검진 데이터 수집 실패: {str(e)}")
            return
        
        # 처방전 데이터 수집
        session_manager.update_session_status(
            session_id,
            "fetching_prescription_data",
            "처방전 데이터를 수집하고 있습니다..."
        )
        
        # 진행 상황 WebSocket 알림
        try:
            await notify_streaming_status(
                session_id,
                "fetching_prescription_data", 
                "처방전 데이터를 수집하고 있습니다..."
            )
        except Exception as e:
            print(f"⚠️ [백그라운드] 처방전 진행 알림 실패: {e}")
        
        try:
            print(f"💊 [백그라운드] === 처방전 데이터 API 호출 시작 ===")
            print(f"💊 [백그라운드] 동일한 인증 정보 재사용 - CxId: {auth_data.get('CxId', '')[:10]}...")
            print(f"💊 [백그라운드] 사용자: {user_info['name']}")
            
            prescription_data = await get_prescription_data(request_login)
            
            if prescription_data.get("Status") == "Error":
                error_msg = prescription_data.get("ErrMsg", prescription_data.get("Message", "처방전 데이터 수집 실패"))
                error_code = prescription_data.get("ErrorCode", 0)
                technical_detail = prescription_data.get("TechnicalDetail", "")
                error_log = prescription_data.get("ErrorLog", "")
                
                # 사용자 정보 오류인 경우 (인증 정보 불일치)
                is_user_info_error = (
                    "입력하신 정보" in error_msg or 
                    "인증을 진행할 수 없습니다" in error_msg or
                    "사용자 정보" in error_msg or
                    "확인 후 다시 시도" in error_msg or
                    error_code == 8801005  # 통신 오류지만 사용자 정보 문제일 수 있음
                )
                
                if is_user_info_error:
                    # 사용자 정보 재확인 필요 상태로 변경
                    detailed_error = {
                        "type": "user_info_error",
                        "title": "사용자 정보 확인 필요",
                        "message": error_msg,
                        "error_code": error_code,
                        "error_log": error_log,
                        "technical_detail": technical_detail,
                        "requires_info_recheck": True,
                        "retry_available": True
                    }
                    session_manager.add_error_message(session_id, detailed_error)
                    session_manager.update_session_status(
                        session_id, 
                        "info_required", 
                        "입력하신 정보를 확인해주세요. 이름, 생년월일, 전화번호가 정확한지 확인 후 다시 시도해주세요."
                    )
                    print(f"❌ [백그라운드] 처방전 데이터 오류 (사용자 정보 오류): {error_msg}")
                    print(f"   ErrorCode: {error_code}, ErrorLog: {error_log}")
                else:
                    # 기타 오류 (일시적 오류 등)
                    user_friendly_error = {
                        "type": "prescription_error",
                        "title": "처방전 데이터 수집 실패",
                        "message": f"처방전 데이터 수집에 실패했습니다.\n{error_msg}\n\n5초 후 처음 페이지로 돌아갑니다.",
                        "error_code": error_code,
                        "error_log": error_log,
                        "technical_detail": technical_detail,
                        "retry_available": False,
                        "redirect_to_landing": True
                    }
                    session_manager.add_error_message(session_id, user_friendly_error)
                    
                    # 처방전 실패 메시지 전송
                    try:
                        await notify_streaming_status(
                            session_id,
                            "prescription_data_failed",
                            f"처방전 데이터 수집에 실패했습니다.\n{error_msg}\n\n5초 후 처음 페이지로 돌아갑니다.",
                            {"error_code": error_code, "redirect": True}
                        )
                    except Exception as e:
                        print(f"⚠️ [백그라운드] 처방전 실패 알림 실패: {e}")
                    
                    print(f"❌ [백그라운드] 처방전 데이터 오류: {error_msg}")
                    if technical_detail:
                        print(f"   기술적 상세: {technical_detail}")
            else:
                session_manager.update_prescription_data(session_id, prescription_data)
                print(f"✅ [백그라운드] 처방전 데이터 수집 성공")
                print(f"✅ [백그라운드] JSON 파일 저장 완료")
                
        except Exception as e:
            # 예외 발생 시 사용자 친화적 에러 메시지
            error_message = f"처방전 데이터 수집에 실패했습니다.\n처방전 데이터를 가져오는 중 문제가 발생했습니다.\n\n5초 후 처음 페이지로 돌아갑니다."
            user_friendly_error = {
                "type": "prescription_exception",
                "title": "처방전 데이터 수집 실패",
                "message": error_message,
                "technical_detail": f"Exception: {str(e)}",
                "retry_available": False,
                "redirect_to_landing": True
            }
            
            session_manager.add_error_message(session_id, user_friendly_error)
            
            # 처방전 실패 메시지 전송
            try:
                await notify_streaming_status(
                    session_id,
                    "prescription_data_failed",
                    error_message,
                    {"redirect": True}
                )
            except Exception as e2:
                print(f"⚠️ [백그라운드] 처방전 실패 알림 실패: {e2}")
            
            print(f"❌ [백그라운드] 처방전 데이터 수집 실패: {str(e)}")
        
        # 모든 데이터 수집 완료
        session_manager.complete_session(session_id)
        print(f"✅ [백그라운드] 모든 건강정보 수집 완료 - 세션: {session_id}")
        
        # 🔓 수집 완료 플래그 설정 및 정리
        session_data = session_manager.get_session(session_id)
        if session_data:
            session_data["collection_started"] = False
            session_data["collection_completed"] = True
            session_data["collection_end_time"] = datetime.now().isoformat()
            session_manager._save_session(session_id, session_data)
            print(f"🔓 [백그라운드] 수집 완료 플래그 설정 - 세션: {session_id}")
        
        # 🚀 파일 우선 저장 후 DB 입력 전략 적용
        try:
            from app.services.file_first_data_service import FileFirstDataService
            file_first_service = FileFirstDataService()
            
            # 세션에서 환자 정보 가져오기 (최신 세션 데이터 사용)
            final_session_data = session_manager.get_session(session_id)
            patient_uuid = final_session_data.get("patient_uuid")
            hospital_id = final_session_data.get("hospital_id")
            
            print(f"🔍 [백그라운드] 환자 정보 확인 - patient_uuid: {patient_uuid}, hospital_id: {hospital_id}")
            
            if patient_uuid and hospital_id:
                # 1단계: 모든 데이터를 파일로 먼저 저장
                print(f"📁 [파일우선] 1단계 - 데이터 파일 저장 시작")
                
                # 환자 정보 파일 저장
                await file_first_service.save_data_to_file_first(
                    session_id, "patient_data", user_info, patient_uuid, hospital_id
                )
                
                # 건강검진 데이터 파일 저장
                health_data = final_session_data.get("health_data")
                if health_data:
                    await file_first_service.save_data_to_file_first(
                        session_id, "health_data", health_data, patient_uuid, hospital_id
                    )
                
                # 처방전 데이터 파일 저장
                prescription_data = final_session_data.get("prescription_data")
                if prescription_data:
                    await file_first_service.save_data_to_file_first(
                        session_id, "prescription_data", prescription_data, patient_uuid, hospital_id
                    )
                
                print(f"✅ [파일우선] 1단계 완료 - 모든 데이터 파일 저장 완료")
                
                # 2단계: 파일에서 DB로 저장 (즉시 처리)
                print(f"🗄️ [파일우선] 2단계 - DB 저장 시작")
                db_results = await file_first_service.process_pending_files_to_db(max_files=10)
                
                if db_results["success"] > 0:
                    print(f"✅ [백그라운드] 파일 우선 저장 완료 - 성공: {db_results['success']}건")
                else:
                    print(f"⚠️ [백그라운드] DB 저장 실패 - 파일은 안전하게 보관됨")
                    
                print(f"✅ [백그라운드] 모든 데이터 처리 완료 - 환자: {patient_uuid}")
            else:
                print(f"⚠️ [백그라운드] 환자 UUID 또는 병원 ID가 없어서 저장 생략")
                
        except Exception as e:
            print(f"❌ [백그라운드] DB 저장 실패: {str(e)}")
            # DB 저장 실패해도 알림은 계속 진행
        
        # 완료 알림 전송
        try:
            from app.api.v1.endpoints.websocket_auth import notify_completion
            
            # 수집된 데이터 가져오기
            final_session_data = session_manager.get_session(session_id)
            collected_data = {
                "health_data": final_session_data.get("health_data"),
                "prescription_data": final_session_data.get("prescription_data")
            }
            
            await notify_completion(session_id, collected_data)
            print(f"✅ [백그라운드] 완료 알림 전송 완료 - 세션: {session_id}")
            
        except Exception as e:
            print(f"⚠️ [백그라운드] 완료 알림 전송 실패: {e}")
        
    except Exception as e:
        error_msg = f"건강정보 수집 백그라운드 작업 실패: {str(e)}"
        print(f"❌ [백그라운드] {error_msg}")
        
        # 🔓 에러 발생 시에도 수집 플래그 정리
        try:
            session_data = session_manager.get_session(session_id)
            if session_data:
                session_data["collection_started"] = False
                session_data["collection_error"] = True
                session_data["collection_error_time"] = datetime.now().isoformat()
                session_data["collection_error_message"] = error_msg
                session_manager._save_session(session_id, session_data)
                print(f"🔓 [백그라운드] 에러 시 수집 플래그 정리 - 세션: {session_id}")
        except Exception as cleanup_error:
            print(f"⚠️ [백그라운드] 플래그 정리 실패: {cleanup_error}")
        
        session_manager.add_error_message(session_id, error_msg)
        session_manager.update_session_status(session_id, "error", error_msg)


async def auto_check_auth_status(session_id: str):
    """
    백그라운드에서 2초마다 인증 상태를 자동 체크하고 완료 시 상태 업데이트
    """
    import sys
    max_attempts = 150  # 5분 (2초 * 150회)
    attempt = 0
    
    print(f"🔄 [자동체크] 세션 {session_id} 인증 상태 자동 체크 시작", flush=True)
    sys.stdout.flush()
    sys.stderr.flush()
    
    try:
        while attempt < max_attempts:
            attempt += 1
            
            # 세션 데이터 조회
            session_data = session_manager.get_session(session_id)
            if not session_data:
                print(f"❌ [자동체크] 세션 {session_id} 없음 - 체크 중단")
                break
            
            # 이미 인증 완료된 경우 체크 중단
            current_status = session_data.get("status", "")
            if current_status in ["auth_completed", "authenticated", "error"]:
                print(f"✅ [자동체크] 세션 {session_id} 이미 완료됨 (상태: {current_status}) - 체크 중단")
                break
            
            # temp_auth_data 확인
            temp_auth_data = session_data.get("temp_auth_data")
            if not temp_auth_data or not temp_auth_data.get("cxId"):
                print(f"⚠️ [자동체크] 세션 {session_id} 인증 데이터 없음 - 체크 중단")
                break
            
            print(f"🔍 [자동체크] 세션 {session_id} 인증 상태 확인 중... (시도 {attempt}/{max_attempts})")
            
            try:
                # 틸코 API로 인증 상태 확인
                auth_result = await check_auth_status(
                    temp_auth_data.get("cxId"),
                    temp_auth_data.get("txId", "")
                )
                
                print(f"🔍 [자동체크] 틸코 응답: Status={auth_result.get('Status')}")
                
                # 인증 완료 확인
                if auth_result.get("Status") == "OK" and auth_result.get("ResultData"):
                    print(f"✅ [자동체크] 세션 {session_id} 인증 완료 감지!")
                    
                    # 세션 상태를 auth_completed로 변경
                    session_manager.update_session_status(
                        session_id, 
                        "auth_completed", 
                        "인증이 완료되었습니다. 건강검진 데이터를 수집할 수 있습니다."
                    )
                    
                    # WebSocket으로 클라이언트에 즉시 알림
                    try:
                        from .websocket_auth import notify_auth_completed
                        await notify_auth_completed(session_id, auth_data)
                    except Exception as e:
                        print(f"⚠️ [자동체크] WebSocket 알림 실패: {e}")
                    
                    # temp_auth_data를 auth_data로 변환
                    auth_data = {
                        "CxId": temp_auth_data.get("cxId"),
                        "PrivateAuthType": temp_auth_data.get("privateAuthType", "0"),
                        "ReqTxId": temp_auth_data.get("reqTxId"),
                        "Token": temp_auth_data.get("token"),
                        "TxId": temp_auth_data.get("txId")
                    }
                    
                    # Redis에서 직접 auth_data 업데이트
                    session_data = session_manager.get_session(session_id)
                    if session_data:
                        session_data["auth_data"] = auth_data
                        session_data["progress"]["auth_completed"] = True
                        session_manager._save_session(session_id, session_data)
                    
                    print(f"🎉 [자동체크] 세션 {session_id} 인증 완료 처리 완료!")
                    break
                    
            except Exception as e:
                print(f"⚠️ [자동체크] 틸코 API 호출 실패: {e}")
            
            # 2초 대기
            await asyncio.sleep(2)
        
        # 최대 시도 횟수 도달 시
        if attempt >= max_attempts:
            print(f"⏰ [자동체크] 세션 {session_id} 타임아웃 (5분 경과)")
            session_manager.add_error_message(
                session_id, 
                "인증 시간이 초과되었습니다. 다시 시도해주세요."
            )
            
    except Exception as e:
        print(f"❌ [자동체크] 세션 {session_id} 체크 중 오류: {e}")
        session_manager.add_error_message(session_id, f"인증 상태 체크 오류: {str(e)}")


async def streaming_auth_monitor(session_id: str):
    """
    실시간 스트리밍 인증 모니터링
    - 백엔드에서 틸코 인증 완료까지 폴링 (10초 제한)
    - 2초마다 인증 완료 여부 확인
    - 완료되면 즉시 데이터 수집 시작
    - 모든 과정을 WebSocket으로 실시간 스트리밍
    """
    import sys
    import asyncio
    max_attempts = 5  # 10초 (2초 * 5회) - 빠른 인증 체크
    attempt = 0
    
    print(f"🎬 [스트리밍모니터] 세션 {session_id} 실시간 모니터링 시작 (10초 제한)", flush=True)
    sys.stdout.flush()
    
    try:
        while attempt < max_attempts:
            attempt += 1
            
            # 세션 만료 확인
            if session_manager.is_session_expired(session_id):
                print(f"⏰ [스트리밍모니터] 세션 {session_id} 만료됨 - 모니터링 중단")
                break
            
            session_data = session_manager.get_session(session_id)
            if not session_data:
                print(f"❌ [스트리밍모니터] 세션 {session_id} 없음 - 모니터링 중단")
                break
            
            current_status = session_data.get("status", "")
            if current_status in ["auth_completed", "authenticated", "error", "completed"]:
                print(f"✅ [스트리밍모니터] 세션 {session_id} 이미 완료됨 (상태: {current_status}) - 모니터링 중단")
                break
            
            temp_auth_data = session_data.get("temp_auth_data")
            if not temp_auth_data or not temp_auth_data.get("cxId"):
                print(f"⚠️ [스트리밍모니터] 세션 {session_id} 인증 데이터 없음 - 모니터링 중단")
                break
            
            print(f"🔍 [스트리밍모니터] 세션 {session_id} 인증 상태 확인 중... (시도 {attempt}/{max_attempts}) - 2초 간격")
            
            try:
                # 실제 건강검진 API 호출로 인증 완료 여부 판단
                from app.utils.tilko_utils import get_health_screening_data
                
                # user_info에서 필요한 데이터 추출
                user_info = session_data.get("user_info", {})
                
                # private_auth_type 필수 확인
                private_auth_type_for_streaming = temp_auth_data.get("privateAuthType") or user_info.get("private_auth_type")
                if not private_auth_type_for_streaming:
                    print(f"❌ [스트리밍모니터] 세션에 저장된 인증 방식이 없습니다.")
                    break
                
                auth_data = {
                    "CxId": temp_auth_data.get("cxId"),
                    "PrivateAuthType": str(private_auth_type_for_streaming).strip(),
                    "ReqTxId": temp_auth_data.get("reqTxId"),
                    "Token": temp_auth_data.get("token"),
                    "TxId": temp_auth_data.get("txId"),
                    "UserName": temp_auth_data.get("userName") or user_info.get("name", ""),
                    "BirthDate": temp_auth_data.get("birthDate") or user_info.get("birthdate", ""),
                    "UserCellphoneNumber": temp_auth_data.get("userCellphoneNumber") or user_info.get("phone_no", "")
                }
                
                health_result = await get_health_screening_data(auth_data)
                
                print(f"🔍 [스트리밍모니터] 건강검진 API 응답: Status={health_result.get('Status')}")
                
                # 인증 완료 여부 판단
                if health_result.get("Status") == "OK":
                    # 인증 완료 및 데이터 수집 성공
                    print(f"✅ [스트리밍모니터] 세션 {session_id} 인증 완료 감지!")
                    
                    # 세션 연장 (데이터 수집 시간 확보)
                    session_manager.extend_session(session_id, 60)  # 1분 연장
                    
                    # 세션 상태 업데이트
                    session_manager.update_session_status(
                        session_id,
                        "auth_completed",
                        "인증이 완료되었습니다. 데이터를 수집하고 있습니다..."
                    )
                    
                    # 실시간 알림
                    try:
                        from .websocket_auth import (
                            notify_auth_completed, 
                            notify_data_extracting, 
                            notify_session_extended,
                            notify_completion
                        )
                        
                        await notify_auth_completed(session_id, auth_data)
                        await notify_session_extended(session_id, 60)
                        await notify_data_extracting(session_id, "건강검진")
                        
                    except Exception as e:
                        print(f"⚠️ [스트리밍모니터] WebSocket 알림 실패: {e}")
                    
                    # 건강검진 데이터 저장
                    session_manager.update_health_data(session_id, health_result)
                    
                    # 처방전 데이터 수집
                    try:
                        await notify_data_extracting(session_id, "처방전")
                        
                        from app.utils.tilko_utils import get_prescription_data
                        prescription_result = await get_prescription_data(auth_data)
                        
                        if prescription_result.get("Status") == "OK":
                            session_manager.update_prescription_data(session_id, prescription_result)
                            print(f"✅ [스트리밍모니터] 처방전 데이터 수집 완료")
                        else:
                            print(f"⚠️ [스트리밍모니터] 처방전 데이터 수집 실패: {prescription_result.get('Message', 'Unknown')}")
                            
                    except Exception as e:
                        print(f"❌ [스트리밍모니터] 처방전 데이터 수집 오류: {e}")
                    
                    # 최종 완료 처리
                    session_manager.complete_session(session_id)
                    
                    # 수집된 데이터 정리
                    final_session_data = session_manager.get_session(session_id)
                    collected_data = {
                        "health_data": final_session_data.get("health_data"),
                        "prescription_data": final_session_data.get("prescription_data")
                    }
                    
                    # 완료 알림
                    try:
                        await notify_completion(session_id, collected_data)
                    except Exception as e:
                        print(f"⚠️ [스트리밍모니터] 완료 알림 실패: {e}")
                    
                    print(f"🎉 [스트리밍모니터] 세션 {session_id} 전체 프로세스 완료!")
                    break
                    
                elif health_result.get("Status") == "Error":
                    # 인증 미완료 상태 (정상적인 대기 상태)
                    error_msg = health_result.get("ErrMsg", "")
                    if "간편인증 로그인 요청이 실패" in error_msg or "인증을 진행할 수 없습니다" in error_msg:
                        print(f"⏳ [스트리밍모니터] 인증 대기 중... (사용자가 아직 카카오톡에서 인증하지 않음)")
                    else:
                        print(f"⚠️ [스트리밍모니터] 인증 에러: {error_msg}")
                else:
                    print(f"⏳ [스트리밍모니터] 아직 인증 미완료 (Status: {health_result.get('Status')})")
                    
            except Exception as e:
                print(f"⚠️ [스트리밍모니터] API 호출 실패: {e}")
                # 네트워크 에러 등은 계속 재시도
            
            # 2초 대기 (빠른 체크)
            await asyncio.sleep(2)
        
        # 타임아웃 처리
        if attempt >= max_attempts:
            print(f"⏰ [스트리밍모니터] 세션 {session_id} 타임아웃 (10초 경과)")
            session_manager.add_error_message(
                session_id,
                "인증 시간이 초과되었습니다 (10초). 다시 시도해주세요."
            )
            session_manager.update_session_status(session_id, "timeout", "인증 시간 초과")
            
            try:
                from .websocket_auth import notify_timeout
                await notify_timeout(session_id, "인증 시간이 초과되었습니다. 다시 시도해주세요.")
            except Exception as e:
                print(f"⚠️ [스트리밍모니터] 타임아웃 알림 실패: {e}")
    
    except Exception as e:
        print(f"❌ [스트리밍모니터] 세션 {session_id} 모니터링 중 오류: {e}")
        session_manager.add_error_message(session_id, f"모니터링 오류: {str(e)}")
        
        try:
            from .websocket_auth import notify_error
            await notify_error(session_id, f"시스템 오류가 발생했습니다: {str(e)}")
        except Exception as notify_e:
            print(f"⚠️ [스트리밍모니터] 오류 알림 실패: {notify_e}")
