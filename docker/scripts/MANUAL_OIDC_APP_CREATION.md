# Manual OIDC App Creation (Fastest Solution)

Since we have console access, let's create the OIDC app manually - it's actually faster!

## Steps in Zitadel Console

1. **Go to your project**: Click **"Projects"** → **"ThaliumX Platform"**

2. **Click "Applications"** tab (you should see it in the project view)

3. **Click "New"** or **"Register app"** button

4. **Select "OIDC"** as the application type

5. **Fill in the form**:
   - **Name**: `thaliumx-backend-local`
   - **Application Type**: `Web` or `Native` (Web is recommended)
   - **Auth Method**: `Client Secret Basic` or `Client Secret Post`
   - **Grant Types**: Check ✅ **"Password"** and ✅ **"Client Credentials"**
   - **Response Types**: Select **"Code"** (or whatever is available)
   - **Redirect URIs**: `http://localhost:3000/callback` (or leave empty for now)
   - **Dev Mode**: Enable ✅ (if available)

6. **Click "Create"** or **"Save"**

7. **Copy the credentials**:
   - **Client ID** (you'll see it immediately)
   - **Client Secret** (click "Show" or "Copy" - save it immediately!)

## What We Need

After creation, share:
- **Client ID**: `...`
- **Client Secret**: `...`

Then I'll update the backend configuration!

## Why Manual is Better Right Now

- ✅ Faster than debugging API enum issues
- ✅ You can see all options in the UI
- ✅ Guaranteed to work
- ✅ Takes 2 minutes vs debugging API format

Once you have the credentials, we're done! 🎉
