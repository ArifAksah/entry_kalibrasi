"""Unit tests untuk PreviewCache."""

import os
import time
from pathlib import Path

import pytest

from app.services.preview_cache import PreviewCache


@pytest.fixture
def cache_dir(tmp_path: Path) -> Path:
    """Direktori cache temporary untuk testing."""
    return tmp_path / "cache"


@pytest.fixture
def template_dir(tmp_path: Path) -> Path:
    """Direktori template temporary untuk testing."""
    d = tmp_path / "templates" / "tmpl-abc-123"
    d.mkdir(parents=True)
    return d


@pytest.fixture
def preview_cache(cache_dir: Path) -> PreviewCache:
    """Instance PreviewCache untuk testing."""
    return PreviewCache(cache_dir)


@pytest.fixture
def sample_template(template_dir: Path) -> Path:
    """File template .docx dummy untuk testing."""
    template_path = template_dir / "cover.docx"
    template_path.write_bytes(b"fake docx content")
    return template_path


@pytest.fixture
def sample_preview(tmp_path: Path) -> Path:
    """File preview PNG dummy untuk testing."""
    preview_path = tmp_path / "preview.png"
    preview_path.write_bytes(b"fake png content")
    return preview_path


class TestPreviewCacheInit:
    """Tests untuk __init__."""

    def test_creates_cache_dir_if_not_exists(self, tmp_path: Path) -> None:
        """Cache dir dibuat otomatis jika belum ada."""
        cache_dir = tmp_path / "new_cache"
        assert not cache_dir.exists()

        PreviewCache(cache_dir)

        assert cache_dir.exists()
        assert cache_dir.is_dir()

    def test_no_error_if_cache_dir_already_exists(self, tmp_path: Path) -> None:
        """Tidak error jika cache dir sudah ada."""
        cache_dir = tmp_path / "existing_cache"
        cache_dir.mkdir()

        cache = PreviewCache(cache_dir)
        assert cache.cache_dir == cache_dir


class TestPreviewCacheGet:
    """Tests untuk method get()."""

    def test_returns_none_when_no_cache(
        self, preview_cache: PreviewCache, sample_template: Path
    ) -> None:
        """Return None jika belum ada cache."""
        result = preview_cache.get(sample_template)
        assert result is None

    def test_returns_cached_path_when_valid(
        self,
        preview_cache: PreviewCache,
        sample_template: Path,
        sample_preview: Path,
    ) -> None:
        """Return path cache jika masih valid."""
        preview_cache.put(sample_template, sample_preview)

        result = preview_cache.get(sample_template)
        assert result is not None
        assert result.exists()

    def test_returns_none_when_template_modified(
        self,
        preview_cache: PreviewCache,
        sample_template: Path,
        sample_preview: Path,
    ) -> None:
        """Return None jika template sudah dimodifikasi setelah cache dibuat."""
        # Put cache first
        preview_cache.put(sample_template, sample_preview)

        # Simulate template modification (set mtime to future)
        time.sleep(0.05)
        sample_template.write_bytes(b"modified docx content")

        result = preview_cache.get(sample_template)
        assert result is None

    def test_returns_none_when_template_not_exists(
        self, preview_cache: PreviewCache, tmp_path: Path
    ) -> None:
        """Return None jika file template tidak ada."""
        non_existent = tmp_path / "templates" / "tmpl-xyz" / "cover.docx"
        result = preview_cache.get(non_existent)
        assert result is None


class TestPreviewCachePut:
    """Tests untuk method put()."""

    def test_copies_preview_to_cache(
        self,
        preview_cache: PreviewCache,
        sample_template: Path,
        sample_preview: Path,
    ) -> None:
        """Preview file di-copy ke lokasi cache."""
        cache_path = preview_cache.put(sample_template, sample_preview)

        assert cache_path.exists()
        assert cache_path.read_bytes() == b"fake png content"

    def test_returns_correct_cache_path(
        self,
        preview_cache: PreviewCache,
        sample_template: Path,
        sample_preview: Path,
        cache_dir: Path,
    ) -> None:
        """Return path sesuai struktur {cache_dir}/{template_id}/{section}_preview.png."""
        cache_path = preview_cache.put(sample_template, sample_preview)

        expected = cache_dir / "tmpl-abc-123" / "cover_preview.png"
        assert cache_path == expected

    def test_creates_subdirectory_if_needed(
        self,
        preview_cache: PreviewCache,
        sample_template: Path,
        sample_preview: Path,
    ) -> None:
        """Subdirectory dibuat otomatis jika belum ada."""
        cache_path = preview_cache.put(sample_template, sample_preview)
        assert cache_path.parent.exists()

    def test_overwrites_existing_cache(
        self,
        preview_cache: PreviewCache,
        sample_template: Path,
        sample_preview: Path,
        tmp_path: Path,
    ) -> None:
        """Cache lama ditimpa dengan yang baru."""
        preview_cache.put(sample_template, sample_preview)

        # Create new preview with different content
        new_preview = tmp_path / "new_preview.png"
        new_preview.write_bytes(b"updated png content")

        cache_path = preview_cache.put(sample_template, new_preview)
        assert cache_path.read_bytes() == b"updated png content"


class TestPreviewCacheInvalidate:
    """Tests untuk method invalidate()."""

    def test_deletes_cached_file(
        self,
        preview_cache: PreviewCache,
        sample_template: Path,
        sample_preview: Path,
    ) -> None:
        """Cache file dihapus setelah invalidate."""
        cache_path = preview_cache.put(sample_template, sample_preview)
        assert cache_path.exists()

        preview_cache.invalidate(sample_template)
        assert not cache_path.exists()

    def test_no_error_when_no_cache_to_invalidate(
        self, preview_cache: PreviewCache, sample_template: Path
    ) -> None:
        """Tidak error jika tidak ada cache untuk dihapus."""
        # Should not raise
        preview_cache.invalidate(sample_template)


class TestPreviewCacheGetCachePath:
    """Tests untuk method _get_cache_path()."""

    def test_cover_section(
        self, preview_cache: PreviewCache, cache_dir: Path
    ) -> None:
        """Path benar untuk section cover."""
        template_path = Path("/templates/tmpl-123/cover.docx")
        result = preview_cache._get_cache_path(template_path)
        assert result == cache_dir / "tmpl-123" / "cover_preview.png"

    def test_results_section(
        self, preview_cache: PreviewCache, cache_dir: Path
    ) -> None:
        """Path benar untuk section results."""
        template_path = Path("/templates/tmpl-456/results.docx")
        result = preview_cache._get_cache_path(template_path)
        assert result == cache_dir / "tmpl-456" / "results_preview.png"
