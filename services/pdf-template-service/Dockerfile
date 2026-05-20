FROM python:3.12-slim

# Install system dependencies: LibreOffice headless and poppler-utils (for pdf2image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-calc \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create runtime directories for templates and preview cache
RUN mkdir -p /app/templates /app/cache

# Set environment variables
ENV PDF_SERVICE_PORT=8000
ENV PDF_TEMPLATE_DIR=/app/templates
ENV PDF_CORS_ORIGINS=""

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
