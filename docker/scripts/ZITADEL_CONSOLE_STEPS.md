# Step-by-Step: Create Service Account in Zitadel Console

## You're Now Logged In! ✅

Follow these steps to create a service account that we'll use to automate the OIDC app creation.

## Step 1: Create a Project (If Not Already Created)

1. Click on **"Projects"** in the left sidebar
2. Click **"Create project"** (or **"New"** button)
3. Enter:
   - **Name**: `ThaliumX Platform`
   - **Description**: `Main project for ThaliumX platform authentication`
4. Click **"Create"** or **"Save"**
5. **IMPORTANT**: Copy the **Project ID** - you'll need it later!

## Step 2: Create a Service Account (Machine User)

1. Click on **"Users"** in the left sidebar
2. Look for **"Service Users"** or **"Machine Users"** tab/section
3. Click **"New"** or **"Create"** button
4. Fill in:
   - **Username**: `thaliumx-backend-service`
   - **Name**: `ThaliumX Backend Service Account`
   - **Description**: `Service account for backend API authentication`
5. Click **"Create"** or **"Save"**

## Step 3: Generate Client Secret

1. After creating the service account, you'll see its details page
2. Look for **"Secrets"** or **"Client Secrets"** section
3. Click **"Generate Secret"** or **"New Secret"** button
4. **CRITICAL**: Copy both:
   - **Client ID** (looks like: `123456789012345678@zitadel`)
   - **Client Secret** (a long random string)
5. **Save these immediately** - the secret won't be shown again!

## Step 4: Grant Project Access (If Needed)

1. Go to **"Projects"** → Select your project
2. Go to **"Authorizations"** or **"Roles"**
3. Add the service account with appropriate roles (usually `PROJECT_OWNER` or `PROJECT_OWNER_VIEWER`)

## Step 5: Run Automation Script

Once you have the Client ID and Client Secret, run:

```bash
cd /home/ubuntu/thaliumx-v1

# Copy script to backend container
docker cp docker/scripts/create-oidc-app-with-service-account.js thaliumx-backend:/tmp/

# Run with your credentials (replace with actual values)
docker exec thaliumx-backend node /tmp/create-oidc-app-with-service-account.js \
  <YOUR_CLIENT_ID> \
  <YOUR_CLIENT_SECRET> \
  353322233650937880
```

This will automatically:
- ✅ Authenticate with the service account
- ✅ Create an OIDC app with password grant enabled
- ✅ Output the OIDC client ID and secret for your backend

## Step 6: Update Backend Configuration

From the script output, you'll get OIDC client credentials. Update `docker/core/compose.yaml`:

```yaml
environment:
  - ZITADEL_SERVICE_ACCOUNT_ID=<OIDC_CLIENT_ID>
  - ZITADEL_SERVICE_ACCOUNT_KEY=<OIDC_CLIENT_SECRET>
  - ZITADEL_OIDC_CLIENT_ID=<OIDC_CLIENT_ID>
  - ZITADEL_OIDC_CLIENT_SECRET=<OIDC_CLIENT_SECRET>
```

## Step 7: Restart Backend

```bash
docker restart thaliumx-backend
```

## Troubleshooting

### Can't Find "Service Users"?
- Look for **"Machine Users"** or **"Service Accounts"**
- It might be under **"Users"** → **"Service Users"** tab

### Can't Generate Secret?
- Make sure you're viewing the service account details page
- Look for **"Secrets"**, **"Client Secrets"**, or **"API Keys"** section
- Some versions use **"Generate API Key"** instead

### Project ID Not Found?
- Check the URL when viewing the project: `.../projects/<PROJECT_ID>`
- Or check the project details page for the ID

## Quick Reference

- **Service Account Username**: `thaliumx-backend-service`
- **Project ID**: `353322233650937880` (if using existing project)
- **Script Location**: `docker/scripts/create-oidc-app-with-service-account.js`
