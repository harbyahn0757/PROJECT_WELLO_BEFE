"""
틸코 인증 관련 API 엔드포인트
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any
import os
from datetime import datetime
from app.utils.tilko_utils import (
    get_public_key,
    simple_auth,
    get_health_screening_data,
    get_prescription_data
)
from app.data.tilko_session_data import session_manager
from pydantic import BaseModel
import asyncio

router = APIRouter()

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
            "cxId": request.cx_id,
            "privateAuthType": request.private_auth_type,
            "reqTxId": request.req_tx_id,
            "token": request.token,
            "txId": request.tx_id,
            "userName": request.user_name,
            "birthday": request.birthday,
            "phoneNo": request.phone_no
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
            "cxId": request.cx_id,
            "privateAuthType": request.private_auth_type,
            "reqTxId": request.req_tx_id,
            "token": request.token,
            "txId": request.tx_id,
            "userName": request.user_name,
            "birthday": request.birthday,
            "phoneNo": request.phone_no
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
        # 세션 생성
        user_info = {
            "name": request.user_name,
            "birthdate": request.birthdate,
            "phone_no": request.phone_no,
            "gender": request.gender,
            "private_auth_type": request.private_auth_type
        }
        
        session_id = session_manager.create_session(user_info)
        
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
    세션 기반 카카오 간편인증 요청
    """
    try:
        session_data = session_manager.get_session(session_id)
        if not session_data:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
        
        user_info = session_data["user_info"]
        
        # 간편인증 요청
        session_manager.update_session_status(
            session_id, 
            "auth_requesting", 
            "카카오 간편인증을 요청하고 있습니다..."
        )
        
        result = await simple_auth(
            user_info["private_auth_type"],
            user_info["name"],
            user_info["birthdate"],
            user_info["phone_no"]
        )
        
        if result.get("Status") != "Error":
            # 인증 요청 성공 - 하지만 아직 실제 인증은 완료되지 않은 상태
            # 인증 데이터를 임시 저장 (사용자가 실제 인증 완료 시까지)
            temp_auth_data = {
                "cxId": result.get("ResultData", {}).get("CxId", ""),
                "privateAuthType": "0",
                "reqTxId": result.get("ResultData", {}).get("ReqTxId", ""),
                "token": result.get("ResultData", {}).get("Token", ""),
                "txId": result.get("ResultData", {}).get("TxId", "")
            }
            
            # 임시 인증 데이터 저장 (완료되지 않은 상태)
            session_data = session_manager.get_session(session_id)
            session_data["temp_auth_data"] = temp_auth_data
            session_manager._save_session(session_id, session_data)
            
            session_manager.update_session_status(
                session_id,
                "auth_pending",
                "카카오톡에서 인증을 진행해주세요. 인증 완료를 기다리고 있습니다..."
            )
            
            return {
                "success": True,
                "session_id": session_id,
                "message": "카카오 간편인증이 요청되었습니다. 카카오톡에서 인증을 진행해주세요.",
                "next_step": "wait_for_auth"
            }
        else:
            error_msg = result.get("Message", "인증 요청 실패")
            session_manager.add_error_message(session_id, error_msg)
            raise HTTPException(status_code=400, detail=error_msg)
            
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
    세션 상태 조회
    """
    try:
        status = session_manager.get_session_status(session_id)
        if not status:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
        
        return {
            "success": True,
            "data": status
        }
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
