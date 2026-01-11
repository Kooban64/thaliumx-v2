# Get Key Credentials from Dialog

## ✅ Key Generated!

**Key ID**: `354967646174707725`

## Step 1: Download or Copy the Key

The dialog says **"Download the key as it won't be visible after closing this dialog!"**

You need to:

1. **Look for a "Download" button** in the dialog
2. **Or copy the entire content** shown in the dialog
3. The key is likely in **JSON format** containing:
   - `keyId` or `clientId`
   - `key` or `clientSecret`

## Step 2: Extract Credentials

The JSON might look like:
```json
{
  "keyId": "354967646174707725",
  "key": "your-secret-here",
  "clientId": "354967646174707725@zitadel",
  "clientSecret": "your-secret-here"
}
```

Or it might be:
```json
{
  "id": "354967646174707725",
  "secret": "your-secret-here"
}
```

## Step 3: What We Need

We need:
- **Client ID**: Usually `354967646174707725@zitadel` or just the key ID
- **Client Secret**: The actual secret/key value from the JSON

## Alternative: If Dialog Closed

If you already closed the dialog:
1. Click on the **Key ID** (`354967646174707725`) in the Keys list
2. See if there's a way to view or regenerate the secret
3. Or generate a new key

## Next Steps

Once you have both:
- Client ID
- Client Secret

Share them and I'll run the automation script!
