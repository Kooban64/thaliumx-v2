"""
Analytics API Endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Tuple
import structlog

from src.analytics.yield_curves import YieldCurveAnalyzer

logger = structlog.get_logger()
router = APIRouter()

# Pydantic models
class YieldCurveRequest(BaseModel):
    maturities: List[float] = Field(..., description="Maturities in years")
    yields: List[float] = Field(..., description="Corresponding yields")
    method: str = Field(default='cubic', description="Interpolation method")

class ForwardRatesRequest(BaseModel):
    maturities: List[float] = Field(..., description="Maturities in years")
    yields: List[float] = Field(..., description="Corresponding yields")
    forward_periods: Optional[List[Tuple[float, float]]] = Field(None, description="Forward rate periods")

class ZeroCurveRequest(BaseModel):
    market_rates: List[float] = Field(..., description="Market rates")
    maturities: List[float] = Field(..., description="Maturities in years")
    frequency: int = Field(default=2, description="Payment frequency per year")

@router.post("/yield-curves/construct")
async def construct_yield_curve(request: YieldCurveRequest):
    """
    Construct yield curve from market data
    """
    try:
        analyzer = YieldCurveAnalyzer()
        result = analyzer.construct_yield_curve(
            maturities=request.maturities,
            yields=request.yields,
            method=request.method
        )
        
        logger.info("Yield curve constructed successfully", 
                   method=request.method,
                   data_points=len(request.maturities))
        
        return result
        
    except Exception as e:
        logger.error("Yield curve construction failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/yield-curves/forward-rates")
async def calculate_forward_rates(request: ForwardRatesRequest):
    """
    Calculate forward rates from yield curve
    """
    try:
        analyzer = YieldCurveAnalyzer()
        result = analyzer.calculate_forward_rates(
            maturities=request.maturities,
            yields=request.yields,
            forward_periods=request.forward_periods
        )
        
        logger.info("Forward rates calculated successfully", 
                   num_rates=len(result['forward_rates']))
        
        return result
        
    except Exception as e:
        logger.error("Forward rates calculation failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/yield-curves/bootstrap-zero")
async def bootstrap_zero_curve(request: ZeroCurveRequest):
    """
    Bootstrap zero-coupon yield curve from market rates
    """
    try:
        analyzer = YieldCurveAnalyzer()
        result = analyzer.bootstrap_zero_curve(
            market_rates=request.market_rates,
            maturities=request.maturities,
            frequency=request.frequency
        )
        
        logger.info("Zero curve bootstrapped successfully", 
                   num_points=len(request.maturities))
        
        return result
        
    except Exception as e:
        logger.error("Zero curve bootstrapping failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/yield-curves/methods")
async def get_interpolation_methods():
    """
    Get available interpolation methods for yield curves
    """
    return {
        "methods": [
            {
                "name": "linear",
                "description": "Linear interpolation",
                "advantages": ["Simple", "Fast"],
                "disadvantages": ["Not smooth", "May create kinks"]
            },
            {
                "name": "cubic",
                "description": "Cubic spline interpolation",
                "advantages": ["Smooth", "Good for most cases"],
                "disadvantages": ["May overshoot", "Sensitive to outliers"]
            },
            {
                "name": "spline",
                "description": "Smoothing spline interpolation",
                "advantages": ["Very smooth", "Handles noise well"],
                "disadvantages": ["May not pass through all points", "Computationally intensive"]
            }
        ]
    }
