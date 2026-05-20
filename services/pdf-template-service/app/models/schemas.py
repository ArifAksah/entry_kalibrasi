"""Pydantic request/response models untuk PDF Template Service."""

from enum import Enum

from pydantic import BaseModel, Field


class SectionEnum(str, Enum):
    """Enum untuk section template sertifikat."""

    cover = "cover"
    results = "results"


class UploadResponse(BaseModel):
    """Response model untuk POST /upload-template."""

    path: str
    size_bytes: int
    variables: list[str]
    loops: list[str]


class RenderRequest(BaseModel):
    """Request model untuk POST /render-pdf."""

    template_id: str = Field(..., min_length=1)
    data: dict


class HealthResponse(BaseModel):
    """Response model untuk GET /health."""

    status: str
    version: str
    libreoffice_available: bool


class ErrorResponse(BaseModel):
    """Response model untuk error responses."""

    detail: str
    code: str
    field: str | None = None
