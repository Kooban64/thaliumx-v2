"""
QuantLib Financial Service
Advanced financial calculations and risk management
"""

import os
import logging
import time
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import structlog
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

from src.api.pricing import router as pricing_router
from src.api.risk import router as risk_router
from src.api.analytics import router as analytics_router
from src.utils.logger import setup_logging
from src.utils.metrics import setup_metrics, REQUEST_COUNT, REQUEST_DURATION

# Setup structured logging
setup_logging()
logger = structlog.get_logger()

# Prometheus metrics will be initialized in utils/metrics.py

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    logger.info("QuantLib service starting up")
    setup_metrics()
    yield
    logger.info("QuantLib service shutting down")

app = FastAPI(
    title="QuantLib Financial Service",
    description="Advanced financial calculations, pricing models, and risk management",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    start_time = time.time()
    
    # Log request
    logger.info(
        "Request received",
        method=request.method,
        url=str(request.url),
        client_ip=request.client.host if request.client else None
    )
    
    response = await call_next(request)
    
    # Calculate duration
    duration = time.time() - start_time
    REQUEST_DURATION.labels(method=request.method, endpoint=request.url.path).observe(duration)
    REQUEST_COUNT.labels(method=request.method, endpoint=request.url.path, status=response.status_code).inc()
    
    # Log response
    logger.info(
        "Request completed",
        method=request.method,
        url=str(request.url),
        status_code=response.status_code,
        duration=duration
    )
    
    return response

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "quantlib-svc",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

# Metrics endpoint
@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

# Include routers
app.include_router(pricing_router, prefix="/v1/pricing", tags=["Pricing"])
app.include_router(risk_router, prefix="/v1/risk", tags=["Risk Management"])
app.include_router(analytics_router, prefix="/v1/analytics", tags=["Analytics"])

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "QuantLib Financial Service",
        "version": "1.0.0",
        "description": "Advanced financial calculations and risk management",
        "endpoints": {
            "health": "/health",
            "metrics": "/metrics",
            "pricing": "/v1/pricing",
            "risk": "/v1/risk",
            "analytics": "/v1/analytics"
        }
    }

if __name__ == "__main__":
    import uvicorn
    import time
    from datetime import datetime
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=3010,
        reload=True,
        log_level="info"
    )
