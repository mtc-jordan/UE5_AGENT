from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "UE5 AI Studio"
    DEBUG: bool = True
    
    # Database - Using SQLite for simplicity (use UE5_DATABASE_URL to avoid conflict)
    UE5_DATABASE_URL: str = Field(default="sqlite+aiosqlite:///./ue5_ai_studio.db", alias="UE5_DATABASE_URL")
    
    # JWT - Use UE5_ prefix to avoid conflicts with system env vars
    UE5_JWT_SECRET: str = Field(default="ue5-studio-secret-key-2024", alias="UE5_JWT_SECRET")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # AI Services - Read from system environment
    DEEPSEEK_API_KEY: Optional[str] = Field(default=None)
    ANTHROPIC_API_KEY: Optional[str] = Field(default=None)
    GOOGLE_API_KEY: Optional[str] = Field(default=None)  # Google Gemini API Key
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "*"]
    
    @property
    def DATABASE_URL(self) -> str:
        return self.UE5_DATABASE_URL
    
    @property
    def JWT_SECRET(self) -> str:
        return self.UE5_JWT_SECRET
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"
        populate_by_name = True


settings = Settings()
