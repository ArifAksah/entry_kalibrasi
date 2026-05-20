"""Upload template endpoint — POST /upload-template."""

import re
from pathlib import Path

from fastapi import APIRouter, Form, UploadFile

from app.config import settings
from app.exceptions import ValidationError
from app.models.schemas import SectionEnum, UploadResponse
from app.services.variable_detector import detect_variables

router = APIRouter(tags=["upload"])

# Regex untuk validasi template_id: alfanumerik, hyphen, underscore, 1-100 karakter
_TEMPLATE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,100}$")

# Batas ukuran file: 10MB
_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB in bytes


@router.post("/upload-template", status_code=201, response_model=UploadResponse)
async def upload_template(
    file: UploadFile,
    template_id: str = Form(...),
    section: SectionEnum = Form(...),
) -> UploadResponse:
    """Upload file .docx template ke filesystem.

    Menerima file .docx via multipart form data, memvalidasi format dan ukuran,
    menyimpan ke Template_Storage, lalu mendeteksi variabel Jinja2 dalam dokumen.

    Args:
        file: File .docx yang diupload.
        template_id: ID template (alfanumerik, hyphen, underscore, max 100 char).
        section: Section template ("cover" atau "results").

    Returns:
        UploadResponse berisi path, size_bytes, variables, dan loops.

    Raises:
        ValidationError: Jika file bukan .docx, ukuran >10MB, atau template_id invalid.
    """
    # Validasi template_id format
    if not _TEMPLATE_ID_PATTERN.match(template_id):
        raise ValidationError(
            "Format template_id tidak valid. Gunakan hanya alfanumerik, hyphen, atau underscore (maks 100 karakter).",
            field="template_id",
        )

    # Validasi file extension (.docx)
    filename = file.filename or ""
    if not filename.lower().endswith(".docx"):
        raise ValidationError(
            "Format file tidak didukung. Gunakan file .docx",
            field="file",
        )

    # Baca isi file
    content = await file.read()

    # Validasi ukuran file (≤ 10MB)
    if len(content) > _MAX_FILE_SIZE:
        raise ValidationError(
            "Ukuran file melebihi batas maksimal 10MB",
            field="file",
        )

    # Tentukan path penyimpanan: {template_dir}/{template_id}/{section}.docx
    template_dir: Path = settings.pdf_template_dir
    target_dir = template_dir / template_id
    target_dir.mkdir(parents=True, exist_ok=True)

    target_path = target_dir / f"{section.value}.docx"

    # Simpan file (overwrite jika sudah ada)
    target_path.write_bytes(content)

    # Deteksi variabel dan loop dalam dokumen
    variables, loops = detect_variables(target_path)

    # Path relatif untuk response
    relative_path = f"{template_id}/{section.value}.docx"

    return UploadResponse(
        path=relative_path,
        size_bytes=len(content),
        variables=variables,
        loops=loops,
    )
