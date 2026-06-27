"""Centralized, environment-driven configuration with production-safe defaults."""
from __future__ import annotations

import os
import secrets
from pathlib import Path


def _load_dotenv() -> None:
    for candidate in (
        Path(__file__).resolve().parent.parent / ".env",
        Path(__file__).resolve().parent / ".env",
    ):
        if not candidate.is_file():
            continue
        for line in candidate.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ[key.strip()] = value.strip()
        break


_load_dotenv()
from dataclasses import dataclass
from typing import List


def _require(name: str, value: str | None) -> str:
    if not value or not value.strip():
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value.strip()


def _parse_origins(raw: str | None) -> List[str]:
    if not raw or not raw.strip():
        return []
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@dataclass(frozen=True)
class Settings:
    app_env: str
    api_host: str
    api_port: int
    api_prefix: str
    mongo_uri: str
    mongo_db_name: str
    jwt_secret: str
    jwt_algorithm: str
    jwt_access_token_expire_hours: int
    admin_email: str
    admin_password: str
    admin_name: str
    cors_origins: List[str]
    bcrypt_rounds: int
    login_max_attempts: int
    login_lockout_minutes: int
    require_https: bool

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    def validate_security(self) -> None:
        if len(self.jwt_secret) < 32:
            raise RuntimeError("JWT_SECRET must be at least 32 characters.")

        weak_secrets = {"changeme", "secret", "your-secret-key", "jwt-secret", "dev-secret"}
        if self.jwt_secret.lower() in weak_secrets:
            raise RuntimeError("JWT_SECRET is too weak. Generate a random 64+ char secret.")

        if self.is_production:
            if "*" in self.cors_origins:
                raise RuntimeError("CORS must not allow '*' in production.")
            if not self.cors_origins:
                raise RuntimeError("CORS_ORIGINS must be set in production.")
            if len(self.admin_password) < 12:
                raise RuntimeError("ADMIN_PASSWORD must be at least 12 characters in production.")
            if self.admin_password.lower() in {"admin@2026", "password", "admin123", "changeme"}:
                raise RuntimeError("ADMIN_PASSWORD is too weak for production.")
            if not self.require_https:
                raise RuntimeError("REQUIRE_HTTPS must be true in production.")


def load_settings() -> Settings:
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    dev_mode = app_env != "production"

    jwt_secret = os.getenv("JWT_SECRET")
    if not jwt_secret and dev_mode:
        jwt_secret = secrets.token_urlsafe(48)

    admin_password = os.getenv("ADMIN_PASSWORD")
    if not admin_password and dev_mode:
        admin_password = secrets.token_urlsafe(16)

    cors_raw = os.getenv("CORS_ORIGINS")
    if not cors_raw and dev_mode:
        cors_raw = "http://localhost:3000,http://127.0.0.1:3000"

    settings = Settings(
        app_env=app_env,
        api_host=os.getenv("API_HOST", "127.0.0.1"),
        api_port=int(os.getenv("API_PORT", "8001")),
        api_prefix=os.getenv("API_PREFIX", "/api"),
        mongo_uri=os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017"),
        mongo_db_name=os.getenv("MONGO_DB_NAME", "iam_database"),
        jwt_secret=_require("JWT_SECRET", jwt_secret) if not dev_mode else (jwt_secret or ""),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        jwt_access_token_expire_hours=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_HOURS", "24")),
        admin_email=os.getenv("ADMIN_EMAIL", "admin@localhost"),
        admin_password=admin_password or "",
        admin_name=os.getenv("ADMIN_NAME", "IAM Administrator"),
        cors_origins=_parse_origins(cors_raw),
        bcrypt_rounds=max(12, int(os.getenv("BCRYPT_ROUNDS", "12"))),
        login_max_attempts=int(os.getenv("LOGIN_MAX_ATTEMPTS", "5")),
        login_lockout_minutes=int(os.getenv("LOGIN_LOCKOUT_MINUTES", "15")),
        require_https=os.getenv("REQUIRE_HTTPS", "false" if dev_mode else "true").lower() == "true",
    )
    settings.validate_security()
    return settings
