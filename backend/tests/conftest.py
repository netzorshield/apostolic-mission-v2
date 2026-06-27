"""Pytest configuration — all targets and credentials come from environment."""
from __future__ import annotations

import os

import pytest


def _load_dotenv() -> None:
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if not os.path.isfile(env_path):
        return
    with open(env_path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()


@pytest.fixture(scope="session")
def api_base_url() -> str:
    return os.getenv("IAM_API_BASE_URL", "http://127.0.0.1:8001/api").rstrip("/")


@pytest.fixture(scope="session")
def admin_email() -> str:
    value = os.getenv("IAM_TEST_ADMIN_EMAIL") or os.getenv("ADMIN_EMAIL")
    if not value:
        pytest.skip("Set IAM_TEST_ADMIN_EMAIL or ADMIN_EMAIL in .env to run authenticated tests")
    return value


@pytest.fixture(scope="session")
def admin_password() -> str:
    value = os.getenv("IAM_TEST_ADMIN_PASSWORD") or os.getenv("ADMIN_PASSWORD")
    if not value:
        pytest.skip("Set IAM_TEST_ADMIN_PASSWORD or ADMIN_PASSWORD in .env to run authenticated tests")
    return value
