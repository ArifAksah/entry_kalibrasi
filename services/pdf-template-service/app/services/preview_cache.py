"""Preview Cache — cache preview PNG berdasarkan file modification time.

Menyimpan dan mengelola cache preview PNG untuk template .docx.
Cache valid selama file template tidak berubah (berdasarkan modification time).
"""

import shutil
from pathlib import Path


class PreviewCache:
    """Cache preview PNG berdasarkan file modification time.

    Cache disimpan di struktur: {cache_dir}/{template_id}/{section}_preview.png
    Cache dianggap valid jika: cache file exists AND cache mtime >= template mtime.
    """

    def __init__(self, cache_dir: Path) -> None:
        """Inisialisasi PreviewCache.

        Args:
            cache_dir: Path ke direktori cache. Dibuat otomatis jika belum ada.
        """
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def get(self, template_path: Path) -> Path | None:
        """Return cached preview jika masih valid, None jika expired atau tidak ada.

        Cache valid jika:
        - File cache ada
        - Modification time cache >= modification time template

        Args:
            template_path: Path ke file template .docx sumber.

        Returns:
            Path ke file preview PNG yang di-cache, atau None jika cache
            tidak ada atau sudah expired.
        """
        cache_path = self._get_cache_path(template_path)

        if not cache_path.exists():
            return None

        if not template_path.exists():
            return None

        cache_mtime = cache_path.stat().st_mtime
        template_mtime = template_path.stat().st_mtime

        if cache_mtime >= template_mtime:
            return cache_path

        return None

    def put(self, template_path: Path, preview_path: Path) -> Path:
        """Simpan preview ke cache location.

        Menggunakan shutil.copy2 untuk menyalin file preview ke lokasi cache,
        mempertahankan metadata file (termasuk modification time).

        Args:
            template_path: Path ke file template .docx sumber (untuk menentukan
                lokasi cache).
            preview_path: Path ke file preview PNG yang akan di-cache.

        Returns:
            Path ke file preview yang tersimpan di cache.
        """
        cache_path = self._get_cache_path(template_path)
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(preview_path, cache_path)
        return cache_path

    def invalidate(self, template_path: Path) -> None:
        """Hapus cached preview untuk template tertentu.

        Args:
            template_path: Path ke file template .docx yang cache-nya
                akan dihapus.
        """
        cache_path = self._get_cache_path(template_path)
        if cache_path.exists():
            cache_path.unlink()

    def _get_cache_path(self, template_path: Path) -> Path:
        """Hitung path file cache dari template path.

        Struktur cache: {cache_dir}/{template_id}/{section}_preview.png

        Template path diharapkan dalam format:
            {template_dir}/{template_id}/{section}.docx

        Args:
            template_path: Path ke file template .docx.

        Returns:
            Path ke lokasi file cache PNG.
        """
        # template_path format: .../{template_id}/{section}.docx
        section = template_path.stem  # e.g. "cover" atau "results"
        template_id = template_path.parent.name  # e.g. "tmpl-abc-123"

        return self.cache_dir / template_id / f"{section}_preview.png"
