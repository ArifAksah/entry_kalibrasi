# PDF Template Service

Microservice Python FastAPI untuk rendering template .docx ke PDF. Service ini menggantikan pipeline konversi DOCX→HTML→PDF berbasis mammoth.js + Playwright dengan pendekatan yang lebih reliable menggunakan **docxtpl** dan **LibreOffice headless**.

## Fitur

- Upload template .docx dengan deteksi variabel otomatis
- Render template dengan data (Jinja2-style variables)
- Konversi ke PDF via LibreOffice headless
- Merge multiple PDF sections (cover + results)
- Preview template sebagai PNG
- Cache preview berdasarkan file modification time

## Tech Stack

- **FastAPI** — Web framework
- **docxtpl** — Template rendering (Jinja2 syntax dalam .docx)
- **LibreOffice headless** — Konversi .docx → PDF
- **PyPDF2** — Merge PDF files
- **pdf2image + Pillow** — Generate preview PNG
- **pydantic-settings** — Configuration management

## Quick Start

### Prerequisites

- Python 3.12+
- LibreOffice (untuk konversi PDF)
- poppler-utils (untuk pdf2image)

### Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Copy environment config
cp .env.example .env

# Run service
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Docker

```bash
docker-compose up --build
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + LibreOffice status |
| POST | `/upload-template` | Upload file .docx template |
| POST | `/render-pdf` | Render template → PDF |
| GET | `/preview-template` | Preview template sebagai PNG |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PDF_SERVICE_PORT` | `8000` | Port server (1024-65535) |
| `PDF_TEMPLATE_DIR` | `./templates/` | Direktori penyimpanan template |
| `PDF_CORS_ORIGINS` | _(empty)_ | Allowed CORS origins (comma-separated) |

## Testing

```bash
# Install test dependencies
pip install pytest pytest-asyncio hypothesis httpx

# Run all tests (excluding integration)
pytest -m "not integration"

# Run all tests including integration (requires LibreOffice)
pytest
```

## Project Structure

```
services/pdf-template-service/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI entry point
│   ├── config.py            # Settings (env vars)
│   ├── exceptions.py        # Custom exceptions
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── health.py        # GET /health
│   │   ├── upload.py        # POST /upload-template
│   │   ├── render.py        # POST /render-pdf
│   │   └── preview.py       # GET /preview-template
│   ├── services/
│   │   ├── __init__.py
│   │   ├── template_renderer.py
│   │   ├── pdf_converter.py
│   │   ├── pdf_merger.py
│   │   ├── preview_cache.py
│   │   └── variable_detector.py
│   └── models/
│       ├── __init__.py
│       └── schemas.py        # Pydantic models
├── tests/
│   ├── __init__.py
│   └── ...
├── templates/                # Template storage (runtime)
├── cache/                    # Preview cache (runtime)
├── requirements.txt
├── pyproject.toml
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```
