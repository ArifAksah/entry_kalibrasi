"""Render PDF endpoint — POST /render-pdf."""

import asyncio
import logging
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import Response

from app.config import settings
from app.exceptions import (
    ConversionError,
    LibreOfficeUnavailableError,
    TemplateNotFoundError,
)
from app.models.schemas import RenderRequest
from app.services.pdf_converter import PDFConverter
from app.services.pdf_merger import PDFMerger
from app.services.template_renderer import TemplateRenderer

logger = logging.getLogger(__name__)

router = APIRouter(tags=["render"])

RENDER_TIMEOUT_SECONDS = 60


@router.post("/render-pdf")
async def render_pdf(body: RenderRequest, request: Request) -> Response:
    """
    Render template .docx dengan data dan kembalikan PDF.

    Logic:
    1. Cek ketersediaan LibreOffice → 503 jika tidak tersedia
    2. Cek apakah template ada → 404 jika tidak
    3. Tentukan section mana yang ada (cover, results, atau keduanya)
    4. Untuk setiap section: render template dengan data, lalu konversi ke PDF
    5. Jika kedua section ada: merge PDF (cover dulu, lalu results)
    6. Jika hanya satu section: return PDF tersebut langsung
    7. Return Response dengan content_type="application/pdf"
    8. Cleanup semua temp files di finally block
    """
    # 1. Cek ketersediaan LibreOffice
    libreoffice_available = getattr(request.app.state, "libreoffice_available", False)
    if not libreoffice_available:
        raise LibreOfficeUnavailableError()

    # 2. Inisialisasi services
    renderer = TemplateRenderer(settings.pdf_template_dir)
    converter = PDFConverter()
    merger = PDFMerger()

    # 3. Cek apakah template ada (setidaknya satu section)
    template_id = body.template_id
    data = body.data

    if not renderer.template_exists(template_id):
        raise TemplateNotFoundError(template_id)

    # 4. Tentukan section mana yang ada
    has_cover = renderer.template_exists(template_id, "cover")
    has_results = renderer.template_exists(template_id, "results")

    # Track temp files untuk cleanup
    temp_files: list[Path] = []

    try:
        # Wrap seluruh proses dalam timeout 60 detik
        pdf_bytes = await asyncio.wait_for(
            _render_and_convert(
                renderer=renderer,
                converter=converter,
                merger=merger,
                template_id=template_id,
                data=data,
                has_cover=has_cover,
                has_results=has_results,
                temp_files=temp_files,
            ),
            timeout=RENDER_TIMEOUT_SECONDS,
        )

        return Response(content=pdf_bytes, media_type="application/pdf")

    except asyncio.TimeoutError:
        logger.error(
            "Render timeout setelah %d detik untuk template '%s'",
            RENDER_TIMEOUT_SECONDS,
            template_id,
        )
        raise ConversionError(
            f"Render timeout setelah {RENDER_TIMEOUT_SECONDS} detik"
        )
    finally:
        # 8. Cleanup semua temp files
        for f in temp_files:
            try:
                f.unlink(missing_ok=True)
            except OSError as e:
                logger.warning("Gagal menghapus temp file %s: %s", f, e)


async def _render_and_convert(
    renderer: TemplateRenderer,
    converter: PDFConverter,
    merger: PDFMerger,
    template_id: str,
    data: dict,
    has_cover: bool,
    has_results: bool,
    temp_files: list[Path],
) -> bytes:
    """
    Internal helper: render template sections, convert to PDF, merge if needed.

    Returns:
        PDF bytes dari hasil render.
    """
    pdf_paths: list[Path] = []

    # Render dan konversi setiap section yang ada
    if has_cover:
        cover_pdf = await _render_section(
            renderer, converter, template_id, "cover", data, temp_files
        )
        pdf_paths.append(cover_pdf)

    if has_results:
        results_pdf = await _render_section(
            renderer, converter, template_id, "results", data, temp_files
        )
        pdf_paths.append(results_pdf)

    # Merge jika kedua section ada, atau gunakan PDF tunggal
    if len(pdf_paths) > 1:
        merged_path = merger.merge(pdf_paths)
        # Hanya track merged file jika berbeda dari input (merger returns input jika hanya 1)
        if merged_path not in pdf_paths:
            temp_files.append(merged_path)
        final_pdf_path = merged_path
    else:
        final_pdf_path = pdf_paths[0]

    # Baca PDF bytes
    pdf_bytes = final_pdf_path.read_bytes()

    return pdf_bytes


async def _render_section(
    renderer: TemplateRenderer,
    converter: PDFConverter,
    template_id: str,
    section: str,
    data: dict,
    temp_files: list[Path],
) -> Path:
    """
    Render satu section template dan konversi ke PDF.

    Args:
        renderer: TemplateRenderer instance.
        converter: PDFConverter instance.
        template_id: ID template.
        section: Nama section ("cover" atau "results").
        data: Data untuk mengisi template.
        temp_files: List untuk tracking temp files (akan di-cleanup).

    Returns:
        Path ke file PDF hasil konversi.
    """
    # Render template → filled .docx
    filled_docx = renderer.render(template_id, section, data)
    temp_files.append(filled_docx)

    # Konversi filled .docx → PDF
    pdf_path = await converter.convert(filled_docx)
    temp_files.append(pdf_path)

    return pdf_path
