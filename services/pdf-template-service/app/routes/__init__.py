"""PDF Template Service - Routes package."""

from app.routes.health import router as health_router
from app.routes.preview import router as preview_router
from app.routes.render import router as render_router
from app.routes.upload import router as upload_router

__all__ = ["health_router", "preview_router", "render_router", "upload_router"]
