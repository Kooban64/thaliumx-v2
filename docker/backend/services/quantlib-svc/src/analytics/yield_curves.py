"""
Yield Curve Analytics
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple
from scipy import interpolate
import structlog

logger = structlog.get_logger()

class YieldCurveAnalyzer:
    """Yield curve construction and analysis"""
    
    def __init__(self):
        self.interpolation_methods = ['linear', 'cubic', 'spline']
    
    def construct_yield_curve(
        self,
        maturities: List[float],
        yields: List[float],
        method: str = 'cubic'
    ) -> Dict[str, Any]:
        """
        Construct yield curve from market data
        
        Args:
            maturities: List of maturities in years
            yields: List of corresponding yields
            method: Interpolation method
        
        Returns:
            Dictionary with yield curve data and metrics
        """
        try:
            maturities_array = np.array(maturities)
            yields_array = np.array(yields)
            
            # Validate inputs
            if len(maturities) != len(yields):
                raise ValueError("Maturities and yields must have same length")
            
            if len(maturities) < 2:
                raise ValueError("At least 2 data points required")
            
            # Sort by maturity
            sort_idx = np.argsort(maturities_array)
            maturities_sorted = maturities_array[sort_idx]
            yields_sorted = yields_array[sort_idx]
            
            # Create interpolation function
            if method == 'linear':
                interp_func = interpolate.interp1d(
                    maturities_sorted, yields_sorted, 
                    kind='linear', bounds_error=False, 
                    fill_value='extrapolate'
                )
            elif method == 'cubic':
                interp_func = interpolate.interp1d(
                    maturities_sorted, yields_sorted, 
                    kind='cubic', bounds_error=False, 
                    fill_value='extrapolate'
                )
            elif method == 'spline':
                interp_func = interpolate.UnivariateSpline(
                    maturities_sorted, yields_sorted, s=0
                )
            else:
                raise ValueError(f"Unknown interpolation method: {method}")
            
            # Generate smooth curve
            maturity_range = np.linspace(
                min(maturities_sorted), max(maturities_sorted), 100
            )
            yield_curve = interp_func(maturity_range)
            
            # Calculate curve metrics
            curve_metrics = self._calculate_curve_metrics(
                maturities_sorted, yields_sorted
            )
            
            result = {
                'maturities': maturities_sorted.tolist(),
                'yields': yields_sorted.tolist(),
                'curve_maturities': maturity_range.tolist(),
                'curve_yields': yield_curve.tolist(),
                'interpolation_method': method,
                'metrics': curve_metrics,
                'data_points': len(maturities)
            }
            
            logger.info("Yield curve constructed successfully", 
                       method=method,
                       data_points=len(maturities))
            
            return result
            
        except Exception as e:
            logger.error("Yield curve construction failed", error=str(e))
            raise ValueError(f"Yield curve construction failed: {str(e)}")
    
    def _calculate_curve_metrics(
        self, 
        maturities: np.ndarray, 
        yields: np.ndarray
    ) -> Dict[str, float]:
        """Calculate yield curve metrics"""
        # Basic statistics
        mean_yield = np.mean(yields)
        std_yield = np.std(yields)
        min_yield = np.min(yields)
        max_yield = np.max(yields)
        
        # Curve slope (10Y - 2Y)
        if len(maturities) >= 2:
            # Find closest to 2Y and 10Y
            idx_2y = np.argmin(np.abs(maturities - 2.0))
            idx_10y = np.argmin(np.abs(maturities - 10.0))
            slope = yields[idx_10y] - yields[idx_2y]
        else:
            slope = 0.0
        
        # Curve curvature (butterfly spread)
        if len(maturities) >= 3:
            # Find 2Y, 5Y, 10Y points
            idx_2y = np.argmin(np.abs(maturities - 2.0))
            idx_5y = np.argmin(np.abs(maturities - 5.0))
            idx_10y = np.argmin(np.abs(maturities - 10.0))
            curvature = 2 * yields[idx_5y] - yields[idx_2y] - yields[idx_10y]
        else:
            curvature = 0.0
        
        return {
            'mean_yield': float(mean_yield),
            'std_yield': float(std_yield),
            'min_yield': float(min_yield),
            'max_yield': float(max_yield),
            'slope_2y_10y': float(slope),
            'curvature': float(curvature)
        }
    
    def calculate_forward_rates(
        self,
        maturities: List[float],
        yields: List[float],
        forward_periods: List[Tuple[float, float]] = None
    ) -> Dict[str, Any]:
        """
        Calculate forward rates from yield curve
        
        Args:
            maturities: List of maturities in years
            yields: List of corresponding yields
            forward_periods: List of (start, end) periods for forward rates
        
        Returns:
            Dictionary with forward rates
        """
        try:
            if forward_periods is None:
                # Default forward periods: 1Y1Y, 2Y1Y, 5Y1Y, 10Y1Y
                forward_periods = [(1, 2), (2, 3), (5, 6), (10, 11)]
            
            maturities_array = np.array(maturities)
            yields_array = np.array(yields)
            
            # Create interpolation function
            interp_func = interpolate.interp1d(
                maturities_array, yields_array, 
                kind='cubic', bounds_error=False, 
                fill_value='extrapolate'
            )
            
            forward_rates = []
            for start_period, end_period in forward_periods:
                # Get yields for start and end periods
                yield_start = interp_func(start_period)
                yield_end = interp_func(end_period)
                
                # Calculate forward rate
                forward_rate = (yield_end * end_period - yield_start * start_period) / (end_period - start_period)
                forward_rates.append({
                    'start_period': start_period,
                    'end_period': end_period,
                    'forward_rate': float(forward_rate)
                })
            
            result = {
                'forward_rates': forward_rates,
                'maturities': maturities,
                'yields': yields
            }
            
            logger.info("Forward rates calculated successfully", 
                       num_rates=len(forward_rates))
            
            return result
            
        except Exception as e:
            logger.error("Forward rates calculation failed", error=str(e))
            raise ValueError(f"Forward rates calculation failed: {str(e)}")
    
    def bootstrap_zero_curve(
        self,
        market_rates: List[float],
        maturities: List[float],
        frequency: int = 2
    ) -> Dict[str, Any]:
        """
        Bootstrap zero-coupon yield curve from market rates
        
        Args:
            market_rates: Market rates (coupon rates)
            maturities: Maturities in years
            frequency: Payment frequency per year
        
        Returns:
            Dictionary with zero-coupon curve
        """
        try:
            n = len(maturities)
            zero_rates = np.zeros(n)
            
            # First zero rate is the first market rate
            zero_rates[0] = market_rates[0]
            
            # Bootstrap subsequent rates
            for i in range(1, n):
                maturity = maturities[i]
                market_rate = market_rates[i]
                
                # Calculate zero rate using bootstrapping
                # This is a simplified version - full implementation would use QuantLib
                zero_rate = self._bootstrap_zero_rate(
                    market_rate, maturity, zero_rates[:i], 
                    maturities[:i], frequency
                )
                zero_rates[i] = zero_rate
            
            result = {
                'maturities': maturities,
                'market_rates': market_rates,
                'zero_rates': zero_rates.tolist(),
                'frequency': frequency
            }
            
            logger.info("Zero curve bootstrapped successfully", 
                       num_points=n)
            
            return result
            
        except Exception as e:
            logger.error("Zero curve bootstrapping failed", error=str(e))
            raise ValueError(f"Zero curve bootstrapping failed: {str(e)}")
    
    def _bootstrap_zero_rate(
        self, 
        market_rate: float, 
        maturity: float, 
        known_rates: np.ndarray, 
        known_maturities: np.ndarray, 
        frequency: int
    ) -> float:
        """Bootstrap zero rate for a given maturity"""
        # Simplified bootstrapping - in practice, this would use QuantLib
        # For now, return a linear interpolation
        if len(known_rates) == 0:
            return market_rate
        
        # Linear interpolation as approximation
        interp_func = interpolate.interp1d(
            known_maturities, known_rates, 
            kind='linear', bounds_error=False, 
            fill_value='extrapolate'
        )
        
        return float(interp_func(maturity))
