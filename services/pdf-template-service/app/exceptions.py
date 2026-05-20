"""Custom exception classes untuk PDF Template Service."""


class TemplateServiceError(Exception):
    """Base exception untuk PDF Template Service."""

    def __init__(self, message: str, code: str, status_code: int = 500):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


class ValidationError(TemplateServiceError):
    """Error validasi input (400)."""

    def __init__(self, message: str, field: str = None):
        super().__init__(message, "VALIDATION_ERROR", 400)
        self.field = field


class TemplateNotFoundError(TemplateServiceError):
    """Template tidak ditemukan (404)."""

    def __init__(self, template_id: str, section: str = None):
        msg = f"Template '{template_id}' tidak ditemukan"
        if section:
            msg += f" (section: {section})"
        super().__init__(msg, "TEMPLATE_NOT_FOUND", 404)
        self.template_id = template_id
        self.section = section


class ConversionError(TemplateServiceError):
    """LibreOffice gagal konversi (500)."""

    def __init__(self, detail: str = None):
        msg = "Gagal mengkonversi dokumen ke PDF"
        if detail:
            msg += f": {detail}"
        super().__init__(msg, "CONVERSION_ERROR", 500)


class LibreOfficeUnavailableError(TemplateServiceError):
    """LibreOffice tidak tersedia (503)."""

    def __init__(self):
        super().__init__(
            "LibreOffice tidak tersedia. Service tidak dapat mengkonversi dokumen.",
            "LIBREOFFICE_UNAVAILABLE",
            503,
        )
