"""Preview template endpoint — GET /preview-template."""

import logging
import re
from pathlib import Path

from fastapi import APIRouter, Query, Request
from fastapi.responses import Response

from app.config import settings
from app.exceptions import (
    ConversionError,
    LibreOfficeUnavailableError,
    TemplateNotFoundError,
    ValidationError,
)
from app.models.schemas import SectionEnum
from app.services.pdf_converter import PDFConverter
from app.services.preview_cache import PreviewCache

logger = logging.getLogger(__name__)

router = APIRouter(tags=["preview"])

# Regex untuk validasi template_id: alfanumerik, hyphen, underscore, 1-100 karakter
TEMPLATE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,100}$")

# Cache directory relatif terhadap template dir
CACHE_DIR = Path("./cache")


@router.get("/preview-template")
async def preview_template(
    request: Request,
    template_id: str = Query(..., description="ID template"),
    section: SectionEnum = Query(..., description="Section: cover atau results"),
) -> Response:
    """
    Generate preview PNG dari halaman pertama template.

    Logic:
    1. Validasi query params (template_id format, section value)
    2. Cek ketersediaan LibreOffice → 503 jika tidak tersedia
    3. Cek apakah template ada → 404 jika tidak
    4. Cek preview cache → return cached PNG jika valid
    5. Jika cache miss: konversi .docx ke PNG via PDFConverter.convert_to_png()
    6. Simpan hasil ke cache
    7. Return Response dengan content_type="image/png"
    """
    # 1. Validasi template_id format
    if not TEMPLATE_ID_PATTERN.match(template_id):
        raise ValidationError(
            "Format template_id tidak valid. "
            "Hanya alfanumerik, hyphen, dan underscore (1-100 karakter).",
            field="template_id",
        )

    # 2. Cek ketersediaan LibreOffice
    libreoffice_available = getattr(request.app.state, "libreoffice_available", False)
    if not libreoffice_available:
        raise LibreOfficeUnavailableError()

    # 3. Cek apakah template ada
    template_path = settings.pdf_template_dir / template_id / f"{section.value}.docx"
    if not template_path.is_file():
        raise TemplateNotFoundError(template_id, section.value)

    # 4. Cek preview cache
    cache = PreviewCache(CACHE_DIR)
    cached_preview = cache.get(template_path)

    if cached_preview is not None:
        logger.info(
            "Preview cache hit untuk template '%s' section '%s'",
            template_id,
            section.value,
        )
        png_bytes = cached_preview.read_bytes()
        return Response(content=png_bytes, media_type="image/png")

    # 5. Cache miss: generate preview PNG
    logger.info(
        "Preview cache miss untuk template '%s' section '%s', generating...",
        template_id,
        section.value,
    )

    converter = PDFConverter()

    try:
        png_path = await converter.convert_to_png(template_path)
    except ConversionError:
        raise
    except Exception as e:
        logger.error(
            "Gagal menggenerate preview untuk template '%s' section '%s': %s",
            template_id,
            section.value,
            e,
        )
        raise ConversionError(f"Gagal menggenerate preview template: {e}")

    try:
        # 6. Simpan ke cache
        cache.put(template_path, png_path)

        # 7. Return PNG response
        png_bytes = png_path.read_bytes()
        return Response(content=png_bytes, media_type="image/png")
    finally:
        # Cleanup temporary PNG file (cache sudah menyimpan salinannya)
        try:
            if png_path.exists():
                png_path.unlink(missing_ok=True)
            # Also cleanup intermediate PDF if it exists
            pdf_path = png_path.with_suffix(".pdf")
            if pdf_path.exists():
                pdf_path.unlink(missing_ok=True)
        except OSError as e:
            logger.warning("Gagal menghapus temp file: %s", e)
