"""Tests for GET /preview-template endpoint."""

import shutil
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    """Create test client with LibreOffice available."""
    app.state.libreoffice_available = True
    return TestClient(app)


@pytest.fixture
def client_no_libreoffice() -> TestClient:
    """Create test client with LibreOffice unavailable."""
    app.state.libreoffice_available = False
    return TestClient(app)


@pytest.fixture
def template_dir(tmp_path: Path):
    """Create a temporary template directory with a sample .docx file."""
    template_id = "test-template-001"
    section_dir = tmp_path / template_id
    section_dir.mkdir(parents=True)

    # Create a minimal .docx-like file for testing
    docx_file = section_dir / "cover.docx"
    docx_file.write_bytes(b"PK\x03\x04fake-docx-content")

    return tmp_path, template_id


@pytest.fixture
def cache_dir(tmp_path: Path):
    """Create a temporary cache directory."""
    cache = tmp_path / "cache"
    cache.mkdir()
    return cache


class TestPreviewValidation:
    """Tests for query parameter validation."""

    def test_missing_template_id_returns_422(self, client: TestClient) -> None:
        """Missing template_id should return 422 (FastAPI validation)."""
        response = client.get("/preview-template?section=cover")
        assert response.status_code == 422

    def test_missing_section_returns_422(self, client: TestClient) -> None:
        """Missing section should return 422 (FastAPI validation)."""
        response = client.get("/preview-template?template_id=test-123")
        assert response.status_code == 422

    def test_invalid_section_returns_422(self, client: TestClient) -> None:
        """Invalid section value should return 422."""
        response = client.get(
            "/preview-template?template_id=test-123&section=invalid"
        )
        assert response.status_code == 422

    def test_invalid_template_id_format_returns_400(self, client: TestClient) -> None:
        """template_id with invalid characters should return 400."""
        response = client.get(
            "/preview-template?template_id=../hack&section=cover"
        )
        assert response.status_code == 400
        data = response.json()
        assert data["code"] == "VALIDATION_ERROR"
        assert data["field"] == "template_id"

    def test_template_id_too_long_returns_400(self, client: TestClient) -> None:
        """template_id longer than 100 chars should return 400."""
        long_id = "a" * 101
        response = client.get(
            f"/preview-template?template_id={long_id}&section=cover"
        )
        assert response.status_code == 400

    def test_template_id_with_spaces_returns_400(self, client: TestClient) -> None:
        """template_id with spaces should return 400."""
        response = client.get(
            "/preview-template?template_id=has space&section=cover"
        )
        assert response.status_code == 400


class TestPreviewLibreOffice:
    """Tests for LibreOffice availability check."""

    def test_libreoffice_unavailable_returns_503(
        self, client_no_libreoffice: TestClient
    ) -> None:
        """Should return 503 when LibreOffice is not available."""
        response = client_no_libreoffice.get(
            "/preview-template?template_id=test-123&section=cover"
        )
        assert response.status_code == 503
        data = response.json()
        assert data["code"] == "LIBREOFFICE_UNAVAILABLE"


class TestPreviewTemplateNotFound:
    """Tests for template not found scenarios."""

    def test_template_not_found_returns_404(self, client: TestClient) -> None:
        """Should return 404 when template does not exist."""
        response = client.get(
            "/preview-template?template_id=nonexistent-id&section=cover"
        )
        assert response.status_code == 404
        data = response.json()
        assert data["code"] == "TEMPLATE_NOT_FOUND"


class TestPreviewCacheHit:
    """Tests for cache hit scenarios."""

    @patch("app.routes.preview.CACHE_DIR")
    @patch("app.routes.preview.settings")
    def test_returns_cached_png_on_cache_hit(
        self, mock_settings, mock_cache_dir, client: TestClient, tmp_path: Path
    ) -> None:
        """Should return cached PNG without conversion when cache is valid."""
        # Setup template
        template_id = "cached-template"
        template_dir = tmp_path / "templates"
        section_dir = template_dir / template_id
        section_dir.mkdir(parents=True)
        docx_file = section_dir / "cover.docx"
        docx_file.write_bytes(b"PK\x03\x04fake-docx")

        # Setup cache
        cache_dir = tmp_path / "cache"
        cache_dir.mkdir()
        cache_template_dir = cache_dir / template_id
        cache_template_dir.mkdir(parents=True)
        cached_png = cache_template_dir / "cover_preview.png"
        png_content = b"\x89PNG\r\n\x1a\nfake-png-data"
        cached_png.write_bytes(png_content)

        # Make cache newer than template
        import os
        import time

        time.sleep(0.01)
        os.utime(cached_png, None)

        mock_settings.pdf_template_dir = template_dir
        mock_cache_dir.__truediv__ = cache_dir.__truediv__
        mock_cache_dir.mkdir = cache_dir.mkdir

        # Patch PreviewCache to use our cache_dir
        with patch("app.routes.preview.PreviewCache") as MockCache:
            mock_cache_instance = MockCache.return_value
            mock_cache_instance.get.return_value = cached_png

            response = client.get(
                f"/preview-template?template_id={template_id}&section=cover"
            )

        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert response.content == png_content


class TestPreviewGeneration:
    """Tests for preview generation (cache miss)."""

    @patch("app.routes.preview.CACHE_DIR")
    @patch("app.routes.preview.settings")
    def test_generates_preview_on_cache_miss(
        self, mock_settings, mock_cache_dir, client: TestClient, tmp_path: Path
    ) -> None:
        """Should generate preview PNG when cache is empty."""
        # Setup template
        template_id = "gen-template"
        template_dir = tmp_path / "templates"
        section_dir = template_dir / template_id
        section_dir.mkdir(parents=True)
        docx_file = section_dir / "cover.docx"
        docx_file.write_bytes(b"PK\x03\x04fake-docx")

        # Setup cache dir
        cache_dir = tmp_path / "cache"
        cache_dir.mkdir()

        mock_settings.pdf_template_dir = template_dir

        # Create a fake PNG file that convert_to_png would produce
        fake_png_path = tmp_path / "output.png"
        png_content = b"\x89PNG\r\n\x1a\ngenerated-png-data"
        fake_png_path.write_bytes(png_content)

        with patch("app.routes.preview.PreviewCache") as MockCache:
            mock_cache_instance = MockCache.return_value
            mock_cache_instance.get.return_value = None  # Cache miss
            mock_cache_instance.put.return_value = None

            with patch("app.routes.preview.PDFConverter") as MockConverter:
                mock_converter_instance = MockConverter.return_value
                mock_converter_instance.convert_to_png = AsyncMock(
                    return_value=fake_png_path
                )

                response = client.get(
                    f"/preview-template?template_id={template_id}&section=cover"
                )

        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert response.content == png_content

    @patch("app.routes.preview.CACHE_DIR")
    @patch("app.routes.preview.settings")
    def test_conversion_error_returns_500(
        self, mock_settings, mock_cache_dir, client: TestClient, tmp_path: Path
    ) -> None:
        """Should return 500 when conversion fails."""
        from app.exceptions import ConversionError

        # Setup template
        template_id = "fail-template"
        template_dir = tmp_path / "templates"
        section_dir = template_dir / template_id
        section_dir.mkdir(parents=True)
        docx_file = section_dir / "cover.docx"
        docx_file.write_bytes(b"PK\x03\x04fake-docx")

        mock_settings.pdf_template_dir = template_dir

        with patch("app.routes.preview.PreviewCache") as MockCache:
            mock_cache_instance = MockCache.return_value
            mock_cache_instance.get.return_value = None

            with patch("app.routes.preview.PDFConverter") as MockConverter:
                mock_converter_instance = MockConverter.return_value
                mock_converter_instance.convert_to_png = AsyncMock(
                    side_effect=ConversionError("LibreOffice crashed")
                )

                response = client.get(
                    f"/preview-template?template_id={template_id}&section=cover"
                )

        assert response.status_code == 500
        data = response.json()
        assert data["code"] == "CONVERSION_ERROR"
