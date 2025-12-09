# Thaliumx Trading Policies
# =========================
# Trading rules, limits, and risk management
# All thresholds are configurable via data.parameters

package thaliumx.trading

import future.keywords.if
import future.keywords.in
import future.keywords.contains

# Default: allow trading unless explicitly denied
default allow := true

# Load configurable parameters from data
parameters := data.parameters.trading

# ============================================
# ORDER VALIDATION RULES
# ============================================

# Rule: Minimum Order Size
order_too_small if {
    input.action == "place_order"
    input.order.quantity < parameters.min_order_sizes[input.order.market]
}

allow := false if {
    order_too_small
}

min_order_flag contains decision if {
    order_too_small
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "TRD-001",
        "severity": "low",
        "reason": sprintf("Order quantity %v below minimum %v for market %v", [input.order.quantity, parameters.min_order_sizes[input.order.market], input.order.market]),
        "actions": [
            {"type": "reject", "target": "order", "parameters": {"reason": "Below minimum order size"}}
        ]
    }
}

# Rule: Maximum Order Size
order_too_large if {
    input.action == "place_order"
    input.order.quantity > parameters.max_order_sizes[input.order.market]
}

allow := false if {
    order_too_large
}

max_order_flag contains decision if {
    order_too_large
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "TRD-002",
        "severity": "medium",
        "reason": sprintf("Order quantity %v exceeds maximum %v for market %v", [input.order.quantity, parameters.max_order_sizes[input.order.market], input.order.market]),
        "actions": [
            {"type": "reject", "target": "order", "parameters": {"reason": "Exceeds maximum order size"}}
        ]
    }
}

# Rule: Price Deviation Check
price_deviation_exceeded if {
    input.action == "place_order"
    input.order.type == "limit"
    abs(input.order.price - input.market.last_price) / input.market.last_price * 100 > parameters.max_price_deviation_percent
}

allow := false if {
    price_deviation_exceeded
}

price_deviation_flag contains decision if {
    price_deviation_exceeded
    deviation := abs(input.order.price - input.market.last_price) / input.market.last_price * 100
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "TRD-003",
        "severity": "medium",
        "reason": sprintf("Price deviation %v%% exceeds maximum %v%%", [deviation, parameters.max_price_deviation_percent]),
        "actions": [
            {"type": "reject", "target": "order", "parameters": {"reason": "Price too far from market"}},
            {"type": "notification", "target": "user", "parameters": {"message": "Order price deviates too much from current market price"}}
        ]
    }
}

# Rule: Notional Value Check
notional_too_large if {
    input.action == "place_order"
    notional := input.order.quantity * input.order.price
    notional > parameters.max_notional_value
}

allow := false if {
    notional_too_large
}

notional_flag contains decision if {
    notional_too_large
    notional := input.order.quantity * input.order.price
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "TRD-004",
        "severity": "high",
        "reason": sprintf("Order notional value %v exceeds maximum %v", [notional, parameters.max_notional_value]),
        "actions": [
            {"type": "reject", "target": "order", "parameters": {"reason": "Exceeds maximum notional value"}},
            {"type": "alert", "target": "risk_team", "parameters": {"priority": "medium"}}
        ]
    }
}

# ============================================
# POSITION LIMIT RULES
# ============================================

# Rule: Maximum Position Size
position_limit_exceeded if {
    input.action == "place_order"
    new_position := input.user.current_position + input.order.quantity
    new_position > parameters.max_position_sizes[input.order.market]
}

allow := false if {
    position_limit_exceeded
}

position_limit_flag contains decision if {
    position_limit_exceeded
    new_position := input.user.current_position + input.order.quantity
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "TRD-005",
        "severity": "high",
        "reason": sprintf("Position would exceed limit: %v > %v", [new_position, parameters.max_position_sizes[input.order.market]]),
        "actions": [
            {"type": "reject", "target": "order", "parameters": {"reason": "Would exceed position limit"}},
            {"type": "notification", "target": "user", "parameters": {"message": "Order would exceed your position limit"}}
        ]
    }
}

# Rule: Daily Trading Volume Limit
daily_volume_exceeded if {
    input.action == "place_order"
    new_volume := input.user.daily_volume + (input.order.quantity * input.order.price)
    new_volume > parameters.daily_volume_limits[input.user.tier]
}

allow := false if {
    daily_volume_exceeded
}

daily_volume_flag contains decision if {
    daily_volume_exceeded
    new_volume := input.user.daily_volume + (input.order.quantity * input.order.price)
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "TRD-006",
        "severity": "medium",
        "reason": sprintf("Daily volume would exceed limit: %v > %v", [new_volume, parameters.daily_volume_limits[input.user.tier]]),
        "actions": [
            {"type": "reject", "target": "order", "parameters": {"reason": "Daily volume limit reached"}},
            {"type": "notification", "target": "user", "parameters": {"message": "You have reached your daily trading limit"}}
        ]
    }
}

# ============================================
# RISK MANAGEMENT RULES
# ============================================

# Rule: Leverage Limit
leverage_exceeded if {
    input.action == "place_order"
    input.order.leverage > parameters.max_leverage[input.user.tier]
}

allow := false if {
    leverage_exceeded
}

leverage_flag contains decision if {
    leverage_exceeded
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "TRD-007",
        "severity": "high",
        "reason": sprintf("Leverage %vx exceeds maximum %vx for tier %v", [input.order.leverage, parameters.max_leverage[input.user.tier], input.user.tier]),
        "actions": [
            {"type": "reject", "target": "order", "parameters": {"reason": "Leverage too high"}},
            {"type": "notification", "target": "user", "parameters": {"message": "Requested leverage exceeds your tier limit"}}
        ]
    }
}

# Rule: Margin Requirement
insufficient_margin if {
    input.action == "place_order"
    required_margin := (input.order.quantity * input.order.price) / input.order.leverage
    required_margin > input.user.available_margin
}

allow := false if {
    insufficient_margin
}

margin_flag contains decision if {
    insufficient_margin
    required_margin := (input.order.quantity * input.order.price) / input.order.leverage
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "TRD-008",
        "severity": "high",
        "reason": sprintf("Insufficient margin: required %v, available %v", [required_margin, input.user.available_margin]),
        "actions": [
            {"type": "reject", "target": "order", "parameters": {"reason": "Insufficient margin"}},
            {"type": "notification", "target": "user", "parameters": {"message": "Please deposit more funds or reduce order size"}}
        ]
    }
}

# Rule: Open Orders Limit
too_many_open_orders if {
    input.action == "place_order"
    count(input.user.open_orders) >= parameters.max_open_orders[input.user.tier]
}

allow := false if {
    too_many_open_orders
}

open_orders_flag contains decision if {
    too_many_open_orders
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "TRD-009",
        "severity": "low",
        "reason": sprintf("Maximum open orders (%v) reached", [parameters.max_open_orders[input.user.tier]]),
        "actions": [
            {"type": "reject", "target": "order", "parameters": {"reason": "Too many open orders"}},
            {"type": "notification", "target": "user", "parameters": {"message": "Please cancel some orders before placing new ones"}}
        ]
    }
}

# ============================================
# MARKET MANIPULATION DETECTION
# ============================================

# Rule: Wash Trading Detection
wash_trading_detected if {
    input.action == "place_order"
    input.order.counterparty_id == input.user.id
}

allow := false if {
    wash_trading_detected
}

wash_trading_flag contains decision if {
    wash_trading_detected
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "TRD-010",
        "severity": "critical",
        "reason": "Potential wash trading detected: self-matching order",
        "actions": [
            {"type": "reject", "target": "order", "parameters": {"reason": "Self-matching not allowed"}},
            {"type": "alert", "target": "compliance_team", "parameters": {"priority": "critical"}},
            {"type": "flag", "target": "user", "parameters": {"reason": "wash_trading_attempt"}}
        ]
    }
}

# Rule: Spoofing Detection (rapid order placement and cancellation)
spoofing_detected if {
    input.action == "place_order"
    input.user.orders_placed_1min > parameters.spoofing_order_threshold
    input.user.orders_cancelled_1min > parameters.spoofing_cancel_threshold
    cancel_ratio := input.user.orders_cancelled_1min / input.user.orders_placed_1min
    cancel_ratio > parameters.spoofing_cancel_ratio
}

spoofing_flag contains decision if {
    spoofing_detected
    cancel_ratio := input.user.orders_cancelled_1min / input.user.orders_placed_1min
    decision := {
        "flagged": true,
        "rule_id": "TRD-011",
        "severity": "high",
        "reason": sprintf("Potential spoofing detected: %v orders placed, %v cancelled (ratio: %v)", [input.user.orders_placed_1min, input.user.orders_cancelled_1min, cancel_ratio]),
        "actions": [
            {"type": "alert", "target": "compliance_team", "parameters": {"priority": "high"}},
            {"type": "throttle", "target": "user", "parameters": {"duration_seconds": 300}},
            {"type": "enhanced_monitoring", "target": "user", "parameters": {"duration_hours": 24}}
        ]
    }
}

# Rule: Layering Detection (multiple orders at different price levels)
layering_detected if {
    input.action == "place_order"
    input.user.orders_at_different_prices > parameters.layering_threshold
    input.user.order_fill_rate < parameters.layering_fill_rate_threshold
}

layering_flag contains decision if {
    layering_detected
    decision := {
        "flagged": true,
        "rule_id": "TRD-012",
        "severity": "high",
        "reason": sprintf("Potential layering detected: %v orders at different prices, fill rate %v%%", [input.user.orders_at_different_prices, input.user.order_fill_rate * 100]),
        "actions": [
            {"type": "alert", "target": "compliance_team", "parameters": {"priority": "high"}},
            {"type": "enhanced_monitoring", "target": "user", "parameters": {"duration_hours": 48}}
        ]
    }
}

# ============================================
# TRADING HOURS RULES
# ============================================

# Rule: Market Hours Check
outside_trading_hours if {
    input.action == "place_order"
    parameters.enforce_trading_hours == true
    not market_is_open
}

market_is_open if {
    current_hour := time.clock([time.now_ns(), "UTC"])[0]
    current_hour >= parameters.trading_hours.start
    current_hour < parameters.trading_hours.end
}

market_is_open if {
    # 24/7 markets
    input.order.market in parameters.always_open_markets
}

allow := false if {
    outside_trading_hours
}

trading_hours_flag contains decision if {
    outside_trading_hours
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "TRD-013",
        "severity": "low",
        "reason": "Market is closed",
        "actions": [
            {"type": "reject", "target": "order", "parameters": {"reason": "Market closed"}},
            {"type": "notification", "target": "user", "parameters": {"message": sprintf("Trading hours: %v:00 - %v:00 UTC", [parameters.trading_hours.start, parameters.trading_hours.end])}}
        ]
    }
}

# ============================================
# AGGREGATE DECISIONS
# ============================================

# Collect all trading flags
all_flags := min_order_flag | max_order_flag | price_deviation_flag | notional_flag | position_limit_flag | daily_volume_flag | leverage_flag | margin_flag | open_orders_flag | wash_trading_flag | spoofing_flag | layering_flag | trading_hours_flag

# Trading risk assessment
trading_assessment := result if {
    count(all_flags) == 0
    result := {
        "risk_score": 0,
        "risk_level": "low",
        "order_allowed": true
    }
} else := result if {
    critical := [f | some f in all_flags; f.severity == "critical"]
    count(critical) > 0
    result := {
        "risk_score": 100,
        "risk_level": "critical",
        "order_allowed": false
    }
} else := result if {
    blocked := [f | some f in all_flags; f.allowed == false]
    count(blocked) > 0
    result := {
        "risk_score": 75,
        "risk_level": "high",
        "order_allowed": false
    }
} else := result if {
    result := {
        "risk_score": 25,
        "risk_level": "low",
        "order_allowed": true
    }
}

# Trading report
trading_report := {
    "timestamp": time.now_ns(),
    "order_id": input.order.id,
    "user_id": input.user.id,
    "market": input.order.market,
    "flags": all_flags,
    "assessment": trading_assessment,
    "allowed": allow,
    "parameters_version": parameters.version
}