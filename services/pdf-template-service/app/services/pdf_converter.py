"""PDF Converter — konversi .docx ke PDF via LibreOffice headless."""

import asyncio
import subprocess
import tempfile
from pathlib import Path

from app.exceptions import ConversionError


class PDFConverter:
    """Konversi .docx ke PDF menggunakan LibreOffice headless."""

    TIMEOUT_SECONDS: int = 30

    async def convert(self, docx_path: Path) -> Path:
        """
        Konversi file .docx ke PDF menggunakan LibreOffice headless.

        Args:
            docx_path: Path ke file .docx yang akan dikonversi.

        Returns:
            Path ke file PDF hasil konversi.

        Raises:
            ConversionError: Jika LibreOffice gagal atau timeout.
        """
        if not docx_path.exists():
            raise ConversionError(f"File tidak ditemukan: {docx_path}")

        output_dir = docx_path.parent

        try:
            process = await asyncio.create_subprocess_exec(
                "libreoffice",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(output_dir),
                str(docx_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self.TIMEOUT_SECONDS,
            )

        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            raise ConversionError(
                f"LibreOffice timeout setelah {self.TIMEOUT_SECONDS} detik"
            )
        except FileNotFoundError:
            raise ConversionError(
                "LibreOffice tidak ditemukan. Pastikan LibreOffice terinstall."
            )

        if process.returncode != 0:
            error_detail = stderr.decode().strip() if stderr else "Unknown error"
            raise ConversionError(f"LibreOffice exit code {process.returncode}: {error_detail}")

        # LibreOffice outputs PDF with same stem name in output_dir
        pdf_path = output_dir / f"{docx_path.stem}.pdf"

        if not pdf_path.exists():
            raise ConversionError(
                f"File PDF tidak ditemukan setelah konversi: {pdf_path}"
            )

        return pdf_path

    async def convert_to_png(self, docx_path: Path, dpi: int = 150) -> Path:
        """
        Konversi halaman pertama .docx ke PNG untuk preview.

        Proses: .docx → PDF (via LibreOffice) → PNG (via pdf2image).
        Resolusi minimal 1200x1600 piksel; jika dpi=150 tidak cukup, gunakan dpi=200.

        Args:
            docx_path: Path ke file .docx yang akan dikonversi.
            dpi: Resolusi DPI untuk konversi PDF ke PNG (default: 150).

        Returns:
            Path ke file PNG hasil konversi.

        Raises:
            ConversionError: Jika konversi gagal.
        """
        from pdf2image import convert_from_path

        # Step 1: Convert .docx to PDF
        pdf_path = await self.convert(docx_path)

        try:
            # Step 2: Convert first page of PDF to PNG
            images = convert_from_path(
                str(pdf_path),
                first_page=1,
                last_page=1,
                dpi=dpi,
            )

            if not images:
                raise ConversionError("Tidak ada halaman yang dihasilkan dari PDF")

            first_page = images[0]

            # Check minimum resolution 1200x1600
            width, height = first_page.size
            if width < 1200 or height < 1600:
                # Retry with higher DPI
                images = convert_from_path(
                    str(pdf_path),
                    first_page=1,
                    last_page=1,
                    dpi=200,
                )
                if not images:
                    raise ConversionError(
                        "Tidak ada halaman yang dihasilkan dari PDF (retry dpi=200)"
                    )
                first_page = images[0]

            # Save PNG to temp file alongside the PDF
            png_path = pdf_path.with_suffix(".png")
            first_page.save(str(png_path), "PNG")

            return png_path

        except ConversionError:
            raise
        except Exception as e:
            raise ConversionError(f"Gagal mengkonversi PDF ke PNG: {e}")
        finally:
            # Clean up intermediate PDF if it was created in a temp location
            # Only clean up if the PDF is not the same as the input docx directory
            # (the caller is responsible for overall cleanup)
            pass

    def is_available(self) -> bool:
        """
        Cek apakah LibreOffice terinstall dan dapat diakses.

        Returns:
            True jika LibreOffice tersedia (exit code 0), False jika tidak.
        """
        try:
            result = subprocess.run(
                ["libreoffice", "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=5,
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
            return False
