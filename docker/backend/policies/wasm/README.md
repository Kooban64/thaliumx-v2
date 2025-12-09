# OPA WASM Policies Directory

This directory contains compiled WASM policies for high-frequency, simple policy checks.

To compile a Rego policy to WASM:

```bash
opa build -t wasm -e rbac/allow policy.rego -o policies/wasm/rbac.wasm
```

Supported policy types:
- rbac.wasm - Role-based access control
- validation.wasm - Field validation rules
