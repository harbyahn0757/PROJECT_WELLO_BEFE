"""
서비스 계층 예외 정의

비즈니스 로직에서 발생하는 예외들을 정의합니다.
"""


class ServiceError(Exception):
    """서비스 계층 기본 예외"""
    pass


class ServiceException(ServiceError):
    """서비스 예외 (ServiceError 별칭)"""
    pass


class PatientNotFoundError(ServiceError):
    """환자를 찾을 수 없는 경우"""
    pass


class InvalidPatientDataError(ServiceError):
    """환자 데이터가 올바르지 않은 경우"""
    pass


class HospitalNotFoundError(ServiceError):
    """병원을 찾을 수 없는 경우"""
    pass


class InvalidHospitalDataError(ServiceError):
    """병원 데이터가 올바르지 않은 경우"""
    pass


class SessionNotFoundError(ServiceError):
    """세션을 찾을 수 없는 경우"""
    pass


class SessionExpiredError(ServiceError):
    """세션이 만료된 경우"""
    pass


class InvalidSessionDataError(ServiceError):
    """세션 데이터가 올바르지 않은 경우"""
    pass


class CheckupDesignError(ServiceError):
    """검진 설계 관련 오류"""
    pass


class GPTServiceError(ServiceError):
    """GPT 서비스 관련 오류"""
    pass


class AnalyticsError(ServiceError):
    """분석 서비스 관련 오류"""
    pass


class AuthenticationError(ServiceError):
    """인증 관련 오류"""
    pass


class AuthorizationError(ServiceError):
    """권한 관련 오류"""
    pass
