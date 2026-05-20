"""Tests for GET /health endpoint."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    """Create test client."""
    return TestClient(app)


def test_health_returns_200(client: TestClient) -> None:
    """Health endpoint should return HTTP 200."""
    response = client.get("/health")
    assert response.status_code == 200


def test_health_returns_correct_fields(client: TestClient) -> None:
    """Health endpoint should return status, version, and libreoffice_available."""
    response = client.get("/health")
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "1.0.0"
    assert "libreoffice_available" in data
    assert isinstance(data["libreoffice_available"], bool)


def test_health_libreoffice_available_reflects_app_state(client: TestClient) -> None:
    """Health endpoint should reflect app.state.libreoffice_available."""
    # Set state to True
    app.state.libreoffice_available = True
    response = client.get("/health")
    assert response.json()["libreoffice_available"] is True

    # Set state to False
    app.state.libreoffice_available = False
    response = client.get("/health")
    assert response.json()["libreoffice_available"] is False
