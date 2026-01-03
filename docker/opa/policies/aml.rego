# Thaliumx AML/KYC Compliance Policies
# ====================================
# Anti-Money Laundering and Know Your Customer policies
# All thresholds are configurable via data.parameters

package thaliumx.aml

import future.keywords.if
import future.keywords.in
import future.keywords.contains

# Default: allow transactions unless flagged
default allow := true

# Load configurable parameters from data
parameters := data.parameters.aml

# ============================================
# TRANSACTION MONITORING RULES
# ============================================

# Rule: Large Transaction Threshold
# Flag transactions above the configured threshold
large_transaction_flag contains decision if {
    input.action == "transaction_review"
    input.transaction.amount > parameters.large_transaction_threshold
    decision := {
        "flagged": true,
        "rule_id": "AML-001",
        "severity": "high",
        "framework": "FATF",
        "reason": sprintf("Transaction amount %v exceeds threshold %v", [input.transaction.amount, parameters.large_transaction_threshold]),
        "actions": [
            {"type": "alert", "target": "compliance_team", "parameters": {"priority": "high"}},
            {"type": "hold", "target": "transaction", "parameters": {"duration_hours": 24}},
            {"type": "report", "target": "sar", "parameters": {"auto_file": false}}
        ]
    }
}

# Rule: Structuring Detection (Smurfing)
# Detect multiple transactions just below reporting threshold
structuring_flag contains decision if {
    input.action == "transaction_review"
    input.transaction.amount >= parameters.structuring_lower_bound
    input.transaction.amount < parameters.large_transaction_threshold
    input.user.recent_transactions_24h > parameters.structuring_count_threshold
    decision := {
        "flagged": true,
        "rule_id": "AML-002",
        "severity": "high",
        "framework": "FATF",
        "reason": sprintf("Potential structuring detected: %v transactions in 24h near threshold", [input.user.recent_transactions_24h]),
        "actions": [
            {"type": "alert", "target": "compliance_team", "parameters": {"priority": "critical"}},
            {"type": "block", "target": "user", "parameters": {"duration_hours": 48}},
            {"type": "report", "target": "sar", "parameters": {"auto_file": true}}
        ]
    }
}

# Rule: Rapid Movement Detection
# Flag rapid in-out transactions (layering)
rapid_movement_flag contains decision if {
    input.action == "transaction_review"
    input.user.deposit_24h > parameters.rapid_movement_threshold
    input.user.withdrawal_24h > parameters.rapid_movement_threshold
    time_diff := input.user.last_withdrawal_time - input.user.last_deposit_time
    time_diff < parameters.rapid_movement_window_seconds
    decision := {
        "flagged": true,
        "rule_id": "AML-003",
        "severity": "high",
        "framework": "FATF",
        "reason": "Rapid deposit-withdrawal pattern detected (potential layering)",
        "actions": [
            {"type": "alert", "target": "compliance_team", "parameters": {"priority": "high"}},
            {"type": "hold", "target": "withdrawal", "parameters": {"duration_hours": 72}},
            {"type": "enhanced_monitoring", "target": "user", "parameters": {"duration_days": 30}}
        ]
    }
}

# Rule: High-Risk Country
# Flag transactions involving high-risk jurisdictions
high_risk_country_flag contains decision if {
    input.action == "transaction_review"
    input.transaction.country in parameters.high_risk_countries
    decision := {
        "flagged": true,
        "rule_id": "AML-004",
        "severity": "medium",
        "framework": "FATF",
        "reason": sprintf("Transaction involves high-risk country: %v", [input.transaction.country]),
        "actions": [
            {"type": "alert", "target": "compliance_team", "parameters": {"priority": "medium"}},
            {"type": "enhanced_due_diligence", "target": "user", "parameters": {}}
        ]
    }
}

# Rule: Sanctioned Country Block
# Block transactions from sanctioned countries
sanctioned_country_block if {
    input.action == "transaction_review"
    input.transaction.country in parameters.sanctioned_countries
}

allow := false if {
    sanctioned_country_block
}

sanctioned_country_flag contains decision if {
    sanctioned_country_block
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "AML-005",
        "severity": "critical",
        "framework": "OFAC",
        "reason": sprintf("Transaction blocked: sanctioned country %v", [input.transaction.country]),
        "actions": [
            {"type": "block", "target": "transaction", "parameters": {"permanent": true}},
            {"type": "alert", "target": "compliance_team", "parameters": {"priority": "critical"}},
            {"type": "report", "target": "ofac", "parameters": {"auto_file": true}}
        ]
    }
}

# Rule: PEP (Politically Exposed Person) Check
pep_flag contains decision if {
    input.action == "transaction_review"
    input.user.is_pep == true
    input.transaction.amount > parameters.pep_threshold
    decision := {
        "flagged": true,
        "rule_id": "AML-006",
        "severity": "high",
        "framework": "FATF",
        "reason": "PEP transaction above threshold requires enhanced monitoring",
        "actions": [
            {"type": "alert", "target": "compliance_team", "parameters": {"priority": "high"}},
            {"type": "enhanced_due_diligence", "target": "user", "parameters": {}},
            {"type": "senior_approval", "target": "transaction", "parameters": {}}
        ]
    }
}

# Rule: New Account High Value
# Flag high-value transactions from new accounts
new_account_flag contains decision if {
    input.action == "transaction_review"
    input.user.account_age_days < parameters.new_account_days
    input.transaction.amount > parameters.new_account_threshold
    decision := {
        "flagged": true,
        "rule_id": "AML-007",
        "severity": "medium",
        "framework": "FATF",
        "reason": sprintf("High-value transaction from account less than %v days old", [parameters.new_account_days]),
        "actions": [
            {"type": "alert", "target": "compliance_team", "parameters": {"priority": "medium"}},
            {"type": "hold", "target": "transaction", "parameters": {"duration_hours": 24}},
            {"type": "verification", "target": "user", "parameters": {"type": "identity"}}
        ]
    }
}

# Rule: Unusual Trading Pattern
unusual_pattern_flag contains decision if {
    input.action == "transaction_review"
    input.user.trading_volume_24h > input.user.average_daily_volume * parameters.unusual_volume_multiplier
    decision := {
        "flagged": true,
        "rule_id": "AML-008",
        "severity": "medium",
        "framework": "FATF",
        "reason": sprintf("Trading volume %v exceeds %vx average", [input.user.trading_volume_24h, parameters.unusual_volume_multiplier]),
        "actions": [
            {"type": "alert", "target": "compliance_team", "parameters": {"priority": "medium"}},
            {"type": "enhanced_monitoring", "target": "user", "parameters": {"duration_days": 7}}
        ]
    }
}

# ============================================
# KYC VERIFICATION RULES (UNIFIED - Presale + Main Platform)
# ============================================

# Rule: KYC Level Requirements (Unified - applies to both presale and main platform)
# Note: Backend services (TransactionVolumeTrackerService) handle cumulative limit checking
# OPA provides additional policy layer for compliance

# Check if transaction exceeds KYC level limit
kyc_insufficient if {
    input.action in ["withdrawal", "investment", "trading"]
    # Get limit from input (provided by backend TransactionVolumeTrackerService)
    input.transaction.amount > input.user.kyc_limit
}

# Check if approaching limit (80% threshold) - warning but allow
kyc_approaching_limit if {
    input.action in ["withdrawal", "investment", "trading"]
    input.user.kyc_usage_percentage >= 80
    input.user.kyc_usage_percentage < 100
}

# Check if at limit (100% threshold) - block
kyc_at_limit if {
    input.action in ["withdrawal", "investment", "trading"]
    input.user.kyc_usage_percentage >= 100
}

allow := false if {
    kyc_insufficient
}

allow := false if {
    kyc_at_limit
}

# KYC insufficient flag (blocking)
kyc_flag contains decision if {
    kyc_insufficient
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "KYC-001",
        "severity": "high",
        "framework": "KYC",
        "reason": sprintf("KYC level %v insufficient for %v amount %v (cumulative usage: %v%%)", [input.user.kyc_level, input.action, input.transaction.amount, input.user.kyc_usage_percentage]),
        "actions": [
            {"type": "block", "target": input.action, "parameters": {}},
            {"type": "notification", "target": "user", "parameters": {"message": "Please complete KYC verification"}},
            {"type": "upgrade_prompt", "target": "user", "parameters": {"required_level": input.user.required_kyc_level, "workflow_url": input.user.workflow_url}},
            {"type": "trigger_workflow", "target": "ballerine", "parameters": {"workflow_type": "kyc_upgrade", "from_level": input.user.kyc_level, "to_level": input.user.required_kyc_level}}
        ]
    }
}

# KYC approaching limit flag (warning)
kyc_warning_flag contains decision if {
    kyc_approaching_limit
    decision := {
        "flagged": true,
        "allowed": true,  # Still allow, but warn
        "rule_id": "KYC-002",
        "severity": "medium",
        "framework": "KYC",
        "reason": sprintf("Approaching KYC level %v limit (usage: %v%%)", [input.user.kyc_level, input.user.kyc_usage_percentage]),
        "actions": [
            {"type": "notification", "target": "user", "parameters": {"message": "You're approaching your transaction limit. Consider upgrading your KYC level."}},
            {"type": "upgrade_recommendation", "target": "user", "parameters": {"recommended_level": input.user.required_kyc_level, "workflow_url": input.user.workflow_url}}
        ]
    }
}

# KYC at limit flag (blocking)
kyc_limit_flag contains decision if {
    kyc_at_limit
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "KYC-003",
        "severity": "high",
        "framework": "KYC",
        "reason": sprintf("KYC level %v limit reached (usage: %v%%)", [input.user.kyc_level, input.user.kyc_usage_percentage]),
        "actions": [
            {"type": "block", "target": input.action, "parameters": {}},
            {"type": "notification", "target": "user", "parameters": {"message": "Your transaction limit has been reached. Please upgrade your KYC level to continue."}},
            {"type": "upgrade_required", "target": "user", "parameters": {"required_level": input.user.required_kyc_level, "workflow_url": input.user.workflow_url}},
            {"type": "trigger_workflow", "target": "ballerine", "parameters": {"workflow_type": "kyc_upgrade", "from_level": input.user.kyc_level, "to_level": input.user.required_kyc_level, "auto_trigger": true}}
        ]
    }
}

# Rule: KYC Expiry Check
kyc_expired if {
    input.action in ["withdrawal", "deposit"]
    input.user.kyc_expiry_date < time.now_ns() / 1000000000
}

allow := false if {
    kyc_expired
}

kyc_expiry_flag contains decision if {
    kyc_expired
    decision := {
        "flagged": true,
        "allowed": false,
        "rule_id": "KYC-002",
        "severity": "high",
        "framework": "KYC",
        "reason": "KYC verification has expired",
        "actions": [
            {"type": "block", "target": "transaction", "parameters": {}},
            {"type": "notification", "target": "user", "parameters": {"message": "Please renew your KYC verification"}},
            {"type": "reverification", "target": "user", "parameters": {}}
        ]
    }
}

# ============================================
# AGGREGATE DECISIONS
# ============================================

# Collect all flagged decisions (including new KYC warning and limit flags)
all_flags := large_transaction_flag | structuring_flag | rapid_movement_flag | high_risk_country_flag | sanctioned_country_flag | pep_flag | new_account_flag | unusual_pattern_flag | kyc_flag | kyc_warning_flag | kyc_limit_flag | kyc_expiry_flag

# Risk assessment based on flags
assess_risk := result if {
    count(all_flags) == 0
    result := {
        "risk_score": 0,
        "risk_level": "low",
        "recommendations": ["Standard processing"]
    }
} else := result if {
    high_severity := [f | some f in all_flags; f.severity == "critical"]
    count(high_severity) > 0
    result := {
        "risk_score": 100,
        "risk_level": "critical",
        "recommendations": ["Immediate review required", "Block all transactions", "File SAR"]
    }
} else := result if {
    high_severity := [f | some f in all_flags; f.severity == "high"]
    count(high_severity) > 0
    result := {
        "risk_score": 75,
        "risk_level": "high",
        "recommendations": ["Priority review required", "Enhanced monitoring", "Consider SAR filing"]
    }
} else := result if {
    medium_severity := [f | some f in all_flags; f.severity == "medium"]
    count(medium_severity) > 0
    result := {
        "risk_score": 50,
        "risk_level": "medium",
        "recommendations": ["Standard review", "Monitor for patterns"]
    }
} else := result if {
    result := {
        "risk_score": 25,
        "risk_level": "low",
        "recommendations": ["Standard processing", "Routine monitoring"]
    }
}

# Compliance report generation
compliance_report := {
    "timestamp": time.now_ns(),
    "transaction_id": input.transaction.id,
    "user_id": input.user.id,
    "flags": all_flags,
    "risk_assessment": assess_risk,
    "allowed": allow,
    "parameters_version": parameters.version
}