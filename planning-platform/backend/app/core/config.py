"""
건강검진 관리 시스템 설정

환경변수 및 시스템 설정을 관리합니다.
"""

from typing import List, Optional
from pydantic import Field, BaseModel
from pydantic_settings import BaseSettings
from pathlib import Path

class ServerSettings(BaseModel):
    """서버 관련 설정"""
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8082, env="PORT")
    debug: bool = Field(default=False, env="DEBUG")
    environment: str = Field(default="production", env="ENVIRONMENT")
    api_version: str = Field(default="v1", env="API_VERSION")
    api_prefix: str = Field(default="/api/v1", env="API_PREFIX")

class SecuritySettings(BaseModel):
    """보안 관련 설정"""
    secret_key: str = Field(default="dev-secret-key-for-testing-only-change-in-production", env="SECRET_KEY")
    jwt_secret_key: str = Field(default="dev-jwt-secret-key-for-testing-only", env="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", env="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=20, env="ACCESS_TOKEN_EXPIRE_MINUTES")

class CORSSettings(BaseModel):
    """CORS 관련 설정"""
    allowed_origins: str = Field(default="http://localhost:9283", env="CORS_ALLOWED_ORIGINS")
    allowed_methods: List[str] = Field(default=["*"], env="CORS_ALLOWED_METHODS")
    allowed_headers: List[str] = Field(default=["*"], env="CORS_ALLOWED_HEADERS")

class DatabaseSettings(BaseModel):
    """데이터베이스 설정"""
    host: str = Field(default="localhost", env="DB_HOST")
    port: int = Field(default=5432, env="DB_PORT")
    name: str = Field(default="health_check_db", env="DB_NAME")
    user: str = Field(default="admin", env="DB_USER")
    password: str = Field(default="dev_password", env="DB_PASSWORD")

class RedisSettings(BaseModel):
    """Redis 설정"""
    url: str = Field(default="redis://localhost:6379/0", env="REDIS_URL")
    password: Optional[str] = Field(None, env="REDIS_PASSWORD")

class OpenAISettings(BaseModel):
    """OpenAI GPT 설정"""
    api_key: str = Field(default="dev-openai-key", env="OPENAI_API_KEY")
    model: str = Field(default="gpt-4", env="GPT_MODEL")
    max_tokens: int = Field(default=2000, env="MAX_TOKENS")

class LlamaIndexSettings(BaseModel):
    """LlamaIndex RAG 벡터 설정"""
    api_key: str = Field(default="dev-llamaindex-key", env="LLAMAINDEX_API_KEY")

class GoogleAnalyticsSettings(BaseModel):
    """Google Analytics 설정"""
    tracking_id: str = Field(default="dev-ga-tracking-id", env="GA_TRACKING_ID")
    measurement_id: str = Field(default="dev-ga-measurement-id", env="GA_MEASUREMENT_ID")

class CheckupSettings(BaseModel):
    """검진 관련 설정"""
    min_age: int = Field(default=19, env="MIN_CHECKUP_AGE")
    max_age: int = Field(default=120, env="MAX_CHECKUP_AGE")
    default_duration: int = Field(default=120, env="DEFAULT_CHECKUP_DURATION_MINUTES")

class NotificationSettings(BaseModel):
    """알림 관련 설정"""
    sender_email: str = Field(default="no-reply@healthcheck.com", env="NOTIFICATION_SENDER")
    sms_number: str = Field(default="15881234", env="SMS_SENDER_NUMBER")

class FileSettings(BaseModel):
    """파일 업로드 설정"""
    max_size: int = Field(default=10485760, env="MAX_UPLOAD_SIZE")  # 10MB
    allowed_types: List[str] = Field(
        default=["image/jpeg", "image/png", "application/pdf"],
        env="ALLOWED_FILE_TYPES"
    )
    upload_path: str = Field(default="/uploads", env="UPLOAD_PATH")

class LogSettings(BaseModel):
    """로깅 설정"""
    level: str = Field(default="info", env="LOG_LEVEL")
    format: str = Field(default="json", env="LOG_FORMAT")
    path: str = Field(default="/var/log/healthcheck", env="LOG_PATH")

class Settings(BaseSettings):
    """통합 설정"""
    # 서버 설정
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8082, env="PORT")
    debug: bool = Field(default=False, env="DEBUG")
    
    # 보안 설정
    secret_key: str = Field(default="dev-secret-key", env="SECRET_KEY")
    jwt_secret_key: str = Field(default="dev-jwt-secret-key", env="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", env="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=20, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    
    # CORS 설정
    cors_allowed_origins: str = Field(default="http://localhost:9281", env="CORS_ALLOWED_ORIGINS")
    
    # 데이터베이스 설정
    DB_HOST: str = Field(default="localhost", env="DB_HOST")
    DB_PORT: int = Field(default=5432, env="DB_PORT")
    DB_NAME: str = Field(default="health_check_db", env="DB_NAME")
    DB_USER: str = Field(default="admin", env="DB_USER")
    DB_PASSWORD: str = Field(default="dev_password", env="DB_PASSWORD")
    
    # OpenAI 설정
    openai_api_key: str = Field(default="dev-openai-key", env="OPENAI_API_KEY")
    openai_fast_model: str = Field(default="gpt-4o-mini", env="OPENAI_FAST_MODEL")  # STEP 1용 빠른 모델
    openai_model: str = Field(default="gpt-4o", env="OPENAI_MODEL")  # STEP 2용 강력한 모델
    
    # LlamaIndex 설정 (RAG 벡터 제공용)
    llamaindex_api_key: str = Field(default="dev-llamaindex-key", env="LLAMAINDEX_API_KEY")
    
    # Google Gemini 설정 (RAG용)
    google_gemini_api_key: str = Field(default="dev-gemini-key", env="GOOGLE_GEMINI_API_KEY")
    google_gemini_fast_model: str = Field(default="gemini-2.0-flash", env="GOOGLE_GEMINI_FAST_MODEL") # STEP 1용 빠른 모델
    google_gemini_model: str = Field(default="gemini-2.0-flash", env="GOOGLE_GEMINI_MODEL") # STEP 2용 강력한 모델
    
    model_config = {
        "env_file": [".env.local", "config.env", ".env"],
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore"
    }

# 설정 인스턴스 생성
settings = Settings()

# 프로젝트 루트 디렉토리
ROOT_DIR = Path(__file__).parent.parent.parent

# 데이터 디렉토리
DATA_DIR = ROOT_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# 업로드 디렉토리
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# 로그 디렉토리
LOG_DIR = ROOT_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)