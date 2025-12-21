"""
Market Analytics Module
"""

import numpy as np
from typing import Dict, Any, List
import structlog

logger = structlog.get_logger()

class MarketAnalyzer:
    """Market analytics implementation"""
    
    def __init__(self):
        pass
    
    def analyze_market_data(
        self,
        prices: List[float],
        volumes: List[float] = None
    ) -> Dict[str, Any]:
        """
        Analyze market data for trends and patterns
        
        Args:
            prices: List of price data
            volumes: Optional list of volume data
        
        Returns:
            Dictionary with market analysis results
        """
        try:
            prices_array = np.array(prices)
            
            # Calculate returns
            returns = np.diff(prices_array) / prices_array[:-1]
            
            # Basic statistics
            mean_return = np.mean(returns)
            volatility = np.std(returns)
            
            # Calculate moving averages
            sma_20 = np.mean(prices_array[-20:]) if len(prices_array) >= 20 else np.mean(prices_array)
            sma_50 = np.mean(prices_array[-50:]) if len(prices_array) >= 50 else np.mean(prices_array)
            
            # Calculate RSI (simplified)
            rsi = self._calculate_rsi(prices_array)
            
            # Calculate Bollinger Bands
            bb_upper, bb_middle, bb_lower = self._calculate_bollinger_bands(prices_array)
            
            result = {
                'current_price': float(prices_array[-1]),
                'mean_return': float(mean_return),
                'volatility': float(volatility),
                'sma_20': float(sma_20),
                'sma_50': float(sma_50),
                'rsi': float(rsi),
                'bollinger_bands': {
                    'upper': float(bb_upper),
                    'middle': float(bb_middle),
                    'lower': float(bb_lower)
                },
                'data_points': len(prices)
            }
            
            if volumes is not None:
                volumes_array = np.array(volumes)
                avg_volume = np.mean(volumes_array)
                result['avg_volume'] = float(avg_volume)
            
            logger.info("Market analysis completed", 
                       current_price=result['current_price'],
                       volatility=volatility)
            
            return result
            
        except Exception as e:
            logger.error("Market analysis failed", error=str(e))
            raise ValueError(f"Market analysis failed: {str(e)}")
    
    def _calculate_rsi(self, prices: np.ndarray, period: int = 14) -> float:
        """Calculate Relative Strength Index"""
        try:
            if len(prices) < period + 1:
                return 50.0  # Neutral RSI
            
            deltas = np.diff(prices)
            gains = np.where(deltas > 0, deltas, 0)
            losses = np.where(deltas < 0, -deltas, 0)
            
            avg_gain = np.mean(gains[-period:])
            avg_loss = np.mean(losses[-period:])
            
            if avg_loss == 0:
                return 100.0
            
            rs = avg_gain / avg_loss
            rsi = 100 - (100 / (1 + rs))
            
            return float(rsi)
            
        except Exception:
            return 50.0
    
    def _calculate_bollinger_bands(
        self, 
        prices: np.ndarray, 
        period: int = 20, 
        std_dev: float = 2.0
    ) -> tuple:
        """Calculate Bollinger Bands"""
        try:
            if len(prices) < period:
                period = len(prices)
            
            recent_prices = prices[-period:]
            middle = np.mean(recent_prices)
            std = np.std(recent_prices)
            
            upper = middle + (std_dev * std)
            lower = middle - (std_dev * std)
            
            return float(upper), float(middle), float(lower)
            
        except Exception:
            return 0.0, 0.0, 0.0
