#!/bin/sh
set -e

# Ballerine Vault-integrated entrypoint
# Fetches secrets from HashiCorp Vault at container startup using Node.js

echo "Fetching secrets from Vault..."

# Use Node.js to fetch secrets from Vault
SECRETS_OUTPUT=$(node /vault-secrets.js)

if [ $? -ne 0 ]; then
  echo "ERROR: Failed to fetch secrets from Vault"
  echo "$SECRETS_OUTPUT"
  exit 1
fi

# Debug: show the raw output
echo "DEBUG: Raw secrets output:"
echo "$SECRETS_OUTPUT"

# Preserve the correct BCRYPT_SALT if it's already set to the scrypt format
ORIGINAL_BCRYPT_SALT="$BCRYPT_SALT"
echo "DEBUG: Original BCRYPT_SALT: '$ORIGINAL_BCRYPT_SALT'"

# Evaluate the export statements
eval "$SECRETS_OUTPUT"

echo "DEBUG: After Vault load - BCRYPT_SALT: '$BCRYPT_SALT'"

# Restore the correct BCRYPT_SALT if it was overwritten by Vault
if [ -n "$ORIGINAL_BCRYPT_SALT" ] && [ "$ORIGINAL_BCRYPT_SALT" != "$BCRYPT_SALT" ]; then
  if [[ "$ORIGINAL_BCRYPT_SALT" == \$7\$* ]]; then
    export BCRYPT_SALT="$ORIGINAL_BCRYPT_SALT"
    echo "Restored correct BCRYPT_SALT (scrypt format)"
  fi
fi

echo "Secrets loaded successfully from Vault"
echo "BCRYPT_SALT is set: $([ -n "$BCRYPT_SALT" ] && echo 'yes' || echo 'no')"
echo "BCRYPT_SALT value: $BCRYPT_SALT"
echo "BCRYPT_SALT length: ${#BCRYPT_SALT}"
echo "SESSION_SECRET is set: $([ -n "$SESSION_SECRET" ] && echo 'yes' || echo 'no')"
echo "API_KEY is set: $([ -n "$API_KEY" ] && echo 'yes' || echo 'no')"
echo "DB_URL is set: $([ -n "$DB_URL" ] && echo 'yes' || echo 'no')"

# Call the original docker-entrypoint.sh with the command
exec /usr/local/bin/docker-entrypoint.sh "$@"