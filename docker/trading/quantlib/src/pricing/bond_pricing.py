"""
Bond Pricing Module
"""

import numpy as np
from typing import Dict, Any, List
import structlog

logger = structlog.get_logger()

class BondPricer:
    """Bond pricing implementation"""
    
    def __init__(self):
        pass
    
    def price_bond(
        self,
        face_value: float,
        coupon_rate: float,
        time_to_maturity: float,
        yield_rate: float,
        frequency: int = 2
    ) -> Dict[str, Any]:
        """
        Price a bond using present value of cash flows
        
        Args:
            face_value: Face value of the bond
            coupon_rate: Annual coupon rate
            time_to_maturity: Time to maturity in years
            yield_rate: Market yield rate
            frequency: Coupon payment frequency per year
        
        Returns:
            Dictionary with bond price and metrics
        """
        try:
            # Calculate coupon payment
            coupon_payment = face_value * coupon_rate / frequency
            
            # Calculate number of payments
            num_payments = int(time_to_maturity * frequency)
            
            # Calculate bond price
            bond_price = 0.0
            
            # Present value of coupon payments
            for i in range(1, num_payments + 1):
                payment_time = i / frequency
                pv_coupon = coupon_payment / ((1 + yield_rate / frequency) ** i)
                bond_price += pv_coupon
            
            # Present value of face value
            pv_face = face_value / ((1 + yield_rate / frequency) ** num_payments)
            bond_price += pv_face
            
            # Calculate duration (Macaulay duration)
            duration = self._calculate_duration(
                face_value, coupon_rate, time_to_maturity, 
                yield_rate, frequency, bond_price
            )
            
            # Calculate modified duration
            modified_duration = duration / (1 + yield_rate / frequency)
            
            # Calculate convexity
            convexity = self._calculate_convexity(
                face_value, coupon_rate, time_to_maturity,
                yield_rate, frequency
            )
            
            result = {
                'bond_price': float(bond_price),
                'duration': float(duration),
                'modified_duration': float(modified_duration),
                'convexity': float(convexity),
                'yield_to_maturity': yield_rate,
                'parameters': {
                    'face_value': face_value,
                    'coupon_rate': coupon_rate,
                    'time_to_maturity': time_to_maturity,
                    'yield_rate': yield_rate,
                    'frequency': frequency
                }
            }
            
            logger.info("Bond pricing completed", 
                       bond_price=bond_price,
                       duration=duration)
            
            return result
            
        except Exception as e:
            logger.error("Bond pricing failed", error=str(e))
            raise ValueError(f"Bond pricing failed: {str(e)}")
    
    def _calculate_duration(
        self,
        face_value: float,
        coupon_rate: float,
        time_to_maturity: float,
        yield_rate: float,
        frequency: int,
        bond_price: float
    ) -> float:
        """Calculate Macaulay duration"""
        try:
            coupon_payment = face_value * coupon_rate / frequency
            num_payments = int(time_to_maturity * frequency)
            
            weighted_time = 0.0
            
            # Weighted time for coupon payments
            for i in range(1, num_payments + 1):
                payment_time = i / frequency
                pv_coupon = coupon_payment / ((1 + yield_rate / frequency) ** i)
                weighted_time += payment_time * pv_coupon
            
            # Weighted time for face value
            pv_face = face_value / ((1 + yield_rate / frequency) ** num_payments)
            weighted_time += time_to_maturity * pv_face
            
            duration = weighted_time / bond_price
            return float(duration)
            
        except Exception:
            return 0.0
    
    def _calculate_convexity(
        self,
        face_value: float,
        coupon_rate: float,
        time_to_maturity: float,
        yield_rate: float,
        frequency: int
    ) -> float:
        """Calculate bond convexity"""
        try:
            coupon_payment = face_value * coupon_rate / frequency
            num_payments = int(time_to_maturity * frequency)
            
            convexity = 0.0
            
            # Convexity for coupon payments
            for i in range(1, num_payments + 1):
                payment_time = i / frequency
                pv_coupon = coupon_payment / ((1 + yield_rate / frequency) ** i)
                convexity += pv_coupon * payment_time * (payment_time + 1)
            
            # Convexity for face value
            pv_face = face_value / ((1 + yield_rate / frequency) ** num_payments)
            convexity += pv_face * time_to_maturity * (time_to_maturity + 1)
            
            convexity /= ((1 + yield_rate / frequency) ** 2)
            return float(convexity)
            
        except Exception:
            return 0.0
