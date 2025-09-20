"""
틸코 인증 세션 데이터 관리
"""
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from uuid import uuid4
import asyncio
from threading import Lock

class TilkoSessionManager:
    """틸코 세션 데이터 관리자"""
    
    def __init__(self, data_dir: str = "data/tilko_sessions"):
        self.data_dir = data_dir
        self.ensure_data_dir()
        self._lock = Lock()  # 동시성 제어
        self._cleanup_task = None  # 자동 정리 태스크
    
    def ensure_data_dir(self):
        """데이터 디렉토리 생성"""
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
    
    def create_session(self, user_info: Dict[str, Any]) -> str:
        """새 세션 생성"""
        session_id = str(uuid4())
        session_data = {
            "session_id": session_id,
            "user_info": user_info,
            "status": "initiated",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "expires_at": (datetime.now() + timedelta(hours=1)).isoformat(),
            "auth_data": None,
            "health_data": None,
            "prescription_data": None,
            "progress": {
                "auth_requested": False,
                "auth_completed": False,
                "health_data_fetched": False,
                "prescription_data_fetched": False,
                "completed": False
            },
            "messages": [
                {
                    "timestamp": datetime.now().isoformat(),
                    "type": "info",
                    "message": f"{user_info.get('name', '사용자')}님의 인증 세션이 시작되었습니다."
                }
            ]
        }
        
        self._save_session(session_id, session_data)
        return session_id
    
    def update_session_status(self, session_id: str, status: str, message: str = None) -> bool:
        """세션 상태 업데이트"""
        session_data = self.get_session(session_id)
        if not session_data:
            return False
        
        session_data["status"] = status
        session_data["updated_at"] = datetime.now().isoformat()
        
        if message:
            session_data["messages"].append({
                "timestamp": datetime.now().isoformat(),
                "type": "info",
                "message": message
            })
        
        self._save_session(session_id, session_data)
        return True
    
    def update_auth_data(self, session_id: str, auth_data: Dict[str, Any]) -> bool:
        """인증 데이터 업데이트"""
        session_data = self.get_session(session_id)
        if not session_data:
            return False
        
        session_data["auth_data"] = auth_data
        session_data["progress"]["auth_completed"] = True
        session_data["status"] = "authenticated"
        session_data["updated_at"] = datetime.now().isoformat()
        session_data["messages"].append({
            "timestamp": datetime.now().isoformat(),
            "type": "success",
            "message": "카카오톡 인증이 완료되었습니다. 건강정보를 가져오는 중입니다..."
        })
        
        self._save_session(session_id, session_data)
        return True
    
    def update_health_data(self, session_id: str, health_data: Dict[str, Any]) -> bool:
        """건강검진 데이터 업데이트"""
        session_data = self.get_session(session_id)
        if not session_data:
            return False
        
        session_data["health_data"] = health_data
        session_data["progress"]["health_data_fetched"] = True
        session_data["status"] = "health_data_loaded"
        session_data["updated_at"] = datetime.now().isoformat()
        session_data["messages"].append({
            "timestamp": datetime.now().isoformat(),
            "type": "success",
            "message": "건강검진 데이터를 성공적으로 가져왔습니다."
        })
        
        self._save_session(session_id, session_data)
        return True
    
    def update_prescription_data(self, session_id: str, prescription_data: Dict[str, Any]) -> bool:
        """처방전 데이터 업데이트"""
        session_data = self.get_session(session_id)
        if not session_data:
            return False
        
        session_data["prescription_data"] = prescription_data
        session_data["progress"]["prescription_data_fetched"] = True
        session_data["status"] = "prescription_data_loaded"
        session_data["updated_at"] = datetime.now().isoformat()
        session_data["messages"].append({
            "timestamp": datetime.now().isoformat(),
            "type": "success",
            "message": "처방전 데이터를 성공적으로 가져왔습니다."
        })
        
        self._save_session(session_id, session_data)
        return True
    
    def complete_session(self, session_id: str) -> bool:
        """세션 완료"""
        session_data = self.get_session(session_id)
        if not session_data:
            return False
        
        session_data["progress"]["completed"] = True
        session_data["status"] = "completed"
        session_data["updated_at"] = datetime.now().isoformat()
        session_data["messages"].append({
            "timestamp": datetime.now().isoformat(),
            "type": "success",
            "message": "모든 건강정보 동기화가 완료되었습니다!"
        })
        
        self._save_session(session_id, session_data)
        return True
    
    def add_error_message(self, session_id: str, error_message: str) -> bool:
        """에러 메시지 추가"""
        session_data = self.get_session(session_id)
        if not session_data:
            return False
        
        session_data["status"] = "error"
        session_data["updated_at"] = datetime.now().isoformat()
        session_data["messages"].append({
            "timestamp": datetime.now().isoformat(),
            "type": "error",
            "message": error_message
        })
        
        self._save_session(session_id, session_data)
        return True
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """세션 데이터 조회"""
        try:
            file_path = os.path.join(self.data_dir, f"{session_id}.json")
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return None
        except Exception:
            return None
    
    def get_session_status(self, session_id: str) -> Optional[Dict[str, Any]]:
        """세션 상태만 조회 (간단한 정보)"""
        session_data = self.get_session(session_id)
        if not session_data:
            return None
        
        return {
            "session_id": session_data["session_id"],
            "status": session_data["status"],
            "progress": session_data["progress"],
            "latest_message": session_data["messages"][-1] if session_data["messages"] else None,
            "updated_at": session_data["updated_at"],
            "user_info": session_data.get("user_info"),
            "created_at": session_data.get("created_at")
        }
    
    def _save_session(self, session_id: str, session_data: Dict[str, Any]):
        """세션 데이터 저장 (동시성 제어)"""
        with self._lock:
            try:
                file_path = os.path.join(self.data_dir, f"{session_id}.json")
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(session_data, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"❌ [세션저장] 실패: {e}")
    
    def cleanup_expired_sessions(self) -> int:
        """만료된 세션 정리"""
        cleaned_count = 0
        with self._lock:
            try:
                current_time = datetime.now()
                for filename in os.listdir(self.data_dir):
                    if filename.endswith('.json'):
                        session_id = filename[:-5]  # .json 제거
                        session_data = self.get_session(session_id)
                        if session_data:
                            expires_at = datetime.fromisoformat(session_data["expires_at"])
                            # 만료된 세션 또는 3시간 이상 된 error/completed 세션 정리
                            if (current_time > expires_at or 
                                (session_data["status"] in ["error", "completed"] and 
                                 (current_time - datetime.fromisoformat(session_data["updated_at"])).total_seconds() > 10800)):  # 3시간
                                os.remove(os.path.join(self.data_dir, filename))
                                cleaned_count += 1
                                print(f"🧹 [세션정리] 만료된 세션 삭제: {session_id}")
            except Exception as e:
                print(f"❌ [세션정리] 실패: {e}")
        return cleaned_count
    
    async def start_auto_cleanup(self, interval_minutes: int = 30):
        """자동 세션 정리 시작"""
        if self._cleanup_task and not self._cleanup_task.done():
            return
            
        async def cleanup_loop():
            while True:
                try:
                    await asyncio.sleep(interval_minutes * 60)
                    cleaned = self.cleanup_expired_sessions()
                    if cleaned > 0:
                        print(f"🧹 [자동정리] {cleaned}개 세션 정리 완료")
                except Exception as e:
                    print(f"❌ [자동정리] 오류: {e}")
        
        self._cleanup_task = asyncio.create_task(cleanup_loop())
        print(f"🚀 [세션관리] 자동 정리 시작 ({interval_minutes}분 간격)")
    
    def force_cleanup_user_sessions(self, user_name: str) -> int:
        """특정 사용자의 모든 세션 정리"""
        cleaned_count = 0
        with self._lock:
            try:
                for filename in os.listdir(self.data_dir):
                    if filename.endswith('.json'):
                        session_id = filename[:-5]
                        session_data = self.get_session(session_id)
                        if (session_data and 
                            session_data.get("user_info", {}).get("name") == user_name):
                            os.remove(os.path.join(self.data_dir, filename))
                            cleaned_count += 1
                            print(f"🧹 [사용자정리] {user_name}의 세션 삭제: {session_id}")
            except Exception as e:
                print(f"❌ [사용자정리] 실패: {e}")
        return cleaned_count

# 전역 세션 매니저 인스턴스
session_manager = TilkoSessionManager()
