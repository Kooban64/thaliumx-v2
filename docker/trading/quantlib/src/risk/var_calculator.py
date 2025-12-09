"""
Value at Risk (VaR) Calculator
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
from scipy import stats
import structlog

logger = structlog.get_logger()

class VaRCalculator:
    """Value at Risk calculation using multiple methods"""
    
    def __init__(self):
        self.methods = ['historical', 'parametric', 'monte_carlo']
    
    def calculate_var(
        self,
        returns: List[float],
        confidence_level: float = 0.05,
        method: str = 'historical',
        time_horizon: int = 1,
        portfolio_value: float = 1.0
    ) -> Dict[str, Any]:
        """
        Calculate Value at Risk
        
        Args:
            returns: List of historical returns
            confidence_level: VaR confidence level (e.g., 0.05 for 95% VaR)
            method: Calculation method ('historical', 'parametric', 'monte_carlo')
            time_horizon: Time horizon in days
            portfolio_value: Portfolio value for absolute VaR
        
        Returns:
            Dictionary with VaR results
        """
        try:
            returns_array = np.array(returns)
            
            if method == 'historical':
                var_result = self._historical_var(
                    returns_array, confidence_level, time_horizon, portfolio_value
                )
            elif method == 'parametric':
                var_result = self._parametric_var(
                    returns_array, confidence_level, time_horizon, portfolio_value
                )
            elif method == 'monte_carlo':
                var_result = self._monte_carlo_var(
                    returns_array, confidence_level, time_horizon, portfolio_value
                )
            else:
                raise ValueError(f"Unknown method: {method}")
            
            # Calculate Expected Shortfall (Conditional VaR)
            es = self._calculate_expected_shortfall(
                returns_array, confidence_level, time_horizon, portfolio_value
            )
            
            result = {
                'var_absolute': var_result['var_absolute'],
                'var_relative': var_result['var_relative'],
                'expected_shortfall': es,
                'confidence_level': confidence_level,
                'time_horizon': time_horizon,
                'method': method,
                'portfolio_value': portfolio_value,
                'statistics': {
                    'mean_return': float(np.mean(returns_array)),
                    'volatility': float(np.std(returns_array)),
                    'skewness': float(stats.skew(returns_array)),
                    'kurtosis': float(stats.kurtosis(returns_array))
                }
            }
            
            logger.info("VaR calculated successfully", 
                       method=method, 
                       confidence_level=confidence_level,
                       var_absolute=result['var_absolute'])
            
            return result
            
        except Exception as e:
            logger.error("VaR calculation failed", error=str(e))
            raise ValueError(f"VaR calculation failed: {str(e)}")
    
    def _historical_var(
        self, 
        returns: np.ndarray, 
        confidence_level: float, 
        time_horizon: int, 
        portfolio_value: float
    ) -> Dict[str, float]:
        """Historical simulation VaR"""
        # Scale returns for time horizon
        scaled_returns = returns * np.sqrt(time_horizon)
        
        # Calculate VaR
        var_percentile = confidence_level * 100
        var_relative = np.percentile(scaled_returns, var_percentile)
        var_absolute = var_relative * portfolio_value
        
        return {
            'var_absolute': float(var_absolute),
            'var_relative': float(var_relative)
        }
    
    def _parametric_var(
        self, 
        returns: np.ndarray, 
        confidence_level: float, 
        time_horizon: int, 
        portfolio_value: float
    ) -> Dict[str, float]:
        """Parametric (Normal distribution) VaR"""
        mean_return = np.mean(returns)
        volatility = np.std(returns)
        
        # Scale for time horizon
        scaled_mean = mean_return * time_horizon
        scaled_volatility = volatility * np.sqrt(time_horizon)
        
        # Calculate VaR using normal distribution
        z_score = stats.norm.ppf(confidence_level)
        var_relative = scaled_mean + z_score * scaled_volatility
        var_absolute = var_relative * portfolio_value
        
        return {
            'var_absolute': float(var_absolute),
            'var_relative': float(var_relative)
        }
    
    def _monte_carlo_var(
        self, 
        returns: np.ndarray, 
        confidence_level: float, 
        time_horizon: int, 
        portfolio_value: float,
        simulations: int = 10000
    ) -> Dict[str, float]:
        """Monte Carlo simulation VaR"""
        mean_return = np.mean(returns)
        volatility = np.std(returns)
        
        # Generate random scenarios
        random_returns = np.random.normal(
            mean_return * time_horizon,
            volatility * np.sqrt(time_horizon),
            simulations
        )
        
        # Calculate VaR
        var_percentile = confidence_level * 100
        var_relative = np.percentile(random_returns, var_percentile)
        var_absolute = var_relative * portfolio_value
        
        return {
            'var_absolute': float(var_absolute),
            'var_relative': float(var_relative)
        }
    
    def _calculate_expected_shortfall(
        self, 
        returns: np.ndarray, 
        confidence_level: float, 
        time_horizon: int, 
        portfolio_value: float
    ) -> float:
        """Calculate Expected Shortfall (Conditional VaR)"""
        # Scale returns for time horizon
        scaled_returns = returns * np.sqrt(time_horizon)
        
        # Calculate VaR threshold
        var_threshold = np.percentile(scaled_returns, confidence_level * 100)
        
        # Calculate expected value of returns below VaR threshold
        tail_returns = scaled_returns[scaled_returns <= var_threshold]
        expected_shortfall = np.mean(tail_returns) * portfolio_value
        
        return float(expected_shortfall)
    
    def calculate_portfolio_var(
        self,
        portfolio_weights: List[float],
        asset_returns: List[List[float]],
        confidence_level: float = 0.05,
        time_horizon: int = 1,
        portfolio_value: float = 1.0
    ) -> Dict[str, Any]:
        """
        Calculate portfolio VaR using correlation matrix
        
        Args:
            portfolio_weights: Portfolio weights for each asset
            asset_returns: Returns for each asset (list of lists)
            confidence_level: VaR confidence level
            time_horizon: Time horizon in days
            portfolio_value: Total portfolio value
        
        Returns:
            Dictionary with portfolio VaR results
        """
        try:
            # Convert to numpy arrays
            weights = np.array(portfolio_weights)
            returns_matrix = np.array(asset_returns)
            
            # Calculate portfolio returns
            portfolio_returns = np.dot(returns_matrix.T, weights)
            
            # Calculate VaR
            var_result = self.calculate_var(
                portfolio_returns.tolist(),
                confidence_level,
                'historical',
                time_horizon,
                portfolio_value
            )
            
            # Calculate correlation matrix
            correlation_matrix = np.corrcoef(returns_matrix)
            
            result = {
                **var_result,
                'portfolio_weights': weights.tolist(),
                'correlation_matrix': correlation_matrix.tolist(),
                'diversification_ratio': self._calculate_diversification_ratio(
                    weights, returns_matrix
                )
            }
            
            logger.info("Portfolio VaR calculated successfully", 
                       portfolio_value=portfolio_value,
                       var_absolute=var_result['var_absolute'])
            
            return result
            
        except Exception as e:
            logger.error("Portfolio VaR calculation failed", error=str(e))
            raise ValueError(f"Portfolio VaR calculation failed: {str(e)}")
    
    def _calculate_diversification_ratio(
        self, 
        weights: np.ndarray, 
        returns_matrix: np.ndarray
    ) -> float:
        """Calculate diversification ratio"""
        # Calculate weighted average volatility
        individual_vols = np.std(returns_matrix, axis=1)
        weighted_avg_vol = np.dot(weights, individual_vols)
        
        # Calculate portfolio volatility
        portfolio_returns = np.dot(returns_matrix.T, weights)
        portfolio_vol = np.std(portfolio_returns)
        
        # Diversification ratio = weighted avg vol / portfolio vol
        return float(weighted_avg_vol / portfolio_vol) if portfolio_vol > 0 else 1.0
