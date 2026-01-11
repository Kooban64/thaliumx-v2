# Create OIDC App - Advanced Mode

## ✅ Skip the Wizard!

The wizard only shows "Authorization Code" grant type, but we need **"Password"** grant.

## Steps

1. **Click "I'm a pro. Skip this wizard."** (top right of the page)

2. **Fill in the advanced form**:
   - **Name**: `thaliumx-backend-local`
   - **Grant Types**: 
     - ✅ **Password** (this is what we need!)
     - ✅ **Client Credentials**
     - ✅ **Authorization Code** (optional, but good to have)
   - **Response Types**: 
     - ✅ **Code** (or whatever is available)
   - **Authentication Method**: 
     - Select **"Basic"** or **"POST"** (both work)
   - **Redirect URIs**: 
     - `http://localhost:3000/callback` (optional for local dev)
   - **Dev Mode**: 
     - Enable ✅ (if available - allows HTTP redirects)

3. **Click "Create"** or **"Save"**

4. **Copy the credentials**:
   - **Client ID**: (shown immediately)
   - **Client Secret**: (click "Show" or "Copy" - save immediately!)

## Why Skip the Wizard?

The wizard is simplified and doesn't show all grant types. The advanced/pro mode shows:
- ✅ Password grant (what we need for backend login)
- ✅ Client Credentials (for service-to-service)
- ✅ All authentication methods
- ✅ Dev mode option

## After Creation

Share:
- **Client ID**: `...`
- **Client Secret**: `...`

Then I'll update the backend and we're done! 🎉
