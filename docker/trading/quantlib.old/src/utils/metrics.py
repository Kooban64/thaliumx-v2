"""
Prometheus metrics setup for QuantLib service
"""

from prometheus_client import Counter, Histogram, Gauge, Info
import time

# Request metrics
REQUEST_COUNT = Counter(
    'quantlib_requests_total', 
    'Total number of requests',
    ['method', 'endpoint', 'status']
)

REQUEST_DURATION = Histogram(
    'quantlib_request_duration_seconds',
    'Request duration in seconds',
    ['method', 'endpoint']
)

# Business metrics
OPTIONS_PRICED = Counter(
    'quantlib_options_priced_total',
    'Total number of options priced',
    ['option_type', 'model']
)

VAR_CALCULATED = Counter(
    'quantlib_var_calculated_total',
    'Total number of VaR calculations',
    ['method', 'confidence_level']
)

YIELD_CURVES_CONSTRUCTED = Counter(
    'quantlib_yield_curves_constructed_total',
    'Total number of yield curves constructed',
    ['method']
)

# Performance metrics
CALCULATION_DURATION = Histogram(
    'quantlib_calculation_duration_seconds',
    'Calculation duration in seconds',
    ['calculation_type']
)

# Service info
SERVICE_INFO = Info(
    'quantlib_service_info',
    'QuantLib service information'
)

def setup_metrics():
    """Initialize service metrics"""
    SERVICE_INFO.info({
        'version': '1.0.0',
        'service': 'quantlib-svc',
        'description': 'QuantLib Financial Service'
    })

def record_calculation(calculation_type: str, duration: float):
    """Record calculation metrics"""
    CALCULATION_DURATION.labels(calculation_type=calculation_type).observe(duration)

def record_option_pricing(option_type: str, model: str):
    """Record option pricing metrics"""
    OPTIONS_PRICED.labels(option_type=option_type, model=model).inc()

def record_var_calculation(method: str, confidence_level: float):
    """Record VaR calculation metrics"""
    VAR_CALCULATED.labels(method=method, confidence_level=str(confidence_level)).inc()

def record_yield_curve_construction(method: str):
    """Record yield curve construction metrics"""
    YIELD_CURVES_CONSTRUCTED.labels(method=method).inc()
