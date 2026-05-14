from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    dify_base_url: AnyHttpUrl = Field(default="http://localhost:5001", alias="DIFY_BASE_URL")
    dify_api_key: str = Field(default="", alias="DIFY_API_KEY")
    dify_user: str = Field(default="suke-api", alias="DIFY_USER")
    request_timeout_seconds: float = Field(default=600, alias="REQUEST_TIMEOUT_SECONDS")


settings = Settings()
