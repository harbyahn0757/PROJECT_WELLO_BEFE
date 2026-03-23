"""
Redis 기반 틸코 인증 세션 데이터 관리
"""
import json
import redis
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from uuid import uuid4
from ..core.config import settings

class RedisSessionManager:
    """Redis 기반 틸코 세션 데이터 관리자"""
    
    def __init__(self, redis_url: str = None):
        if redis_url is None:
            redis_url = settings.REDIS_URL if hasattr(settings, 'REDIS_URL') else "redis://10.0.1.10:6379/0"
        
        try:
            print(f"🔄 Redis 연결 시도: redis://10.0.1.10:6379/0")
            self.redis_client = redis.from_url(
                "redis://10.0.1.10:6379/0",
                decode_responses=True,
                socket_timeout=3,
                socket_connect_timeout=3,
                retry_on_timeout=False
            )
            # 연결 테스트
            self.redis_client.ping()
            print(f"✅ Redis 연결 성공: redis://10.0.1.10:6379/0")
        except Exception as e:
            print(f"❌ Redis 연결 실패: {e}")
            print("⚠️  파일 기반 세션 관리 사용")
            self.redis_client = None
    
    def _get_session_key(self, session_id: str) -> str:
        """Redis 키 생성"""
        return f"tilko_session:{session_id}"
    
    def _generate_secure_session_id(self, partner_id: str = "welno", user_uuid: str = None) -> str:
        """
        보안 강화된 세션 ID 생성
        
        Args:
            partner_id: 파트너 ID (세션 격리용)
            user_uuid: 사용자 UUID (충돌 방지용)
            
        Returns:
            str: 보안 강화된 세션 ID
        """
        # 1. 암호학적으로 안전한 랜덤 바이트 생성 (32바이트 = 256비트)
        random_bytes = secrets.token_bytes(32)
        
        # 2. 타임스탬프 추가 (재현 불가능성 보장)
        timestamp = str(datetime.now().timestamp()).encode('utf-8')
        
        # 3. 파트너 ID 추가 (파트너별 격리)
        partner_bytes = partner_id.encode('utf-8')
        
        # 4. 사용자 UUID 추가 (있는 경우)
        user_bytes = user_uuid.encode('utf-8') if user_uuid else b''
        
        # 5. 모든 요소를 결합하여 해시 생성
        combined = random_bytes + timestamp + partner_bytes + user_bytes
        session_hash = hashlib.sha256(combined).hexdigest()
        
        # 6. 파트너 접두사 추가 (세션 소유권 식별용)
        return f"{partner_id}_{session_hash[:32]}"
    
    def create_session(self, user_info: Dict[str, Any], partner_id: str = "welno") -> str:
        """새 세션 생성 (보안 강화)"""
        user_uuid = user_info.get('uuid') if isinstance(user_info, dict) else None
        session_id = self._generate_secure_session_id(partner_id=partner_id, user_uuid=user_uuid)
        
        session_data = {
            "session_id": session_id,
            "partner_id": partner_id,  # 파트너 ID 저장 (소유권 검증용)
            "user_info": user_info,
            "status": "initiated",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "expires_at": (datetime.now() + timedelta(minutes=10)).isoformat(),  # 10분 기본 (인증 대기 시간 충분히 확보)
            "last_activity": datetime.now().isoformat(),
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
    
    def get_session(self, session_id: str, requesting_partner_id: str = None) -> Optional[Dict[str, Any]]:
        """세션 데이터 조회 (보안 강화)"""
        # 파트너 소유권 검증 (요청한 파트너 ID가 있는 경우)
        if requesting_partner_id:
            if not self.verify_session_ownership(session_id, requesting_partner_id):
                print(f"⚠️ [세션 보안] 접근 거부: session={session_id[:20]}..., partner={requesting_partner_id}")
                return None
        
        if self.redis_client is None:
            # 파일 기반 폴백
            return self._get_session_from_file(session_id)
        
        try:
            session_key = self._get_session_key(session_id)
            session_json = self.redis_client.get(session_key)
            
            if session_json:
                session_data = json.loads(session_json)
                
                # 만료 시간 체크
                expires_at = datetime.fromisoformat(session_data["expires_at"])
                if datetime.now() > expires_at:
                    self.redis_client.delete(session_key)
                    return None
                
                return session_data
            return None
        except Exception:
            # Redis 실패시 조용히 파일 기반 폴백
            return self._get_session_from_file(session_id)
    
    def verify_session_ownership(self, session_id: str, partner_id: str) -> bool:
        """
        세션 소유권 검증 (보안 강화)
        
        Args:
            session_id: 검증할 세션 ID
            partner_id: 요청한 파트너 ID
            
        Returns:
            bool: 소유권 검증 결과
        """
        # 1. 세션 ID 형식 검증 (파트너 접두사 확인)
        if not session_id.startswith(f"{partner_id}_"):
            print(f"⚠️ [세션 보안] 잘못된 세션 ID 형식: {session_id[:20]}... (파트너: {partner_id})")
            return False
        
        # 2. 세션 데이터 조회
        session_data = self.get_session(session_id)
        if not session_data:
            print(f"⚠️ [세션 보안] 세션 데이터 없음: {session_id[:20]}...")
            return False
        
        # 3. 저장된 파트너 ID와 비교
        stored_partner_id = session_data.get('partner_id')
        if stored_partner_id != partner_id:
            print(f"⚠️ [세션 보안] 파트너 ID 불일치: 요청={partner_id}, 저장={stored_partner_id}")
            return False
        
        # 4. 세션 만료 시간 재확인
        expires_at = datetime.fromisoformat(session_data["expires_at"])
        if datetime.now() > expires_at:
            print(f"⚠️ [세션 보안] 만료된 세션: {session_id[:20]}...")
            return False
        
        return True
    
    def extract_partner_from_session_id(self, session_id: str) -> Optional[str]:
        """
        세션 ID에서 파트너 ID 추출
        
        Args:
            session_id: 세션 ID (형식: partner_id_hash)
            
        Returns:
            str: 파트너 ID 또는 None
        """
        if '_' in session_id:
            return session_id.split('_')[0]
        return None
    
    def _save_session(self, session_id: str, session_data: Dict[str, Any]) -> bool:
        """세션 데이터 저장"""
        if self.redis_client is None:
            # 파일 기반 폴백
            return self._save_session_to_file(session_id, session_data)
        
        try:
            session_key = self._get_session_key(session_id)
            session_json = json.dumps(session_data, ensure_ascii=False, indent=2)
            
            # 30분 TTL 설정 (1800초)
            self.redis_client.setex(session_key, 1800, session_json)
            return True
        except Exception:
            # Redis 실패시 조용히 파일 기반 폴백
            return self._save_session_to_file(session_id, session_data)
    
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
        
        return self._save_session(session_id, session_data)
    
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
        
        return self._save_session(session_id, session_data)
    
    def update_health_data(self, session_id: str, health_data: Dict[str, Any]) -> bool:
        """건강검진 데이터 업데이트"""
        session_data = self.get_session(session_id)
        if not session_data:
            return False
        
        # JSON 파일로 저장 (데이터 확인용)
        self._save_data_to_json_file(session_id, "health_data", health_data)
        
        session_data["health_data"] = health_data
        session_data["progress"]["health_data_fetched"] = True
        session_data["updated_at"] = datetime.now().isoformat()
        session_data["messages"].append({
            "timestamp": datetime.now().isoformat(),
            "type": "success",
            "message": "건강검진 데이터를 성공적으로 가져왔습니다."
        })
        
        return self._save_session(session_id, session_data)
    
    def update_prescription_data(self, session_id: str, prescription_data: Dict[str, Any]) -> bool:
        """처방전 데이터 업데이트"""
        session_data = self.get_session(session_id)
        if not session_data:
            return False
        
        # JSON 파일로 저장 (데이터 확인용)
        self._save_data_to_json_file(session_id, "prescription_data", prescription_data)
        
        session_data["prescription_data"] = prescription_data
        session_data["progress"]["prescription_data_fetched"] = True
        session_data["updated_at"] = datetime.now().isoformat()
        session_data["messages"].append({
            "timestamp": datetime.now().isoformat(),
            "type": "success",
            "message": "처방전 데이터를 성공적으로 가져왔습니다."
        })
        
        return self._save_session(session_id, session_data)
    
    def complete_session(self, session_id: str) -> bool:
        """세션 완료 처리"""
        session_data = self.get_session(session_id)
        if not session_data:
            return False
        
        session_data["progress"]["completed"] = True
        session_data["status"] = "completed"
        session_data["updated_at"] = datetime.now().isoformat()
        session_data["messages"].append({
            "timestamp": datetime.now().isoformat(),
            "type": "success",
            "message": "모든 데이터 수집이 완료되었습니다."
        })
        
        return self._save_session(session_id, session_data)
    
    def add_error_message(self, session_id: str, error_message: str) -> bool:
        """에러 메시지 추가"""
        session_data = self.get_session(session_id)
        if not session_data:
            return False
        
        session_data["messages"].append({
            "timestamp": datetime.now().isoformat(),
            "type": "error",
            "message": error_message
        })
        session_data["updated_at"] = datetime.now().isoformat()
        
        return self._save_session(session_id, session_data)
    
    def delete_session(self, session_id: str) -> bool:
        """세션 삭제"""
        if self.redis_client is None:
            return self._delete_session_file(session_id)
        
        try:
            session_key = self._get_session_key(session_id)
            result = self.redis_client.delete(session_key)
            return result > 0
        except Exception:
            # Redis 실패시 조용히 파일 기반 폴백
            return self._delete_session_file(session_id)
    
    def cleanup_expired_sessions(self) -> int:
        """만료된 세션 정리 (Redis는 TTL로 자동 처리)"""
        if self.redis_client is None:
            return self._cleanup_expired_files()
        
        # Redis는 TTL로 자동 만료되므로 별도 정리 불필요
        return 0
    
    def force_cleanup_user_sessions(self, user_name: str) -> int:
        """특정 사용자의 모든 세션 강제 정리"""
        cleaned_count = 0
        
        try:
            if self.redis_client is not None:
                # Redis에서 사용자 세션 찾기
                pattern = "tilko_session:*"
                session_keys = self.redis_client.keys(pattern)
                
                for session_key in session_keys:
                    try:
                        session_data_str = self.redis_client.get(session_key)
                        if session_data_str:
                            session_data = json.loads(session_data_str)
                            user_info = session_data.get("user_info", {})
                            if user_info.get("name") == user_name:
                                self.redis_client.delete(session_key)
                                cleaned_count += 1
                    except Exception:
                        continue
            else:
                # 파일 기반 폴백
                cleaned_count = self._force_cleanup_user_files(user_name)
                
        except Exception as e:
            print(f"❌ 사용자 세션 정리 실패: {e}")
            
        return cleaned_count
    
    # 파일 기반 폴백 메서드들
    def _get_session_from_file(self, session_id: str) -> Optional[Dict[str, Any]]:
        """파일에서 세션 데이터 조회 (폴백)"""
        try:
            import os
            data_dir = "data/tilko_sessions"
            file_path = os.path.join(data_dir, f"{session_id}.json")
            
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    session_data = json.load(f)
                
                # 만료 시간 체크
                expires_at = datetime.fromisoformat(session_data["expires_at"])
                if datetime.now() > expires_at:
                    os.remove(file_path)
                    return None
                
                return session_data
            return None
        except Exception as e:
            print(f"❌ 파일 세션 조회 실패: {e}")
            return None
    
    def _save_session_to_file(self, session_id: str, session_data: Dict[str, Any]) -> bool:
        """파일에 세션 데이터 저장 (폴백)"""
        try:
            import os
            data_dir = "data/tilko_sessions"
            if not os.path.exists(data_dir):
                os.makedirs(data_dir)
            
            file_path = os.path.join(data_dir, f"{session_id}.json")
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(session_data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"❌ 파일 세션 저장 실패: {e}")
            return False
    
    def _delete_session_file(self, session_id: str) -> bool:
        """파일 세션 삭제 (폴백)"""
        try:
            import os
            data_dir = "data/tilko_sessions"
            file_path = os.path.join(data_dir, f"{session_id}.json")
            if os.path.exists(file_path):
                os.remove(file_path)
                return True
            return False
        except Exception as e:
            print(f"❌ 파일 세션 삭제 실패: {e}")
            return False
    
    def _cleanup_expired_files(self) -> int:
        """만료된 파일 세션 정리 (폴백)"""
        try:
            import os
            data_dir = "data/tilko_sessions"
            if not os.path.exists(data_dir):
                return 0
            
            cleaned_count = 0
            for filename in os.listdir(data_dir):
                if filename.endswith('.json'):
                    session_id = filename[:-5]  # .json 제거
                    session_data = self._get_session_from_file(session_id)
                    if session_data is None:  # 만료된 세션은 이미 삭제됨
                        cleaned_count += 1
            
            return cleaned_count
        except Exception as e:
            print(f"❌ 파일 세션 정리 실패: {e}")
            return 0
    
    async def start_auto_cleanup(self, cleanup_interval_minutes: int = 30):
        """자동 세션 정리 시작"""
        import asyncio
        
        async def cleanup_task():
            while True:
                try:
                    cleaned_count = self.cleanup_expired_sessions()
                    if cleaned_count > 0:
                        print(f"🧹 만료된 세션 {cleaned_count}개 정리 완료")
                    await asyncio.sleep(cleanup_interval_minutes * 60)  # 분을 초로 변환
                except Exception as e:
                    print(f"❌ 자동 세션 정리 중 오류: {e}")
                    await asyncio.sleep(60)  # 에러 시 1분 후 재시도
        
        # 백그라운드 태스크로 실행
        asyncio.create_task(cleanup_task())
        print(f"✅ 자동 세션 정리 시작 (간격: {cleanup_interval_minutes}분)")
    
    def _force_cleanup_user_files(self, user_name: str) -> int:
        """특정 사용자의 파일 세션 강제 정리 (폴백)"""
        try:
            import os
            data_dir = "data/tilko_sessions"
            if not os.path.exists(data_dir):
                return 0
            
            cleaned_count = 0
            for filename in os.listdir(data_dir):
                if filename.endswith('.json'):
                    session_id = filename[:-5]  # .json 제거
                    try:
                        session_data = self._get_session_from_file(session_id)
                        if session_data:
                            user_info = session_data.get("user_info", {})
                            if user_info.get("name") == user_name:
                                file_path = os.path.join(data_dir, filename)
                                os.remove(file_path)
                                cleaned_count += 1
                    except Exception:
                        continue
            
            return cleaned_count
        except Exception as e:
            print(f"❌ 사용자 파일 세션 정리 실패: {e}")
            return 0
    
    def _save_data_to_json_file(self, session_id: str, data_type: str, data: Dict[str, Any]) -> bool:
        """틸코 데이터를 JSON 파일로 저장 (데이터 확인용)"""
        try:
            import os
            import json
            from datetime import datetime
            
            # 저장 디렉토리 생성
            data_dir = "/home/welno/workspace/PROJECT_WELNO_BEFE/tilko_data"
            os.makedirs(data_dir, exist_ok=True)
            
            # 파일명: session_id_data_type_timestamp.json
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{session_id}_{data_type}_{timestamp}.json"
            file_path = os.path.join(data_dir, filename)
            
            # 메타데이터 포함하여 저장
            save_data = {
                "session_id": session_id,
                "data_type": data_type,
                "timestamp": datetime.now().isoformat(),
                "raw_data": data
            }
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(save_data, f, ensure_ascii=False, indent=2)
            
            print(f"✅ [데이터저장] {data_type} 데이터를 JSON 파일로 저장: {filename}")
            return True
            
        except Exception as e:
            print(f"❌ [데이터저장] JSON 파일 저장 실패: {e}")
            return False
    
    def extend_session(self, session_id: str, extend_seconds: int = 300) -> bool:
        """세션 연장 - 활동이 있을 때마다 5분씩 연장 (기본값: 300초)"""
        session_data = self.get_session(session_id)
        if not session_data:
            return False
        
        now = datetime.now()
        session_data["last_activity"] = now.isoformat()
        session_data["expires_at"] = (now + timedelta(seconds=extend_seconds)).isoformat()
        session_data["updated_at"] = now.isoformat()
        
        print(f"🔄 [세션연장] 세션 {session_id} - {extend_seconds}초 연장 (만료시각: {session_data['expires_at']})")
        
        return self._save_session(session_id, session_data)
    
    def is_session_expired(self, session_id: str) -> bool:
        """세션 만료 여부 확인"""
        session_data = self.get_session(session_id)
        if not session_data:
            return True
        
        expires_at = datetime.fromisoformat(session_data.get("expires_at", ""))
        is_expired = datetime.now() > expires_at
        
        if is_expired:
            print(f"⏰ [세션만료] 세션 {session_id} 만료됨")
        
        return is_expired

# Redis 세션 매니저 인스턴스 생성
redis_session_manager = RedisSessionManager()
