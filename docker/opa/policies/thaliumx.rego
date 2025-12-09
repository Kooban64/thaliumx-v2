# Thaliumx Platform Authorization Policies
# =========================================
# This policy defines authorization rules for the Thaliumx trading platform

package thaliumx.authz

import future.keywords.if
import future.keywords.in

# Default deny all requests
default allow := false

# Allow health check endpoints
allow if {
    input.path == ["health"]
}

allow if {
    input.path == ["ready"]
}

# Allow authenticated users to access their own resources
allow if {
    input.user.authenticated == true
    input.user.id == input.resource.owner_id
}

# Role-based access control
allow if {
    input.user.authenticated == true
    required_role := role_permissions[input.action][input.resource.type]
    input.user.role in required_role
}

# Define role permissions
# Format: action -> resource_type -> allowed_roles
role_permissions := {
    "read": {
        "account": ["admin", "trader", "viewer"],
        "order": ["admin", "trader", "viewer"],
        "trade": ["admin", "trader", "viewer"],
        "position": ["admin", "trader", "viewer"],
        "market_data": ["admin", "trader", "viewer", "public"],
        "user": ["admin"],
        "audit_log": ["admin", "compliance"],
        "report": ["admin", "compliance", "trader"],
    },
    "create": {
        "order": ["admin", "trader"],
        "account": ["admin"],
        "user": ["admin"],
    },
    "update": {
        "order": ["admin", "trader"],
        "account": ["admin"],
        "user": ["admin"],
        "position": ["admin"],
    },
    "delete": {
        "order": ["admin", "trader"],
        "account": ["admin"],
        "user": ["admin"],
    },
    "cancel": {
        "order": ["admin", "trader"],
    },
    "execute": {
        "trade": ["admin", "system"],
    },
}

# Admin users have full access
allow if {
    input.user.authenticated == true
    input.user.role == "admin"
}

# System service accounts have full access
allow if {
    input.user.authenticated == true
    input.user.type == "service"
    input.user.role == "system"
}

# Trading hours restriction (example: only allow trading during market hours)
trading_allowed if {
    # This is a placeholder - in production, you'd check actual market hours
    true
}

# Order validation rules
valid_order if {
    input.resource.type == "order"
    input.resource.quantity > 0
    input.resource.price > 0
}

# Risk limits check
within_risk_limits if {
    input.resource.type == "order"
    input.resource.value <= input.user.risk_limit
}

# Compliance check - prevent wash trading
not_wash_trade if {
    input.resource.type == "order"
    input.resource.counterparty_id != input.user.id
}

# API rate limiting metadata (for use with APISIX)
rate_limit_tier := tier if {
    input.user.role == "admin"
    tier := "unlimited"
} else := tier if {
    input.user.role == "trader"
    tier := "high"
} else := tier if {
    input.user.role == "viewer"
    tier := "medium"
} else := tier if {
    tier := "low"
}

# Audit logging decision
should_audit := true if {
    input.action in ["create", "update", "delete", "execute", "cancel"]
}

should_audit := true if {
    input.resource.type in ["user", "account", "audit_log"]
}

should_audit := false if {
    input.action == "read"
    input.resource.type == "market_data"
}