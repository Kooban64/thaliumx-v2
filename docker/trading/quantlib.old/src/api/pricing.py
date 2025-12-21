"""
Pricing API Endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Literal
import structlog

from src.pricing.black_scholes import BlackScholesPricer

logger = structlog.get_logger()
router = APIRouter()

# Pydantic models for request/response
class OptionPricingRequest(BaseModel):
    spot_price: float = Field(..., gt=0, description="Current asset price")
    strike_price: float = Field(..., gt=0, description="Option strike price")
    risk_free_rate: float = Field(..., ge=0, description="Risk-free interest rate")
    volatility: float = Field(..., gt=0, description="Asset volatility")
    time_to_maturity: float = Field(..., gt=0, description="Time to expiration in years")
    option_type: Literal['call', 'put'] = Field(..., description="Option type")
    
class AmericanOptionPricingRequest(OptionPricingRequest):
    steps: int = Field(default=100, ge=10, le=1000, description="Number of binomial tree steps")

class OptionPricingResponse(BaseModel):
    option_price: float
    delta: float
    gamma: float
    theta: float
    vega: float
    rho: float
    implied_volatility: Optional[float] = None
    parameters: dict

@router.post("/options/black-scholes", response_model=OptionPricingResponse)
async def price_european_option(request: OptionPricingRequest):
    """
    Price European option using Black-Scholes formula
    """
    try:
        pricer = BlackScholesPricer()
        result = pricer.price_option(
            spot_price=request.spot_price,
            strike_price=request.strike_price,
            risk_free_rate=request.risk_free_rate,
            volatility=request.volatility,
            time_to_maturity=request.time_to_maturity,
            option_type=request.option_type
        )
        
        logger.info("European option priced successfully", 
                   spot_price=request.spot_price,
                   strike_price=request.strike_price,
                   option_type=request.option_type)
        
        return OptionPricingResponse(**result)
        
    except Exception as e:
        logger.error("European option pricing failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/options/american", response_model=OptionPricingResponse)
async def price_american_option(request: AmericanOptionPricingRequest):
    """
    Price American option using Binomial tree
    """
    try:
        pricer = BlackScholesPricer()
        result = pricer.price_american_option(
            spot_price=request.spot_price,
            strike_price=request.strike_price,
            risk_free_rate=request.risk_free_rate,
            volatility=request.volatility,
            time_to_maturity=request.time_to_maturity,
            option_type=request.option_type,
            steps=request.steps
        )
        
        logger.info("American option priced successfully", 
                   spot_price=request.spot_price,
                   strike_price=request.strike_price,
                   option_type=request.option_type)
        
        return OptionPricingResponse(**result)
        
    except Exception as e:
        logger.error("American option pricing failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/options/greeks")
async def calculate_greeks(
    spot_price: float,
    strike_price: float,
    risk_free_rate: float,
    volatility: float,
    time_to_maturity: float,
    option_type: Literal['call', 'put'] = 'call'
):
    """
    Calculate option Greeks (Delta, Gamma, Theta, Vega, Rho)
    """
    try:
        pricer = BlackScholesPricer()
        result = pricer.price_option(
            spot_price=spot_price,
            strike_price=strike_price,
            risk_free_rate=risk_free_rate,
            volatility=volatility,
            time_to_maturity=time_to_maturity,
            option_type=option_type
        )
        
        greeks = {
            'delta': result['delta'],
            'gamma': result['gamma'],
            'theta': result['theta'],
            'vega': result['vega'],
            'rho': result['rho']
        }
        
        logger.info("Greeks calculated successfully", **greeks)
        return greeks
        
    except Exception as e:
        logger.error("Greeks calculation failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
