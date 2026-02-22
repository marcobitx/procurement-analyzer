# backend/Dockerfile
# Multi-stage Docker build for Railway deployment using uv package manager
# Uses CPU-only PyTorch to keep image under 4GB Railway limit

# --- Stage 1: Build ---
FROM python:3.13-slim AS builder

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy dependency files first (better caching)
COPY pyproject.toml uv.lock ./

# Install CPU-only PyTorch first (saves ~1.8GB vs CUDA version)
RUN uv venv && \
    uv pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies (skips torch since already installed)
RUN uv sync --frozen --no-dev --no-install-project

# Copy application code
COPY . .

# Install the project itself
RUN uv sync --frozen --no-dev

# Clean up caches to reduce image size
RUN rm -rf /root/.cache /app/.venv/lib/python*/site-packages/torch/test \
    /app/.venv/lib/python*/site-packages/torch/include \
    /app/.venv/lib/python*/site-packages/torch/share

# --- Stage 2: Runtime ---
FROM python:3.13-slim AS runtime

WORKDIR /app

# Copy only the virtual environment and source code from builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/app ./app
COPY --from=builder /app/pyproject.toml ./

# Add .venv to PATH
ENV PATH="/app/.venv/bin:$PATH"

# Create temp directory for file processing
RUN mkdir -p /tmp/foxdoc

# Railway sets PORT env var
ENV PORT=8000

EXPOSE ${PORT}

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
