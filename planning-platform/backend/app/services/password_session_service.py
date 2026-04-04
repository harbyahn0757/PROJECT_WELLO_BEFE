import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from ..core.config import settings

class PasswordSessionService:
    """비밀번호 세션 관리 서비스"""
    
    def __init__(self):
        # 동기 SQLAlchemy 엔진 사용 (간단함)
        self.database_url = f"postgresql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
        self.engine = create_engine(self.database_url, echo=False)
        self.session_maker = sessionmaker(bind=self.engine)
        self.session_duration_minutes = 5  # 5분 유효
    
    def generate_session_token(self) -> str:
        """안전한 세션 토큰 생성"""
        return secrets.token_urlsafe(32)
    
    def hash_device_fingerprint(self, fingerprint: str) -> str:
        """디바이스 핑거프린트 해싱"""
        return hashlib.sha256(fingerprint.encode()).hexdigest()[:32]
    
    async def create_session(self, patient_uuid: str, hospital_id: str, device_fingerprint: str) -> Dict[str, Any]:
        """새 세션 생성"""
        try:
            with self.session_maker() as session:
                # 기존 세션 정리 (같은 디바이스)
                self._cleanup_device_sessions(session, patient_uuid, hospital_id, device_fingerprint)
                
                # 새 세션 생성
                session_token = self.generate_session_token()
                hashed_fingerprint = self.hash_device_fingerprint(device_fingerprint)
                expires_at = datetime.now() + timedelta(minutes=self.session_duration_minutes)
                
                insert_query = text("""
                    INSERT INTO welno.welno_password_sessions 
                    (patient_uuid, hospital_id, session_token, device_fingerprint, expires_at)
                    VALUES (:patient_uuid, :hospital_id, :session_token, :device_fingerprint, :expires_at)
                """)
                
                session.execute(insert_query, {
                    "patient_uuid": patient_uuid,
                    "hospital_id": hospital_id,
                    "session_token": session_token,
                    "device_fingerprint": hashed_fingerprint,
                    "expires_at": expires_at
                })
                
                session.commit()
                
                print(f"✅ [세션] 생성 완료 - UUID: {patient_uuid}, 토큰: {session_token[:8]}..., 만료: {expires_at}")
                
                return {
                    "success": True,
                    "session_token": session_token,
                    "expires_at": expires_at.isoformat(),
                    "duration_minutes": self.session_duration_minutes
                }
                
        except Exception as e:
            print(f"❌ [세션] 생성 실패: {e}")
            return {"success": False, "error": str(e)}
    
    async def verify_session(self, session_token: str, device_fingerprint: str) -> Dict[str, Any]:
        """세션 유효성 확인"""
        try:
            with self.session_maker() as session:
                hashed_fingerprint = self.hash_device_fingerprint(device_fingerprint)
                
                query = text("""
                    SELECT patient_uuid, hospital_id, expires_at, last_used_at
                    FROM welno.welno_password_sessions 
                    WHERE session_token = :session_token AND device_fingerprint = :device_fingerprint
                """)
                
                result = session.execute(query, {
                    "session_token": session_token,
                    "device_fingerprint": hashed_fingerprint
                })
                
                row = result.fetchone()
                
                if not row:
                    print(f"❌ [세션] 토큰 없음: {session_token[:8]}...")
                    return {"success": False, "message": "유효하지 않은 세션입니다."}
                
                # 만료 확인 (timezone 안전 비교)
                now = datetime.now()
                expires_at = row.expires_at
                
                # 두 시간을 모두 naive datetime으로 통일
                if expires_at.tzinfo is not None:
                    expires_at = expires_at.replace(tzinfo=None)
                if now.tzinfo is not None:
                    now = now.replace(tzinfo=None)
                
                print(f"🕐 [세션] 시간 비교 - 현재: {now}, 만료: {expires_at}")
                
                if now > expires_at:
                    # 만료된 세션 삭제
                    delete_query = text("DELETE FROM welno.welno_password_sessions WHERE session_token = :session_token")
                    session.execute(delete_query, {"session_token": session_token})
                    session.commit()
                    print(f"⏰ [세션] 만료됨: {session_token[:8]}...")
                    return {"success": False, "message": "세션이 만료되었습니다."}
                
                # 마지막 사용 시간 업데이트
                update_query = text("UPDATE welno.welno_password_sessions SET last_used_at = NOW() WHERE session_token = :session_token")
                session.execute(update_query, {"session_token": session_token})
                session.commit()
                
                print(f"✅ [세션] 유효 확인 - UUID: {row.patient_uuid}, 토큰: {session_token[:8]}...")
                
                return {
                    "success": True,
                    "patient_uuid": row.patient_uuid,
                    "hospital_id": row.hospital_id,
                    "expires_at": row.expires_at.isoformat()
                }
                
        except Exception as e:
            print(f"❌ [세션] 확인 실패: {e}")
            return {"success": False, "error": str(e)}
    
    async def refresh_session(self, session_token: str, device_fingerprint: str) -> Dict[str, Any]:
        """세션 만료 시간 연장 (활동 감지 시 호출)"""
        try:
            with self.session_maker() as session:
                hashed_fingerprint = self.hash_device_fingerprint(device_fingerprint)

                query = text("""
                    UPDATE welno.welno_password_sessions
                    SET expires_at = NOW() + INTERVAL ':minutes minutes',
                        last_used_at = NOW()
                    WHERE session_token = :session_token
                      AND device_fingerprint = :device_fingerprint
                      AND expires_at > NOW()
                    RETURNING patient_uuid, hospital_id, expires_at
                """.replace(':minutes', str(self.session_duration_minutes)))

                result = session.execute(query, {
                    "session_token": session_token,
                    "device_fingerprint": hashed_fingerprint
                })

                row = result.fetchone()
                session.commit()

                if not row:
                    return {"success": False, "message": "세션이 없거나 만료되었습니다."}

                print(f"🔄 [세션] 갱신 완료 - 토큰: {session_token[:8]}..., 새 만료: {row.expires_at}")

                return {
                    "success": True,
                    "expires_at": row.expires_at.isoformat(),
                    "duration_minutes": self.session_duration_minutes
                }

        except Exception as e:
            print(f"❌ [세션] 갱신 실패: {e}")
            return {"success": False, "error": str(e)}

    async def invalidate_session(self, session_token: str) -> bool:
        """세션 무효화"""
        try:
            with self.session_maker() as session:
                delete_query = text("DELETE FROM welno.welno_password_sessions WHERE session_token = :session_token")
                result = session.execute(delete_query, {"session_token": session_token})
                session.commit()
                
                success = result.rowcount > 0
                if success:
                    print(f"✅ [세션] 무효화 완료: {session_token[:8]}...")
                else:
                    print(f"⚠️ [세션] 무효화 대상 없음: {session_token[:8]}...")
                
                return success
                
        except Exception as e:
            print(f"❌ [세션] 무효화 실패: {e}")
            return False
    
    async def cleanup_expired_sessions(self) -> int:
        """만료된 세션 정리"""
        try:
            with self.session_maker() as session:
                delete_query = text("DELETE FROM welno.welno_password_sessions WHERE expires_at < NOW()")
                result = session.execute(delete_query)
                session.commit()
                
                deleted_count = result.rowcount
                
                if deleted_count > 0:
                    print(f"🧹 [세션] 만료된 세션 {deleted_count}개 정리 완료")
                
                return deleted_count
                
        except Exception as e:
            print(f"❌ [세션] 정리 실패: {e}")
            return 0
    
    def _cleanup_device_sessions(self, session, patient_uuid: str, hospital_id: str, device_fingerprint: str):
        """특정 디바이스의 기존 세션 정리"""
        hashed_fingerprint = self.hash_device_fingerprint(device_fingerprint)
        
        delete_query = text("""DELETE FROM welno.welno_password_sessions 
           WHERE patient_uuid = :patient_uuid AND hospital_id = :hospital_id AND device_fingerprint = :device_fingerprint""")
        
        result = session.execute(delete_query, {
            "patient_uuid": patient_uuid,
            "hospital_id": hospital_id,
            "device_fingerprint": hashed_fingerprint
        })
        
        if result.rowcount > 0:
            print(f"🧹 [세션] 기존 디바이스 세션 {result.rowcount}개 정리: {patient_uuid}")
    
    async def get_active_sessions(self, patient_uuid: str, hospital_id: str) -> Dict[str, Any]:
        """활성 세션 목록 조회"""
        try:
            with self.session_maker() as session:
                query = text("""
                    SELECT session_token, device_fingerprint, created_at, last_used_at, expires_at
                    FROM welno.welno_password_sessions 
                    WHERE patient_uuid = :patient_uuid AND hospital_id = :hospital_id AND expires_at > NOW()
                    ORDER BY last_used_at DESC
                """)
                
                result = session.execute(query, {
                    "patient_uuid": patient_uuid,
                    "hospital_id": hospital_id
                })
                
                sessions = []
                for row in result:
                    sessions.append({
                        "session_token": row.session_token[:8] + "...",  # 보안상 일부만 표시
                        "device_fingerprint": row.device_fingerprint[:8] + "...",
                        "created_at": row.created_at.isoformat(),
                        "last_used_at": row.last_used_at.isoformat(),
                        "expires_at": row.expires_at.isoformat()
                    })
                
                return {
                    "success": True,
                    "sessions": sessions,
                    "count": len(sessions)
                }
                
        except Exception as e:
            print(f"❌ [세션] 목록 조회 실패: {e}")
            return {"success": False, "error": str(e)}