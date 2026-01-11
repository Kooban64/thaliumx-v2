# Correct Zitadel Login Credentials

## Issue
You're getting "User could not be found" when trying to login with `root@localhost`.

## Solution

The actual username in the database is **`root@zitadel.localhost`**, not `root@localhost`.

### Try These Login Names:

1. **`root@zitadel.localhost`** ← Most likely (matches database)
2. **`root@localhost`** ← If Zitadel accepts domain aliases
3. **`root@auth.thaliumx.com`** ← If configured domain works

### Password:
```
Aa1!30ad3716f234d05666ef744b178e
```

## Why This Happened

Zitadel creates the first admin user with the format `root@<domain>`. The domain used was `zitadel.localhost` (the generated instance domain), not `localhost` (the external domain).

## Verification

You can verify the correct username by checking the database:

```bash
docker exec thaliumx-zitadel-postgres psql -U root -d zitadel -c \
  "SELECT username FROM projections.users10 WHERE username LIKE '%root%';"
```

This should show: `root@zitadel.localhost`

## Next Steps

Once you successfully login:
1. Create a service account
2. Generate client secret
3. Run the automation script to create OIDC app
