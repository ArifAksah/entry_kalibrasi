"""Unit tests untuk PDFMerger."""

import tempfile
from pathlib import Path

import pytest
from PyPDF2 import PdfWriter

from app.services.pdf_merger import PDFMerger


def _create_pdf(num_pages: int = 1) -> Path:
    """Helper: buat file PDF temporary dengan jumlah halaman tertentu."""
    writer = PdfWriter()
    for _ in range(num_pages):
        writer.add_blank_page(width=612, height=792)

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    writer.write(tmp)
    tmp.close()
    return Path(tmp.name)


class TestPDFMerger:
    """Tests untuk PDFMerger.merge()."""

    def setup_method(self):
        self.merger = PDFMerger()

    def test_raises_value_error_on_empty_list(self):
        """Harus raise ValueError jika pdf_paths kosong."""
        with pytest.raises(ValueError, match="tidak boleh kosong"):
            self.merger.merge([])

    def test_single_pdf_returns_same_path(self):
        """Jika hanya satu PDF, langsung return path tersebut tanpa merge."""
        pdf_path = _create_pdf(2)
        try:
            result = self.merger.merge([pdf_path])
            assert result == pdf_path
        finally:
            pdf_path.unlink(missing_ok=True)

    def test_merge_two_pdfs(self):
        """Merge dua PDF menghasilkan file baru dengan total halaman yang benar."""
        pdf1 = _create_pdf(2)
        pdf2 = _create_pdf(3)
        try:
            result = self.merger.merge([pdf1, pdf2])
            assert result != pdf1
            assert result != pdf2
            assert result.exists()
            assert result.suffix == ".pdf"

            # Verify page count
            from PyPDF2 import PdfReader
            reader = PdfReader(str(result))
            assert len(reader.pages) == 5
        finally:
            pdf1.unlink(missing_ok=True)
            pdf2.unlink(missing_ok=True)
            result.unlink(missing_ok=True)

    def test_merge_three_pdfs_preserves_order(self):
        """Merge tiga PDF mempertahankan urutan dan total halaman."""
        pdf1 = _create_pdf(1)
        pdf2 = _create_pdf(2)
        pdf3 = _create_pdf(3)
        try:
            result = self.merger.merge([pdf1, pdf2, pdf3])
            assert result.exists()

            from PyPDF2 import PdfReader
            reader = PdfReader(str(result))
            assert len(reader.pages) == 6
        finally:
            pdf1.unlink(missing_ok=True)
            pdf2.unlink(missing_ok=True)
            pdf3.unlink(missing_ok=True)
            result.unlink(missing_ok=True)

    def test_merged_output_is_temporary_file(self):
        """Output merge adalah temporary file dengan suffix .pdf."""
        pdf1 = _create_pdf(1)
        pdf2 = _create_pdf(1)
        try:
            result = self.merger.merge([pdf1, pdf2])
            assert result.suffix == ".pdf"
            assert result.exists()
            # File should be in temp directory
            assert tempfile.gettempdir() in str(result.parent) or "Temp" in str(result)
        finally:
            pdf1.unlink(missing_ok=True)
            pdf2.unlink(missing_ok=True)
            result.unlink(missing_ok=True)
