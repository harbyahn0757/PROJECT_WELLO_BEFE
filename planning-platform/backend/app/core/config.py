"""
설정 파일 - Pydantic Settings를 사용한 환경변수 관리
"""

from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field
import os


class Settings(BaseSettings):
    """애플리케이션 설정"""
    
    # 기본 설정
    PROJECT_NAME: str = "Planning Platform API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    
    # 서버 설정
    HOST: str = Field(default="0.0.0.0", env="HOST")
    PORT: int = Field(default=8000, env="PORT")
    
    # CORS 설정
    ALLOWED_HOSTS: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        env="ALLOWED_HOSTS"
    )
    
    # 데이터베이스 설정
    DATABASE_URL: Optional[str] = Field(default=None, env="DATABASE_URL")
    DATABASE_HOST: str = Field(default="localhost", env="DATABASE_HOST")
    DATABASE_PORT: int = Field(default=5432, env="DATABASE_PORT")
    DATABASE_USER: str = Field(default="planning_user", env="DATABASE_USER")
    DATABASE_PASSWORD: str = Field(default="planning_password", env="DATABASE_PASSWORD")
    DATABASE_NAME: str = Field(default="planning_platform", env="DATABASE_NAME")
    
    # JWT 설정
    SECRET_KEY: str = Field(
        default="your-secret-key-change-this-in-production",
        env="SECRET_KEY"
    )
    ALGORITHM: str = Field(default="HS256", env="ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    
    # Redis 설정 (선택적)
    REDIS_URL: Optional[str] = Field(default=None, env="REDIS_URL")
    
    # 로깅 설정
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    
    # AI/ML 모델 설정
    MODEL_PATH: str = Field(default="./models", env="MODEL_PATH")
    
    # 외부 API 설정
    EXTERNAL_API_KEY: Optional[str] = Field(default=None, env="EXTERNAL_API_KEY")
    
    @property
    def database_url(self) -> str:
        """데이터베이스 URL 생성"""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        
        return (
            f"postgresql+asyncpg://{self.DATABASE_USER}:{self.DATABASE_PASSWORD}"
            f"@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"
        )
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# 설정 인스턴스 생성
settings = Settings()
