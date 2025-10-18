"""
세션 서비스
"""
from typing import Optional
from datetime import datetime, timedelta
from ..models.entities import UserSession
from ..repositories.interfaces import IUserSessionRepository
from .exceptions import ServiceException


class SessionService:
    """사용자 세션 관리 서비스"""
    
    def __init__(self, session_repository: IUserSessionRepository):
        self.session_repository = session_repository
    
    def create_session(self, user_id: str, session_data: dict) -> UserSession:
        """새 세션 생성"""
        session = UserSession(
            session_id=f"session_{user_id}_{datetime.now().timestamp()}",
            user_id=user_id,
            created_at=datetime.now(),
            expires_at=datetime.now() + timedelta(minutes=1),
            data=session_data,
            is_active=True
        )
        return self.session_repository.create(session)
    
    def get_session(self, session_id: str) -> Optional[UserSession]:
        """세션 조회"""
        return self.session_repository.get_by_id(session_id)
    
    def is_session_valid(self, session_id: str) -> bool:
        """세션 유효성 검사"""
        session = self.get_session(session_id)
        if not session:
            return False
        
        if not session.is_active:
            return False
        
        if session.expires_at < datetime.now():
            self.invalidate_session(session_id)
            return False
        
        return True
    
    def invalidate_session(self, session_id: str) -> bool:
        """세션 무효화"""
        session = self.get_session(session_id)
        if session:
            session.is_active = False
            self.session_repository.update(session)
            return True
        return False

