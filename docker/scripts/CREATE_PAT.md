# Create Personal Access Token (PAT)

## ✅ Yes! PAT is What We Need!

**Personal Access Tokens (PAT)** are exactly what we need for the Zitadel Management API!

## Steps to Create PAT

1. Click **"Personal Access Tokens"** in the left menu (you should see it listed)
2. Click **"New"** or **"Generate Token"** button
3. Fill in:
   - **Name**: `Backend Management API` (or any name)
   - **Expiration**: Leave default or set to a future date
   - **Scopes**: Select appropriate scopes (usually includes management API access)
4. Click **"Generate"** or **"Create"**

## Important: Copy the Token Immediately!

After generating:
- **The token will only be shown ONCE**
- Copy it immediately
- It should be a long string (not an RSA key)
- Looks like: `pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## What We'll Do With It

Once you have the PAT, we can:
1. Use it directly with the Management API
2. Create the OIDC app programmatically
3. Complete the setup

## Difference Between Token Types

- **Keys** (RSA) = For JWT signing ❌
- **OAuth Client Secrets** = For client_credentials flow ❌  
- **PAT** = For Management API authentication ✅ (This is what we need!)

## Next Steps

1. Click "Personal Access Tokens"
2. Generate a new token
3. Copy it immediately
4. Share it with me and I'll create the OIDC app!
