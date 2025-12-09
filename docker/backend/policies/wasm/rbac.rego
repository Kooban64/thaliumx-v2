package rbac

# RBAC policy for ThaliumX
# This policy evaluates role-based access control decisions

default allow = false

# Allow if user has required role
allow {
    input.user.role == input.resource.required_role
}

# Allow if user has admin role (admin can do everything)
allow {
    input.user.role == "admin"
}

# Allow if user has super_admin role (super admin can do everything)
allow {
    input.user.role == "super_admin"
}

# Allow broker_admin to manage their own broker
allow {
    input.user.role == "broker_admin"
    input.resource.broker_id == input.user.broker_id
}

# Allow tenant_admin to manage their own tenant
allow {
    input.user.role == "tenant_admin"
    input.resource.tenant_id == input.user.tenant_id
}

# Allow user to access their own resources
allow {
    input.resource.user_id == input.user.user_id
}

# Allow compliance officer to access compliance-related resources
allow {
    input.user.role == "compliance_officer"
    input.resource.type == "compliance"
}

# Allow risk officer to access risk-related resources
allow {
    input.user.role == "risk_officer"
    input.resource.type == "risk"
}

# Allow auditor to access audit-related resources
allow {
    input.user.role == "auditor"
    input.resource.type == "audit"
}