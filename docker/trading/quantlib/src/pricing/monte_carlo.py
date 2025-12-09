"""
Monte Carlo Option Pricing
"""

import numpy as np
from typing import Dict, Any
import structlog

logger = structlog.get_logger()

class MonteCarloPricer:
    """Monte Carlo option pricing implementation"""
    
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
        simulations: int = 100000
    ) -> Dict[str, Any]:
        """
        Price European option using Monte Carlo simulation
        
        Args:
            spot_price: Current asset price
            strike_price: Option strike price
            risk_free_rate: Risk-free interest rate
            volatility: Asset volatility
            time_to_maturity: Time to expiration in years
            option_type: 'call' or 'put'
            simulations: Number of Monte Carlo simulations
        
        Returns:
            Dictionary with option price and statistics
        """
        try:
            # Generate random numbers
            np.random.seed(42)  # For reproducibility
            random_numbers = np.random.standard_normal(simulations)
            
            # Calculate stock prices at maturity
            stock_prices = spot_price * np.exp(
                (risk_free_rate - 0.5 * volatility**2) * time_to_maturity +
                volatility * np.sqrt(time_to_maturity) * random_numbers
            )
            
            # Calculate payoffs
            if option_type.lower() == 'call':
                payoffs = np.maximum(stock_prices - strike_price, 0)
            else:  # put
                payoffs = np.maximum(strike_price - stock_prices, 0)
            
            # Calculate option price (discounted expected payoff)
            option_price = np.exp(-risk_free_rate * time_to_maturity) * np.mean(payoffs)
            
            # Calculate Greeks (approximate)
            delta = self._calculate_delta_approximate(
                spot_price, strike_price, risk_free_rate, 
                volatility, time_to_maturity, option_type
            )
            
            # Calculate standard error
            standard_error = np.std(payoffs) / np.sqrt(simulations)
            
            result = {
                'option_price': float(option_price),
                'delta': float(delta),
                'standard_error': float(standard_error),
                'simulations': simulations,
                'parameters': {
                    'spot_price': spot_price,
                    'strike_price': strike_price,
                    'risk_free_rate': risk_free_rate,
                    'volatility': volatility,
                    'time_to_maturity': time_to_maturity,
                    'option_type': option_type
                }
            }
            
            logger.info("Monte Carlo pricing completed", 
                       option_price=option_price,
                       simulations=simulations)
            
            return result
            
        except Exception as e:
            logger.error("Monte Carlo pricing failed", error=str(e))
            raise ValueError(f"Monte Carlo pricing failed: {str(e)}")
    
    def _calculate_delta_approximate(
        self,
        spot_price: float,
        strike_price: float,
        risk_free_rate: float,
        volatility: float,
        time_to_maturity: float,
        option_type: str
    ) -> float:
        """Calculate approximate delta using finite difference"""
        try:
            # Small perturbation
            epsilon = spot_price * 0.01
            
            # Calculate price with higher spot
            price_up = self._monte_carlo_price(
                spot_price + epsilon, strike_price, risk_free_rate,
                volatility, time_to_maturity, option_type
            )
            
            # Calculate price with lower spot
            price_down = self._monte_carlo_price(
                spot_price - epsilon, strike_price, risk_free_rate,
                volatility, time_to_maturity, option_type
            )
            
            # Finite difference delta
            delta = (price_up - price_down) / (2 * epsilon)
            
            return float(delta)
            
        except Exception:
            return 0.0
    
    def _monte_carlo_price(
        self,
        spot_price: float,
        strike_price: float,
        risk_free_rate: float,
        volatility: float,
        time_to_maturity: float,
        option_type: str,
        simulations: int = 10000
    ) -> float:
        """Helper method for Monte Carlo pricing"""
        np.random.seed(42)
        random_numbers = np.random.standard_normal(simulations)
        
        stock_prices = spot_price * np.exp(
            (risk_free_rate - 0.5 * volatility**2) * time_to_maturity +
            volatility * np.sqrt(time_to_maturity) * random_numbers
        )
        
        if option_type.lower() == 'call':
            payoffs = np.maximum(stock_prices - strike_price, 0)
        else:
            payoffs = np.maximum(strike_price - stock_prices, 0)
        
        return float(np.exp(-risk_free_rate * time_to_maturity) * np.mean(payoffs))
