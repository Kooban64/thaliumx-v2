"""
Binomial Tree Option Pricing
"""

import numpy as np
from typing import Dict, Any
import structlog

logger = structlog.get_logger()

class BinomialPricer:
    """Binomial tree option pricing implementation"""
    
    def __init__(self):
        pass
    
    def price_option(
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
        Price European option using Binomial tree
        
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
            # Calculate tree parameters
            dt = time_to_maturity / steps
            u = np.exp(volatility * np.sqrt(dt))
            d = 1 / u
            p = (np.exp(risk_free_rate * dt) - d) / (u - d)
            
            # Initialize stock price tree
            stock_prices = np.zeros((steps + 1, steps + 1))
            stock_prices[0, 0] = spot_price
            
            # Build stock price tree
            for i in range(1, steps + 1):
                for j in range(i + 1):
                    stock_prices[i, j] = spot_price * (u ** (i - j)) * (d ** j)
            
            # Calculate option payoffs at maturity
            option_values = np.zeros((steps + 1, steps + 1))
            for j in range(steps + 1):
                if option_type.lower() == 'call':
                    option_values[steps, j] = max(stock_prices[steps, j] - strike_price, 0)
                else:  # put
                    option_values[steps, j] = max(strike_price - stock_prices[steps, j], 0)
            
            # Backward induction
            for i in range(steps - 1, -1, -1):
                for j in range(i + 1):
                    option_values[i, j] = np.exp(-risk_free_rate * dt) * (
                        p * option_values[i + 1, j] + (1 - p) * option_values[i + 1, j + 1]
                    )
            
            option_price = option_values[0, 0]
            
            # Calculate Greeks
            delta = self._calculate_delta(option_values, stock_prices, dt, risk_free_rate)
            gamma = self._calculate_gamma(option_values, stock_prices, dt, risk_free_rate)
            
            result = {
                'option_price': float(option_price),
                'delta': float(delta),
                'gamma': float(gamma),
                'steps': steps,
                'parameters': {
                    'spot_price': spot_price,
                    'strike_price': strike_price,
                    'risk_free_rate': risk_free_rate,
                    'volatility': volatility,
                    'time_to_maturity': time_to_maturity,
                    'option_type': option_type
                }
            }
            
            logger.info("Binomial pricing completed", 
                       option_price=option_price,
                       steps=steps)
            
            return result
            
        except Exception as e:
            logger.error("Binomial pricing failed", error=str(e))
            raise ValueError(f"Binomial pricing failed: {str(e)}")
    
    def _calculate_delta(
        self, 
        option_values: np.ndarray, 
        stock_prices: np.ndarray, 
        dt: float, 
        risk_free_rate: float
    ) -> float:
        """Calculate delta using finite difference"""
        try:
            if option_values.shape[0] < 2:
                return 0.0
            
            # Delta = (V_up - V_down) / (S_up - S_down)
            v_up = option_values[1, 0]
            v_down = option_values[1, 1]
            s_up = stock_prices[1, 0]
            s_down = stock_prices[1, 1]
            
            delta = (v_up - v_down) / (s_up - s_down)
            return float(delta)
            
        except Exception:
            return 0.0
    
    def _calculate_gamma(
        self, 
        option_values: np.ndarray, 
        stock_prices: np.ndarray, 
        dt: float, 
        risk_free_rate: float
    ) -> float:
        """Calculate gamma using finite difference"""
        try:
            if option_values.shape[0] < 3:
                return 0.0
            
            # Gamma calculation using second derivative approximation
            v_up = option_values[1, 0]
            v_mid = option_values[1, 1]
            v_down = option_values[1, 2] if option_values.shape[1] > 2 else v_mid
            
            s_up = stock_prices[1, 0]
            s_mid = stock_prices[1, 1]
            s_down = stock_prices[1, 2] if stock_prices.shape[1] > 2 else s_mid
            
            # Second derivative approximation
            gamma = (v_up - 2 * v_mid + v_down) / ((s_up - s_mid) ** 2)
            return float(gamma)
            
        except Exception:
            return 0.0
