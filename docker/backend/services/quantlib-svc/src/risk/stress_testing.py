"""
Stress Testing Module
"""

import numpy as np
from typing import Dict, Any, List
import structlog

logger = structlog.get_logger()

class StressTester:
    """Stress testing implementation"""
    
    def __init__(self):
        pass
    
    def stress_test_portfolio(
        self,
        portfolio_weights: List[float],
        asset_returns: List[List[float]],
        stress_scenarios: List[Dict[str, Any]],
        portfolio_value: float = 1.0
    ) -> Dict[str, Any]:
        """
        Perform stress testing on portfolio
        
        Args:
            portfolio_weights: Portfolio weights
            asset_returns: Historical asset returns
            stress_scenarios: List of stress scenarios
            portfolio_value: Portfolio value
        
        Returns:
            Dictionary with stress test results
        """
        try:
            weights = np.array(portfolio_weights)
            returns_matrix = np.array(asset_returns)
            
            # Calculate baseline portfolio return
            baseline_return = np.dot(returns_matrix.mean(axis=1), weights)
            baseline_value = portfolio_value * (1 + baseline_return)
            
            stress_results = []
            
            for scenario in stress_scenarios:
                scenario_name = scenario.get('name', 'Unnamed Scenario')
                scenario_returns = scenario.get('returns', [])
                
                if len(scenario_returns) != len(portfolio_weights):
                    continue
                
                # Calculate stressed portfolio return
                stressed_return = np.dot(scenario_returns, weights)
                stressed_value = portfolio_value * (1 + stressed_return)
                
                # Calculate loss
                loss = baseline_value - stressed_value
                loss_percentage = (loss / baseline_value) * 100
                
                stress_results.append({
                    'scenario_name': scenario_name,
                    'baseline_value': float(baseline_value),
                    'stressed_value': float(stressed_value),
                    'loss': float(loss),
                    'loss_percentage': float(loss_percentage),
                    'stressed_return': float(stressed_return)
                })
            
            # Calculate summary statistics
            max_loss = max([result['loss'] for result in stress_results]) if stress_results else 0
            max_loss_percentage = max([result['loss_percentage'] for result in stress_results]) if stress_results else 0
            
            result = {
                'baseline_value': float(baseline_value),
                'baseline_return': float(baseline_return),
                'stress_results': stress_results,
                'summary': {
                    'max_loss': float(max_loss),
                    'max_loss_percentage': float(max_loss_percentage),
                    'num_scenarios': len(stress_results)
                }
            }
            
            logger.info("Stress testing completed", 
                       num_scenarios=len(stress_results),
                       max_loss=max_loss)
            
            return result
            
        except Exception as e:
            logger.error("Stress testing failed", error=str(e))
            raise ValueError(f"Stress testing failed: {str(e)}")
