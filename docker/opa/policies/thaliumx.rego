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

# Role-based access control (with normalization)
allow if {
    input.user.authenticated == true
    required_roles := role_permissions[input.action][input.resource.type]
    normalized_user_role := normalize_role(input.user.role)
    normalized_user_role in required_roles
}

# Role-based access control using normalized Zitadel roles
allow if {
    input.user.authenticated == true
    required_roles := role_permissions[input.action][input.resource.type]
    normalized_role := normalized_user_roles[_]
    normalized_role in required_roles
}

# Define role permissions
# Format: action -> resource_type -> allowed_roles
# Supports both legacy roles and Zitadel roles
role_permissions := {
    "read": {
        "account": ["admin", "trader", "viewer", "platform-admin", "broker-admin", "broker-trading"],
        "order": ["admin", "trader", "viewer", "platform-admin", "broker-admin", "broker-trading"],
        "trade": ["admin", "trader", "viewer", "platform-admin", "broker-admin", "broker-trading"],
        "position": ["admin", "trader", "viewer", "platform-admin", "broker-admin", "broker-trading"],
        "market_data": ["admin", "trader", "viewer", "public", "platform-admin", "broker-admin", "broker-trading"],
        "user": ["admin", "platform-admin", "broker-admin"],
        "audit_log": ["admin", "compliance", "platform-admin", "platform-compliance", "broker-compliance"],
        "report": ["admin", "compliance", "trader", "platform-admin", "platform-compliance", "broker-compliance", "broker-trading"],
        "workflow": ["admin", "platform-admin", "broker-admin"],
        "transaction": ["admin", "finance", "platform-admin", "platform-finance", "broker-finance"],
    },
    "create": {
        "order": ["admin", "trader", "platform-admin", "broker-admin", "broker-trading"],
        "account": ["admin", "platform-admin", "broker-admin"],
        "user": ["admin", "platform-admin", "broker-admin"],
        "workflow": ["admin", "platform-admin", "broker-admin", "user"],
        "transaction": ["admin", "finance", "user", "platform-admin", "platform-finance", "broker-finance"],
    },
    "update": {
        "order": ["admin", "trader", "platform-admin", "broker-admin", "broker-trading"],
        "account": ["admin", "platform-admin", "broker-admin"],
        "user": ["admin", "platform-admin", "broker-admin"],
        "position": ["admin", "platform-admin", "broker-admin"],
        "workflow": ["admin", "platform-admin", "broker-admin"],
    },
    "delete": {
        "order": ["admin", "trader", "platform-admin", "broker-admin", "broker-trading"],
        "account": ["admin", "platform-admin", "broker-admin"],
        "user": ["admin", "platform-admin", "broker-admin"],
    },
    "cancel": {
        "order": ["admin", "trader", "platform-admin", "broker-admin", "broker-trading"],
        "workflow": ["admin", "platform-admin", "broker-admin"],
    },
    "execute": {
        "trade": ["admin", "system", "platform-admin"],
        "workflow": ["admin", "platform-admin", "broker-admin"],
    },
}

# Admin users have full access (legacy and Zitadel - with normalization)
allow if {
    input.user.authenticated == true
    normalized_role := normalize_role(input.user.role)
    normalized_role == "platform_admin"
}

allow if {
    input.user.authenticated == true
    normalized_role := normalized_user_roles[_]
    normalized_role == "platform_admin"
}

allow if {
    input.user.authenticated == true
    normalized_role := normalized_user_roles[_]
    normalized_role == "master_system_admin"
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