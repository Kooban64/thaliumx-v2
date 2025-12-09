"""
Black-Scholes Option Pricing
"""

import QuantLib as ql
import numpy as np
from typing import Dict, Any
from datetime import datetime, date
import structlog

logger = structlog.get_logger()

class BlackScholesPricer:
    """Black-Scholes option pricing implementation"""
    
    def __init__(self):
        self.calendar = ql.TARGET()
        self.day_count = ql.Actual365Fixed()
    
    def price_option(
        self,
        spot_price: float,
        strike_price: float,
        risk_free_rate: float,
        volatility: float,
        time_to_maturity: float,
        option_type: str = 'call'
    ) -> Dict[str, Any]:
        """
        Price European option using Black-Scholes formula
        
        Args:
            spot_price: Current asset price
            strike_price: Option strike price
            risk_free_rate: Risk-free interest rate
            volatility: Asset volatility
            time_to_maturity: Time to expiration in years
            option_type: 'call' or 'put'
        
        Returns:
            Dictionary with option price and Greeks
        """
        try:
            # Set up QuantLib objects
            spot_handle = ql.QuoteHandle(ql.SimpleQuote(spot_price))
            rate_handle = ql.YieldTermStructureHandle(
                ql.FlatForward(0, self.calendar, risk_free_rate, self.day_count)
            )
            vol_handle = ql.BlackVolTermStructureHandle(
                ql.BlackConstantVol(0, self.calendar, volatility, self.day_count)
            )
            
            # Create option
            payoff = ql.PlainVanillaPayoff(
                ql.Option.Call if option_type.lower() == 'call' else ql.Option.Put,
                strike_price
            )
            
            exercise = ql.EuropeanExercise(
                self.calendar.advance(
                    ql.Date.todaysDate(),
                    int(time_to_maturity * 365),
                    ql.Days
                )
            )
            
            option = ql.VanillaOption(payoff, exercise)
            
            # Create pricing engine
            process = ql.BlackScholesMertonProcess(spot_handle, rate_handle, rate_handle, vol_handle)
            engine = ql.AnalyticEuropeanEngine(process)
            option.setPricingEngine(engine)
            
            # Calculate price and Greeks
            option_price = option.NPV()
            delta = option.delta()
            gamma = option.gamma()
            theta = option.theta()
            vega = option.vega()
            rho = option.rho()
            
            # Calculate implied volatility if needed
            implied_vol = None
            try:
                implied_vol = option.impliedVolatility(option_price, process, 1e-4, 100, 1e-7)
            except:
                pass
            
            result = {
                'option_price': float(option_price),
                'delta': float(delta),
                'gamma': float(gamma),
                'theta': float(theta),
                'vega': float(vega),
                'rho': float(rho),
                'implied_volatility': float(implied_vol) if implied_vol else None,
                'parameters': {
                    'spot_price': spot_price,
                    'strike_price': strike_price,
                    'risk_free_rate': risk_free_rate,
                    'volatility': volatility,
                    'time_to_maturity': time_to_maturity,
                    'option_type': option_type
                }
            }
            
            logger.info("Black-Scholes pricing completed", **result['parameters'])
            return result
            
        except Exception as e:
            logger.error("Black-Scholes pricing failed", error=str(e))
            raise ValueError(f"Pricing calculation failed: {str(e)}")
    
    def price_american_option(
        self,
        spot_price: float,
        strike_price: float,
        risk_free_rate: float,
        volatility: float,
        time_to_maturity: float,
        option_type: str = 'call',
        steps: int = 100
    ) -> Dict[str, Any]:
        """
        Price American option using Binomial tree
        
        Args:
            spot_price: Current asset price
            strike_price: Option strike price
            risk_free_rate: Risk-free interest rate
            volatility: Asset volatility
            time_to_maturity: Time to expiration in years
            option_type: 'call' or 'put'
            steps: Number of steps in binomial tree
        
        Returns:
            Dictionary with option price and Greeks
        """
        try:
            # Set up QuantLib objects
            spot_handle = ql.QuoteHandle(ql.SimpleQuote(spot_price))
            rate_handle = ql.YieldTermStructureHandle(
                ql.FlatForward(0, self.calendar, risk_free_rate, self.day_count)
            )
            vol_handle = ql.BlackVolTermStructureHandle(
                ql.BlackConstantVol(0, self.calendar, volatility, self.day_count)
            )
            
            # Create option
            payoff = ql.PlainVanillaPayoff(
                ql.Option.Call if option_type.lower() == 'call' else ql.Option.Put,
                strike_price
            )
            
            exercise = ql.AmericanExercise(
                ql.Date.todaysDate(),
                self.calendar.advance(
                    ql.Date.todaysDate(),
                    int(time_to_maturity * 365),
                    ql.Days
                )
            )
            
            option = ql.VanillaOption(payoff, exercise)
            
            # Create pricing engine (Binomial tree)
            process = ql.BlackScholesMertonProcess(spot_handle, rate_handle, rate_handle, vol_handle)
            engine = ql.BinomialVanillaEngine(process, 'crr', steps)
            option.setPricingEngine(engine)
            
            # Calculate price and Greeks
            option_price = option.NPV()
            delta = option.delta()
            gamma = option.gamma()
            theta = option.theta()
            vega = option.vega()
            rho = option.rho()
            
            result = {
                'option_price': float(option_price),
                'delta': float(delta),
                'gamma': float(gamma),
                'theta': float(theta),
                'vega': float(vega),
                'rho': float(rho),
                'parameters': {
                    'spot_price': spot_price,
                    'strike_price': strike_price,
                    'risk_free_rate': risk_free_rate,
                    'volatility': volatility,
                    'time_to_maturity': time_to_maturity,
                    'option_type': option_type,
                    'steps': steps
                }
            }
            
            logger.info("American option pricing completed", **result['parameters'])
            return result
            
        except Exception as e:
            logger.error("American option pricing failed", error=str(e))
            raise ValueError(f"Pricing calculation failed: {str(e)}")
