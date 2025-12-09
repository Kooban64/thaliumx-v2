"""
Risk Management API Endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import structlog

from src.risk.var_calculator import VaRCalculator

logger = structlog.get_logger()
router = APIRouter()

# Pydantic models
class VaRRequest(BaseModel):
    returns: List[float] = Field(..., description="Historical returns")
    confidence_level: float = Field(default=0.05, ge=0.01, le=0.5, description="VaR confidence level")
    method: Literal['historical', 'parametric', 'monte_carlo'] = Field(default='historical', description="VaR calculation method")
    time_horizon: int = Field(default=1, ge=1, description="Time horizon in days")
    portfolio_value: float = Field(default=1.0, gt=0, description="Portfolio value")

class PortfolioVaRRequest(BaseModel):
    portfolio_weights: List[float] = Field(..., description="Portfolio weights")
    asset_returns: List[List[float]] = Field(..., description="Asset returns matrix")
    confidence_level: float = Field(default=0.05, ge=0.01, le=0.5, description="VaR confidence level")
    time_horizon: int = Field(default=1, ge=1, description="Time horizon in days")
    portfolio_value: float = Field(default=1.0, gt=0, description="Portfolio value")

class VaRResponse(BaseModel):
    var_absolute: float
    var_relative: float
    expected_shortfall: float
    confidence_level: float
    time_horizon: int
    method: str
    portfolio_value: float
    statistics: dict

@router.post("/var/calculate", response_model=VaRResponse)
async def calculate_var(request: VaRRequest):
    """
    Calculate Value at Risk (VaR) for a portfolio
    """
    try:
        calculator = VaRCalculator()
        result = calculator.calculate_var(
            returns=request.returns,
            confidence_level=request.confidence_level,
            method=request.method,
            time_horizon=request.time_horizon,
            portfolio_value=request.portfolio_value
        )
        
        logger.info("VaR calculated successfully", 
                   method=request.method,
                   confidence_level=request.confidence_level)
        
        return VaRResponse(**result)
        
    except Exception as e:
        logger.error("VaR calculation failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/var/portfolio", response_model=dict)
async def calculate_portfolio_var(request: PortfolioVaRRequest):
    """
    Calculate portfolio VaR using correlation matrix
    """
    try:
        calculator = VaRCalculator()
        result = calculator.calculate_portfolio_var(
            portfolio_weights=request.portfolio_weights,
            asset_returns=request.asset_returns,
            confidence_level=request.confidence_level,
            time_horizon=request.time_horizon,
            portfolio_value=request.portfolio_value
        )
        
        logger.info("Portfolio VaR calculated successfully", 
                   portfolio_value=request.portfolio_value,
                   num_assets=len(request.portfolio_weights))
        
        return result
        
    except Exception as e:
        logger.error("Portfolio VaR calculation failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/var/methods")
async def get_var_methods():
    """
    Get available VaR calculation methods
    """
    return {
        "methods": [
            {
                "name": "historical",
                "description": "Historical simulation method",
                "advantages": ["No distribution assumptions", "Captures fat tails"],
                "disadvantages": ["Requires sufficient history", "May not reflect current market conditions"]
            },
            {
                "name": "parametric",
                "description": "Parametric (Normal distribution) method",
                "advantages": ["Fast calculation", "Simple implementation"],
                "disadvantages": ["Assumes normal distribution", "May underestimate tail risk"]
            },
            {
                "name": "monte_carlo",
                "description": "Monte Carlo simulation method",
                "advantages": ["Flexible distribution assumptions", "Can model complex dependencies"],
                "disadvantages": ["Computationally intensive", "Requires model specification"]
            }
        ]
    }
