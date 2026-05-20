"""FastAPI application entry point untuk PDF Template Service."""

import asyncio
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.exceptions import TemplateServiceError
from app.routes import health, preview, render, upload

logger = logging.getLogger(__name__)

app = FastAPI(
    title="PDF Template Service",
    version="1.0.0",
    description="Microservice untuk rendering template .docx ke PDF",
)

# CORS middleware configuration
cors_origins = settings.cors_origins_list
if not cors_origins:
    logger.warning(
        "CORS origins belum dikonfigurasi. Cross-origin requests akan ditolak."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# Global exception handler for TemplateServiceError
@app.exception_handler(TemplateServiceError)
async def template_service_error_handler(
    request: Request, exc: TemplateServiceError
) -> JSONResponse:
    """Handle semua TemplateServiceError dan kembalikan JSON response."""
    content: dict = {
        "detail": exc.message,
        "code": exc.code,
    }
    if hasattr(exc, "field") and exc.field:
        content["field"] = exc.field
    return JSONResponse(status_code=exc.status_code, content=content)


# Startup event: cek ketersediaan LibreOffice
@app.on_event("startup")
async def startup_event() -> None:
    """Cek ketersediaan LibreOffice saat startup."""
    import shutil

    libreoffice_available = False
    soffice_path = shutil.which("soffice")

    if soffice_path:
        # soffice binary found, try a quick headless check
        try:
            process = await asyncio.create_subprocess_exec(
                "soffice", "--headless", "--invisible", "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(process.communicate(), timeout=10.0)
            libreoffice_available = process.returncode == 0
            if libreoffice_available:
                version_info = stdout.decode().strip()
                logger.info("LibreOffice terdeteksi: %s", version_info)
        except (asyncio.TimeoutError, OSError):
            # --version hangs in some containers, but binary exists so assume available
            libreoffice_available = True
            logger.info("LibreOffice binary ditemukan di %s (version check timeout, assuming available)", soffice_path)
    else:
        libreoffice_available = False

    app.state.libreoffice_available = libreoffice_available

    if not libreoffice_available:
        logger.warning(
            "LibreOffice TIDAK terdeteksi. "
            "Endpoint render dan preview tidak akan berfungsi."
        )


# Register route modules
app.include_router(health.router)
app.include_router(upload.router)
app.include_router(render.router)
app.include_router(preview.router)
