# ThaliumX JWT Authentication Setup

> **Last Updated**: March 2026
> **Status**: Active - Primary Authentication System

## Overview

ThaliumX uses an internal JWT (JSON Web Token) authentication system as the primary and only authentication method. This document describes the JWT-based authentication system.

## Architecture

### Authentication Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│   Backend    │────▶│   Token     │
│  (Frontend) │     │   API        │     │  Validation │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌──────────────┐     ┌─────────────┐
                    │   JWT        │     │   Database  │
                    │   Generation │     │   (Users)   │
                    └──────────────┘     └─────────────┘
```

### Token Types

1. **Access Token** (JWT)
   - Short-lived token (default: 15 minutes)
   - Used for API authentication
   - Contains user identity and permissions

2. **Refresh Token**
   - Long-lived token (default: 7 days)
   - Used to obtain new access tokens
   - Stored securely (HttpOnly cookies)

## Configuration

### Environment Variables

```bash
# JWT Configuration (Required)
JWT_SECRET=your-secure-secret-key-min-32-chars
JWT_EXPIRES_IN=15m              # Access token expiry
JWT_REFRESH_EXPIRES_IN=7d       # Refresh token expiry  
JWT_ISSUER=thaliumx             # Token issuer
JWT_AUDIENCE=thaliumx-users    # Expected audience

# Optional: Override defaults
PORT=3002
NODE_ENV=production
```

### Secret Requirements

- **JWT Secret**: Minimum 32 characters
- **Production**: Must be at least 32 characters
- **Development**: Auto-generates test secret if not provided

## Token Structure

### Access Token Claims

```json
{
  "sub": "user-id-uuid",
  "email": "user@example.com",
  "role": "admin",
  "permissions": ["read", "write", "delete"],
  "iat": 1700000000,
  "exp": 1700000900,
  "iss": "thaliumx",
  "aud": "thaliumx-users"
}
```

### Refresh Token Claims

```json
{
  "sub": "user-id-uuid",
  "type": "refresh",
  "iat": 1700000000,
  "exp": 1700600000,
  "iss": "thaliumx",
  "aud": "thaliumx-users"
}
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login, returns tokens |
| POST | `/api/auth/logout` | User logout, invalidates refresh token |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/forgot-password` | Password reset request |
| POST | `/api/auth/reset-password` | Password reset |

### Token Validation

All authenticated endpoints validate the JWT Bearer token in the Authorization header:

```bash
curl -H "Authorization: Bearer <access_token>" \
  https://api.thaliumx.com/api/users/me
```

## Security Features

### Token Security

1. **Short-lived Access Tokens**: 15-minute expiry reduces window of opportunity for attacks
2. **Secure Storage**: Refresh tokens stored as HttpOnly cookies
3. **Token Rotation**: Refresh tokens rotated on each use
4. **Signature Verification**: RS256 algorithm for token signing

### Additional Security

1. **Rate Limiting**: 100 requests per 15 minutes per IP
2. **CORS**: Configured origin whitelist
3. **Encryption**: All tokens encrypted in transit (TLS)
4. **Audit Logging**: All authentication events logged

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  mfa_enabled BOOLEAN DEFAULT false,
  permissions JSONB DEFAULT '[]'
);
```

## Migration from Legacy Systems

### Previous Systems (Deprecated)

The following identity providers were previously supported but are now deprecated:

- **Authentik**: Removed March 2026
- **Keycloak**: Never fully implemented
- **Zitadel**: Deprecated in favor of internal JWT

### Migration Notes

1. Users previously linked via `authentik_id` now use internal JWT
2. All authentication flows now use the standard JWT flow
3. No action required for existing users - tokens generated on login

## Troubleshooting

### Common Issues

1. **Token Expired**
   - Refresh the access token using the refresh token
   - If refresh token expired, user must re-login

2. **Invalid Signature**
   - Verify JWT_SECRET matches across all instances
   - Check for typos in secret configuration

3. **Token Not in Header**
   - Ensure Authorization header format: `Bearer <token>`
   - Check for missing or extra spaces

### Logging

Authentication events are logged with level `info`:

```
[AUTH] User login successful: user@example.com
[AUTH] Token refresh: user-id-uuid
[AUTH] Logout: user-id-uuid
[AUTH] Failed login attempt: invalid credentials
```

## Best Practices

1. **Never expose JWT_SECRET** in client-side code
2. **Use HTTPS** in production
3. **Implement token rotation** for refresh tokens
4. **Monitor authentication logs** for suspicious activity
5. **Set appropriate token expiry** based on use case
6. **Use strong JWT secrets** (minimum 32 characters, use random string)

## References

- [RFC 7519: JSON Web Token (JWT)](https://tools.ietf.org/html/rfc7519)
- [RFC 7523: OAuth 2.0 JWT Bearer Tokens](https://tools.ietf.org/html/rfc7523)
- [OWASP JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html)
