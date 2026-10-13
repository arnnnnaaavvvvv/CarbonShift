# Multi-Stage Production Full-Stack Dockerfile for CarbonShift
# Stage 1: Frontend Build (React + TypeScript + Vite)
FROM node:20-alpine AS frontend-builder
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: Python Backend Build & Dependencies
FROM python:3.11-slim AS python-builder
WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt pyproject.toml ./
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 3: Runtime Minimal Image
FROM python:3.11-slim AS runtime

# Create non-root system user with explicit UID/GID
RUN groupadd -g 10001 carbonshift && \
    useradd -u 10001 -g carbonshift -m -s /bin/bash carbonshift

WORKDIR /app

# Copy installed python dependencies from python-builder
COPY --from=python-builder /root/.local /home/carbonshift/.local
ENV PATH=/home/carbonshift/.local/bin:$PATH

# Copy built frontend SPA assets from frontend-builder
COPY --from=frontend-builder --chown=carbonshift:carbonshift /web/dist /app/web/dist

# Copy backend source code and configuration
COPY --chown=carbonshift:carbonshift src/ ./src/
COPY --chown=carbonshift:carbonshift config/ ./config/
COPY --chown=carbonshift:carbonshift pyproject.toml ./

# Install application package in user space
RUN pip install --no-cache-dir --user -e .

# Security: drop privileges to non-root user
USER 10001:10001

EXPOSE 8000

# Container health probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz')" || exit 1

CMD ["uvicorn", "carbonshift.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
