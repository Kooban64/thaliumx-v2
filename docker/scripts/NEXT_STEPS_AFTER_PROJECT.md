# Next Steps After Creating Project

## ✅ You've Created the Project!

**Project ID**: `354966915090743309` (save this!)

## Step 1: Create Service Account (Machine User)

**Before creating the OIDC app, we need a service account to use the Management API.**

1. Click **"Users"** in the left sidebar
2. Look for **"Service Users"** or **"Machine Users"** tab
3. Click **"New"** or **"Create"** button
4. Fill in:
   - **Username**: `thaliumx-backend-service`
   - **Name**: `ThaliumX Backend Service Account`
   - **Description**: `Service account for backend API authentication`
5. Click **"Create"**

## Step 2: Generate Client Secret for Service Account

1. After creating, you'll see the service account details page
2. Look for **"Secrets"** or **"Client Secrets"** section
3. Click **"Generate Secret"** or **"New Secret"**
4. **CRITICAL**: Copy both:
   - **Client ID** (looks like: `123456789012345678@zitadel`)
   - **Client Secret** (long random string)
5. **Save these immediately!**

## Step 3: Run Automation Script

Once you have the service account credentials, run:

```bash
cd /home/ubuntu/thaliumx-v1

# Copy script to backend
docker cp docker/scripts/create-oidc-app-with-service-account.js thaliumx-backend:/tmp/

# Run with your credentials
docker exec thaliumx-backend node /tmp/create-oidc-app-with-service-account.js \
  <SERVICE_ACCOUNT_CLIENT_ID> \
  <SERVICE_ACCOUNT_CLIENT_SECRET> \
  354966915090743309
```

**Note**: The script takes arguments in this order:
1. Service Account Client ID
2. Service Account Client Secret
3. Project ID: `354966915090743309` (optional, but recommended)

## About Token Type

If you're seeing "bearer" or "jwt" options while creating an application:
- **Choose "JWT"** - This is the standard token type for OIDC applications
- Our automation script will handle creating the OIDC app with the correct settings

## What the Script Does

The automation script will:
1. ✅ Authenticate with your service account
2. ✅ Create an OIDC application in your project
3. ✅ Enable password grant flow
4. ✅ Configure it for user authentication
5. ✅ Output the OIDC client ID and secret

## After Running the Script

You'll get OIDC client credentials. Then we'll:
1. Update backend configuration
2. Restart backend
3. Test the login flow

---

**Current Status:**
- ✅ Project created (ID: 354966915090743309)
- ⏳ Need: Service account with client ID and secret
- ⏳ Then: Run automation script
