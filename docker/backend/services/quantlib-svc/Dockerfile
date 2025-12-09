FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for QuantLib
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libboost-all-dev \
    libgmp-dev \
    libmpfr-dev \
    libeigen3-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/
COPY openapi.yaml ./

# Create non-root user
RUN groupadd -r quantlib && useradd -r -g quantlib quantlib

# Create directories for model storage and cache
RUN mkdir -p /app/cache /app/models /app/data && \
    chown -R quantlib:quantlib /app

# Change ownership
RUN chown -R quantlib:quantlib /app
USER quantlib

# Expose port
EXPOSE 3010

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3010/health || exit 1

# Start the application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3010"]
