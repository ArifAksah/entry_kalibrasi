"""Health check endpoint."""

from fastapi import APIRouter, Request

from app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request) -> HealthResponse:
    """Cek status service dan ketersediaan LibreOffice."""
    libreoffice_available: bool = getattr(
        request.app.state, "libreoffice_available", False
    )
    return HealthResponse(
        status="ok",
        version="1.0.0",
        libreoffice_available=libreoffice_available,
    )
