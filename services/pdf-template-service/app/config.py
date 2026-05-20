"""Konfigurasi Settings untuk PDF Template Service menggunakan pydantic-settings."""

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings, dibaca dari environment variables."""

    pdf_service_port: int = 8000
    pdf_template_dir: Path = Path("./templates")
    pdf_cors_origins: str = ""

    model_config = {
        "env_prefix": "",
        "env_file": ".env",
        "extra": "ignore",
    }

    @field_validator("pdf_service_port")
    @classmethod
    def validate_port(cls, v: int) -> int:
        """Validasi port range 1024-65535."""
        if v < 1024 or v > 65535:
            raise ValueError(f"Port harus dalam range 1024-65535, diterima: {v}")
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated origins menjadi list."""
        if not self.pdf_cors_origins:
            return []
        return [o.strip() for o in self.pdf_cors_origins.split(",") if o.strip()]


settings = Settings()
