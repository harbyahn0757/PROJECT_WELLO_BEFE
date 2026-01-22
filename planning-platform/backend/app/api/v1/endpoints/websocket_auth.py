"""
WebSocket을 통한 실시간 인증 상태 알림
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import json
import asyncio
from ....data.redis_session_manager import redis_session_manager as session_manager

router = APIRouter()

# 활성 WebSocket 연결 관리
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        print(f"🔌 [WebSocket] 세션 {session_id} 연결됨")
    
    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
            print(f"🔌 [WebSocket] 세션 {session_id} 연결 해제됨")
    
    async def send_personal_message(self, message: dict, session_id: str):
        if session_id in self.active_connections:
            try:
                await self.active_connections[session_id].send_text(json.dumps(message))
                print(f"📤 [WebSocket] 세션 {session_id}에 메시지 전송: {message.get('type', 'unknown')}")
                return True
            except Exception as e:
                print(f"❌ [WebSocket] 세션 {session_id} 메시지 전송 실패: {e}")
                self.disconnect(session_id)
                return False
        return False
    
    def get_connection_count(self) -> int:
        return len(self.active_connections)

manager = ConnectionManager()

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    세션별 WebSocket 연결
    """
    await manager.connect(websocket, session_id)
    
    try:
        # 연결 확인 메시지 전송
        await manager.send_personal_message({
            "type": "connection_established",
            "session_id": session_id,
            "message": "WebSocket 연결이 설정되었습니다."
        }, session_id)
        
        # 현재 세션 상태 전송
        session_data = session_manager.get_session(session_id)
        if session_data:
            await manager.send_personal_message({
                "type": "session_status",
                "session_id": session_id,
                "status": session_data.get("status", "unknown"),
                "auth_completed": session_data.get("progress", {}).get("auth_completed", False),
                "messages": session_data.get("messages", [])
            }, session_id)
        
        # 연결 유지 (클라이언트에서 메시지 수신 대기)
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # 클라이언트에서 ping 메시지 처리
                if message.get("type") == "ping":
                    await manager.send_personal_message({
                        "type": "pong",
                        "timestamp": message.get("timestamp")
                    }, session_id)
                
                # 상태 확인 요청 처리
                elif message.get("type") == "status_request":
                    session_data = session_manager.get_session(session_id)
                    if session_data:
                        await manager.send_personal_message({
                            "type": "session_status",
                            "session_id": session_id,
                            "status": session_data.get("status", "unknown"),
                            "auth_completed": session_data.get("progress", {}).get("auth_completed", False),
                            "messages": session_data.get("messages", [])
                        }, session_id)
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"❌ [WebSocket] 세션 {session_id} 메시지 처리 오류: {e}")
                break
                
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(session_id)

# 외부에서 호출할 수 있는 알림 함수
async def notify_auth_completed(session_id: str, auth_data: dict = None):
    """
    인증 완료 시 WebSocket으로 클라이언트에 알림
    """
    # 세션에서 user_name 가져오기
    from ..tilko_auth import session_manager
    session_data = session_manager.get_session(session_id)
    user_name = ""
    if session_data:
        user_name = session_data.get("user_info", {}).get("name", "")
    
    # auth_data에 user_name 추가
    if auth_data is None:
        auth_data = {}
    if "user_name" not in auth_data:
        auth_data["user_name"] = user_name
    
    message = {
        "type": "auth_completed",
        "session_id": session_id,
        "message": "인증이 완료되었습니다!",
        "auth_data": auth_data,
        "user_name": user_name,  # 직접 user_name 필드 추가
        "next_step": "collect_health_data"
    }
    
    success = await manager.send_personal_message(message, session_id)
    if success:
        print(f"✅ [WebSocket] 세션 {session_id} 인증 완료 알림 전송됨")
    else:
        print(f"⚠️ [WebSocket] 세션 {session_id} 연결 없음 - 알림 전송 실패")
    
    return success

async def notify_data_collection_progress(session_id: str, progress_type: str, message: str):
    """
    데이터 수집 진행 상황 알림
    """
    notification = {
        "type": "data_collection_progress",
        "session_id": session_id,
        "progress_type": progress_type,  # "health_data", "prescription_data"
        "message": message
    }
    
    return await manager.send_personal_message(notification, session_id)

async def notify_error(session_id: str, error_message: str):
    """
    에러 발생 시 알림
    """
    notification = {
        "type": "error",
        "session_id": session_id,
        "message": error_message
    }
    
    return await manager.send_personal_message(notification, session_id)

async def notify_timeout(session_id: str, timeout_message: str):
    """
    인증 타임아웃 발생 시 알림
    """
    notification = {
        "type": "auth_timeout",
        "session_id": session_id,
        "message": timeout_message,
        "timeout_seconds": 10,
        "retry_available": True
    }
    
    return await manager.send_personal_message(notification, session_id)

async def notify_streaming_status(session_id: str, status: str, message: str, data: dict = None):
    """실시간 스트리밍 상태 알림"""
    from datetime import datetime
    
    notification = {
        "type": "streaming_status",
        "session_id": session_id,
        "status": status,  # "auth_key_received", "auth_waiting", "data_collecting", "completed"
        "message": message,
        "timestamp": datetime.now().isoformat(),
        "data": data
    }
    
    success = await manager.send_personal_message(notification, session_id)
    if success:
        print(f"📡 [스트리밍] 세션 {session_id} 상태 알림: {status} - {message}")
    return success

async def notify_session_extended(session_id: str, extend_seconds: int):
    """세션 연장 알림"""
    from datetime import datetime
    
    notification = {
        "type": "session_extended",
        "session_id": session_id,
        "extend_seconds": extend_seconds,
        "message": f"세션이 {extend_seconds}초 연장되었습니다.",
        "timestamp": datetime.now().isoformat()
    }
    
    success = await manager.send_personal_message(notification, session_id)
    if success:
        print(f"⏰ [세션연장] 세션 {session_id} 연장 알림: {extend_seconds}초")
    return success

async def notify_tilko_key_received(session_id: str, cx_id: str):
    """틸코 키값 수신 시 즉시 스트리밍 시작"""
    await notify_streaming_status(
        session_id, 
        "auth_key_received", 
        "틸코 인증 키를 받았습니다. 모바일에서 인증을 진행해주세요.",
        {"cx_id": cx_id}
    )

async def notify_auth_waiting(session_id: str):
    """인증 대기 중 상태"""
    await notify_streaming_status(
        session_id,
        "auth_waiting",
        "카카오톡에서 인증을 진행해주세요. 인증 완료를 기다리고 있습니다..."
    )

async def notify_data_extracting(session_id: str, data_type: str):
    """데이터 추출 중 상태"""
    await notify_streaming_status(
        session_id,
        "data_collecting",
        f"{data_type} 데이터를 추출하고 있습니다..."
    )

async def notify_mediarc_completed(session_id: str, report_data: dict):
    """
    Mediarc 리포트 생성 완료 시 WebSocket으로 클라이언트에 알림
    
    Args:
        session_id: 세션 ID
        report_data: Mediarc 리포트 데이터 (bodyage, rank, disease_data, cancer_data 등)
    """
    message = {
        "type": "streaming_status",
        "session_id": session_id,
        "status": "mediarc_report_completed",
        "message": "질병예측 리포트가 생성되었습니다!",
        "data": {
            "bodyage": report_data.get("bodyage"),
            "rank": report_data.get("rank"),
            "has_questionnaire": report_data.get("has_questionnaire", False),
            "mkt_uuid": report_data.get("mkt_uuid"),
            "report_url": report_data.get("report_url")
        }
    }
    
    success = await manager.send_personal_message(message, session_id)
    if success:
        print(f"✅ [WebSocket] 세션 {session_id} Mediarc 완료 알림 전송됨")
    else:
        print(f"⚠️ [WebSocket] 세션 {session_id} 연결 없음 - Mediarc 알림 전송 실패")
    
    return success

async def notify_completion(session_id: str, collected_data: dict):
    """데이터 수집 완료"""
    # 🔍 전달되는 데이터 상태 로깅
    print(f"🔍 [WebSocket-notify_completion] 전달 데이터 확인:")
    print(f"   - collected_data 키: {list(collected_data.keys())}")
    health_data = collected_data.get("health_data")
    prescription_data = collected_data.get("prescription_data")
    
    if health_data:
        if isinstance(health_data, dict):
            result_list = health_data.get("ResultList")
            if result_list is None:
                print(f"   - ⚠️ health_data.ResultList가 None입니다!")
            elif isinstance(result_list, list):
                print(f"   - health_data.ResultList 길이: {len(result_list)}건")
            else:
                print(f"   - ⚠️ health_data.ResultList 타입: {type(result_list)}")
        else:
            print(f"   - ⚠️ health_data가 딕셔너리가 아님: {type(health_data)}")
    else:
        print(f"   - ⚠️ health_data가 None이거나 비어있습니다!")
    
    if prescription_data:
        if isinstance(prescription_data, dict):
            result_list = prescription_data.get("ResultList")
            if result_list is None:
                print(f"   - ⚠️ prescription_data.ResultList가 None입니다!")
            elif isinstance(result_list, list):
                print(f"   - prescription_data.ResultList 길이: {len(result_list)}건")
            else:
                print(f"   - ⚠️ prescription_data.ResultList 타입: {type(result_list)}")
        else:
            print(f"   - ⚠️ prescription_data가 딕셔너리가 아님: {type(prescription_data)}")
    else:
        print(f"   - ⚠️ prescription_data가 None이거나 비어있습니다!")
    
    await notify_streaming_status(
        session_id,
        "completed",
        "모든 데이터 수집이 완료되었습니다!",
        collected_data
    )

# 연결 상태 확인 API
@router.get("/ws/status")
async def websocket_status():
    """
    WebSocket 연결 상태 확인
    """
    return {
        "active_connections": manager.get_connection_count(),
        "connected_sessions": list(manager.active_connections.keys())
    }
