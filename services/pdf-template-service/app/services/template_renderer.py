"""Rendering template .docx dengan data menggunakan docxtpl (Jinja2)."""

import tempfile
from pathlib import Path

from docxtpl import DocxTemplate
from jinja2 import Environment, Undefined

from app.exceptions import TemplateNotFoundError


class _SilentUndefined(Undefined):
    """Jinja2 Undefined subclass yang mengembalikan string kosong.

    Digunakan agar variabel yang tidak ada di data dictionary
    dirender sebagai string kosong tanpa menghasilkan error.
    """

    def __str__(self) -> str:
        return ""

    def __iter__(self):
        return iter([])

    def __bool__(self) -> bool:
        return False

    def __getattr__(self, name: str):
        return self


class TemplateRenderer:
    """Mengisi template .docx dengan data menggunakan docxtpl (Jinja2).

    Template disimpan di filesystem dengan struktur:
        {template_dir}/{template_id}/{section}.docx
    """

    def __init__(self, template_dir: Path):
        """Inisialisasi renderer dengan direktori template.

        Args:
            template_dir: Path ke direktori root tempat template disimpan.
        """
        self.template_dir = template_dir

    def get_template_path(self, template_id: str, section: str) -> Path:
        """Dapatkan full path ke file template.

        Args:
            template_id: ID template (e.g. "tmpl-abc-123").
            section: Nama section (e.g. "cover" atau "results").

        Returns:
            Path lengkap ke file template .docx.
        """
        return self.template_dir / template_id / f"{section}.docx"

    def template_exists(self, template_id: str, section: str | None = None) -> bool:
        """Cek apakah template ada di filesystem.

        Args:
            template_id: ID template.
            section: Nama section spesifik. Jika None, cek apakah
                     setidaknya satu section (cover atau results) ada.

        Returns:
            True jika template ditemukan, False jika tidak.
        """
        if section is not None:
            return self.get_template_path(template_id, section).is_file()

        # Cek apakah setidaknya satu section ada
        for s in ("cover", "results"):
            if self.get_template_path(template_id, s).is_file():
                return True
        return False

    def render(self, template_id: str, section: str, data: dict) -> Path:
        """Render template dengan data dan simpan ke temporary file.

        Membuka file template .docx, mengisi variabel Jinja2 dengan data
        yang diberikan, lalu menyimpan hasilnya ke file temporary.

        Variabel yang tidak ada di data dictionary akan dirender sebagai
        string kosong (tidak menghasilkan error).

        Args:
            template_id: ID template (e.g. "tmpl-abc-123").
            section: Nama section (e.g. "cover" atau "results").
            data: Dictionary berisi data untuk mengisi variabel template.

        Returns:
            Path ke file .docx temporary yang sudah diisi dengan data.

        Raises:
            TemplateNotFoundError: Jika file template tidak ditemukan.
        """
        template_path = self.get_template_path(template_id, section)

        if not template_path.is_file():
            raise TemplateNotFoundError(template_id, section)

        # Buka template dengan docxtpl
        doc = DocxTemplate(str(template_path))

        # Buat Jinja2 Environment dengan SilentUndefined agar variabel
        # yang tidak ada di data menjadi string kosong (bukan error)
        jinja_env = Environment(undefined=_SilentUndefined)

        # Render template dengan data
        doc.render(data, jinja_env=jinja_env)

        # Simpan ke temporary file
        tmp = tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".docx",
            prefix="rendered_",
        )
        tmp.close()

        output_path = Path(tmp.name)
        doc.save(str(output_path))

        return output_path
