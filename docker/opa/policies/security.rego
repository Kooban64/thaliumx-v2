# Thaliumx Security Policies
# ==========================
# Security and access control policies
# All thresholds are configurable via data.parameters

package thaliumx.security

import future.keywords.if
import future.keywords.in
import future.keywords.contains

# Default: allow unless explicitly denied
default allow := true

# Load configurable parameters from data
parameters := data.parameters.security

# ============================================
# AUTHENTICATION SECURITY RULES
# ============================================

# Rule: Failed Login Attempts
# Block after too many failed attempts
failed_login_block if {
    input.action == "login"
    input.user.failed_attempts >= parameters.max_failed_login_attempts
    input.user.last_failed_attempt_time > time.now_ns() / 1000000000 - parameters.lockout_duration_seconds
}

allow := false if {
    failed_login_block
}

failed_login_flag contains decision if {
    failed_login_block
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "SEC-001",
        "severity": "high",
        "reason": sprintf("Account locked: %v failed login attempts", [input.user.failed_attempts]),
        "actions": [
            {"type": "block", "target": "login", "parameters": {"duration_seconds": parameters.lockout_duration_seconds}},
            {"type": "alert", "target": "security_team", "parameters": {"priority": "medium"}},
            {"type": "notification", "target": "user", "parameters": {"message": "Account temporarily locked due to failed login attempts"}}
        ]
    }
}

# Rule: Suspicious IP Detection
suspicious_ip_flag contains decision if {
    input.action in ["login", "transaction", "withdrawal"]
    input.request.ip in parameters.blocked_ips
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "SEC-002",
        "severity": "critical",
        "reason": sprintf("Request from blocked IP: %v", [input.request.ip]),
        "actions": [
            {"type": "block", "target": "request", "parameters": {"permanent": true}},
            {"type": "alert", "target": "security_team", "parameters": {"priority": "critical"}},
            {"type": "log", "target": "security_audit", "parameters": {}}
        ]
    }
}

allow := false if {
    input.request.ip in parameters.blocked_ips
}

# Rule: VPN/Proxy Detection
vpn_proxy_flag contains decision if {
    input.action in ["login", "withdrawal"]
    input.request.is_vpn == true
    parameters.block_vpn == true
    decision := {
        "flagged": true,
        "rule_id": "SEC-003",
        "severity": "medium",
        "reason": "VPN/Proxy detected",
        "actions": [
            {"type": "alert", "target": "security_team", "parameters": {"priority": "low"}},
            {"type": "enhanced_verification", "target": "user", "parameters": {"type": "2fa"}}
        ]
    }
}

# Rule: New Device Detection
new_device_flag contains decision if {
    input.action in ["login", "withdrawal"]
    not input.device.fingerprint in input.user.known_devices
    decision := {
        "flagged": true,
        "rule_id": "SEC-004",
        "severity": "medium",
        "reason": "Login from new/unknown device",
        "actions": [
            {"type": "notification", "target": "user", "parameters": {"message": "New device login detected"}},
            {"type": "enhanced_verification", "target": "user", "parameters": {"type": "email_confirmation"}},
            {"type": "log", "target": "security_audit", "parameters": {}}
        ]
    }
}

# Rule: Geographic Anomaly
geo_anomaly_flag contains decision if {
    input.action in ["login", "withdrawal"]
    input.request.country != input.user.usual_country
    input.user.last_login_country != input.request.country
    time_since_last := time.now_ns() / 1000000000 - input.user.last_login_time
    time_since_last < parameters.impossible_travel_seconds
    decision := {
        "flagged": true,
        "rule_id": "SEC-005",
        "severity": "high",
        "reason": sprintf("Impossible travel detected: %v to %v in %v seconds", [input.user.last_login_country, input.request.country, time_since_last]),
        "actions": [
            {"type": "block", "target": "session", "parameters": {}},
            {"type": "alert", "target": "security_team", "parameters": {"priority": "high"}},
            {"type": "notification", "target": "user", "parameters": {"message": "Suspicious login detected - please verify"}},
            {"type": "force_logout", "target": "all_sessions", "parameters": {}}
        ]
    }
}

allow := false if {
    input.action in ["login", "withdrawal"]
    input.request.country != input.user.usual_country
    input.user.last_login_country != input.request.country
    time_since_last := time.now_ns() / 1000000000 - input.user.last_login_time
    time_since_last < parameters.impossible_travel_seconds
}

# ============================================
# SESSION SECURITY RULES
# ============================================

# Rule: Session Timeout
session_expired if {
    input.action != "login"
    input.session.last_activity < time.now_ns() / 1000000000 - parameters.session_timeout_seconds
}

allow := false if {
    session_expired
}

session_timeout_flag contains decision if {
    session_expired
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "SEC-006",
        "severity": "low",
        "reason": "Session expired due to inactivity",
        "actions": [
            {"type": "logout", "target": "session", "parameters": {}},
            {"type": "redirect", "target": "login", "parameters": {}}
        ]
    }
}

# Rule: Concurrent Session Limit
concurrent_sessions_exceeded if {
    input.action == "login"
    count(input.user.active_sessions) >= parameters.max_concurrent_sessions
}

concurrent_session_flag contains decision if {
    concurrent_sessions_exceeded
    decision := {
        "flagged": true,
        "rule_id": "SEC-007",
        "severity": "low",
        "reason": sprintf("Maximum concurrent sessions (%v) reached", [parameters.max_concurrent_sessions]),
        "actions": [
            {"type": "notification", "target": "user", "parameters": {"message": "Maximum sessions reached. Oldest session will be terminated."}},
            {"type": "terminate", "target": "oldest_session", "parameters": {}}
        ]
    }
}

# ============================================
# API SECURITY RULES
# ============================================

# Rule: Rate Limiting
rate_limit_exceeded if {
    input.action == "api_request"
    input.user.requests_per_minute > parameters.rate_limits[input.user.tier]
}

allow := false if {
    rate_limit_exceeded
}

rate_limit_flag contains decision if {
    rate_limit_exceeded
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "SEC-008",
        "severity": "medium",
        "reason": sprintf("Rate limit exceeded: %v requests/min (limit: %v)", [input.user.requests_per_minute, parameters.rate_limits[input.user.tier]]),
        "actions": [
            {"type": "throttle", "target": "api", "parameters": {"duration_seconds": 60}},
            {"type": "notification", "target": "user", "parameters": {"message": "Rate limit exceeded. Please slow down."}}
        ]
    }
}

# Rule: API Key Validation
invalid_api_key if {
    input.action == "api_request"
    input.api_key.status != "active"
}

allow := false if {
    invalid_api_key
}

api_key_flag contains decision if {
    invalid_api_key
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "SEC-009",
        "severity": "high",
        "reason": sprintf("Invalid API key status: %v", [input.api_key.status]),
        "actions": [
            {"type": "block", "target": "request", "parameters": {}},
            {"type": "log", "target": "security_audit", "parameters": {}}
        ]
    }
}

# Rule: IP Whitelist for API
ip_not_whitelisted if {
    input.action == "api_request"
    input.api_key.ip_whitelist_enabled == true
    not input.request.ip in input.api_key.whitelisted_ips
}

allow := false if {
    ip_not_whitelisted
}

ip_whitelist_flag contains decision if {
    ip_not_whitelisted
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "SEC-010",
        "severity": "high",
        "reason": sprintf("IP %v not in API key whitelist", [input.request.ip]),
        "actions": [
            {"type": "block", "target": "request", "parameters": {}},
            {"type": "alert", "target": "security_team", "parameters": {"priority": "medium"}},
            {"type": "notification", "target": "user", "parameters": {"message": "API request blocked: IP not whitelisted"}}
        ]
    }
}

# ============================================
# WITHDRAWAL SECURITY RULES
# ============================================

# Rule: Withdrawal Address Whitelist
withdrawal_address_not_whitelisted if {
    input.action == "withdrawal"
    parameters.require_address_whitelist == true
    not input.withdrawal.address in input.user.whitelisted_addresses
}

allow := false if {
    withdrawal_address_not_whitelisted
}

withdrawal_whitelist_flag contains decision if {
    withdrawal_address_not_whitelisted
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "SEC-011",
        "severity": "high",
        "reason": "Withdrawal address not in whitelist",
        "actions": [
            {"type": "block", "target": "withdrawal", "parameters": {}},
            {"type": "notification", "target": "user", "parameters": {"message": "Please add this address to your whitelist first"}}
        ]
    }
}

# Rule: Withdrawal Cooling Period
withdrawal_cooling_period if {
    input.action == "withdrawal"
    input.user.password_changed_at > time.now_ns() / 1000000000 - parameters.withdrawal_cooling_period_seconds
}

allow := false if {
    withdrawal_cooling_period
}

cooling_period_flag contains decision if {
    withdrawal_cooling_period
    remaining := parameters.withdrawal_cooling_period_seconds - (time.now_ns() / 1000000000 - input.user.password_changed_at)
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "SEC-012",
        "severity": "medium",
        "reason": sprintf("Withdrawal cooling period active: %v seconds remaining", [remaining]),
        "actions": [
            {"type": "block", "target": "withdrawal", "parameters": {}},
            {"type": "notification", "target": "user", "parameters": {"message": "Withdrawals temporarily disabled after password change"}}
        ]
    }
}

# Rule: 2FA Required for Withdrawal
withdrawal_2fa_required if {
    input.action == "withdrawal"
    input.withdrawal.amount > parameters.withdrawal_2fa_threshold
    input.user.has_2fa == false
}

allow := false if {
    withdrawal_2fa_required
}

withdrawal_2fa_flag contains decision if {
    withdrawal_2fa_required
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "SEC-013",
        "severity": "high",
        "reason": sprintf("2FA required for withdrawals above %v", [parameters.withdrawal_2fa_threshold]),
        "actions": [
            {"type": "block", "target": "withdrawal", "parameters": {}},
            {"type": "notification", "target": "user", "parameters": {"message": "Please enable 2FA to withdraw this amount"}}
        ]
    }
}

# ============================================
# AGGREGATE DECISIONS
# ============================================

# Collect all security flags
all_flags := failed_login_flag | suspicious_ip_flag | vpn_proxy_flag | new_device_flag | geo_anomaly_flag | session_timeout_flag | concurrent_session_flag | rate_limit_flag | api_key_flag | ip_whitelist_flag | withdrawal_whitelist_flag | cooling_period_flag | withdrawal_2fa_flag

# Security assessment
security_assessment := result if {
    count(all_flags) == 0
    result := {
        "security_score": 100,
        "risk_level": "low",
        "recommendations": []
    }
} else := result if {
    critical := [f | some f in all_flags; f.severity == "critical"]
    count(critical) > 0
    result := {
        "security_score": 0,
        "risk_level": "critical",
        "recommendations": ["Immediate security review required", "Block all access"]
    }
} else := result if {
    high := [f | some f in all_flags; f.severity == "high"]
    count(high) > 0
    result := {
        "security_score": 25,
        "risk_level": "high",
        "recommendations": ["Security review required", "Enhanced monitoring"]
    }
} else := result if {
    medium := [f | some f in all_flags; f.severity == "medium"]
    count(medium) > 0
    result := {
        "security_score": 50,
        "risk_level": "medium",
        "recommendations": ["Monitor for additional suspicious activity"]
    }
} else := result if {
    result := {
        "security_score": 75,
        "risk_level": "low",
        "recommendations": ["Standard monitoring"]
    }
}

# Security report
security_report := {
    "timestamp": time.now_ns(),
    "request_id": input.request.id,
    "user_id": input.user.id,
    "action": input.action,
    "flags": all_flags,
    "assessment": security_assessment,
    "allowed": allow,
    "parameters_version": parameters.version
}