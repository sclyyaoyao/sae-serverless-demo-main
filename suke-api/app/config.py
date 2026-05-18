from pydantic import AnyHttpUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    dify_base_url: AnyHttpUrl = Field(default="http://localhost:5001", alias="DIFY_BASE_URL")
    # 可选：Dify 文件直链域名与 API 不一致时（例如 API :5001、文件存储 :8000），单独配置文件基址
    dify_files_base_url: AnyHttpUrl | None = Field(default=None, alias="DIFY_FILES_BASE_URL")
    # 可选：额外允许的 host 或 host:port，逗号分隔；也可写完整 URL，取其 netloc
    files_allowed_hosts: str = Field(default="", alias="FILES_ALLOWED_HOSTS")
    dify_api_key: str = Field(default="", alias="DIFY_API_KEY")
    dify_user: str = Field(default="suke-api", alias="DIFY_USER")
    request_timeout_seconds: float = Field(default=600, alias="REQUEST_TIMEOUT_SECONDS")

    @field_validator("dify_files_base_url", mode="before")
    @classmethod
    def _empty_files_base_to_none(cls, v: object) -> object:
        if v is None or v == "":
            return None
        return v


settings = Settings()
