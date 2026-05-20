"""PDF Merger — menggabungkan beberapa file PDF menjadi satu."""

import tempfile
from pathlib import Path

from PyPDF2 import PdfMerger as _PdfMerger


class PDFMerger:
    """Menggabungkan beberapa file PDF menjadi satu."""

    def merge(self, pdf_paths: list[Path]) -> Path:
        """
        Gabungkan PDF files sesuai urutan.

        Args:
            pdf_paths: List path ke file PDF yang akan digabungkan.

        Returns:
            Path ke merged PDF (temporary file).
            Jika hanya satu PDF, langsung return path tersebut tanpa merge.

        Raises:
            ValueError: Jika pdf_paths kosong.
        """
        if not pdf_paths:
            raise ValueError("pdf_paths tidak boleh kosong")

        if len(pdf_paths) == 1:
            return pdf_paths[0]

        merger = _PdfMerger()
        try:
            for pdf_path in pdf_paths:
                merger.append(str(pdf_path))

            output_file = tempfile.NamedTemporaryFile(
                delete=False, suffix=".pdf"
            )
            output_path = Path(output_file.name)
            output_file.close()

            merger.write(str(output_path))
        finally:
            merger.close()

        return output_path
