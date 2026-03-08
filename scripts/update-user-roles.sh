#!/bin/bash

# Update user roles via database
# This script updates user roles directly in the database

DB_CONTAINER="${DB_CONTAINER:-thaliumx-postgres}"
DB_NAME="${DB_NAME:-thaliumx}"
DB_USER="${DB_USER:-thaliumx}"

echo "🔧 Updating user roles in database..."
echo ""

# Function to update user role
update_role() {
    local email=$1
    local role=$2
    
    echo "Updating $email to role: $role..."
    
    result=$(docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "
        UPDATE users 
        SET role = '$role', \"updatedAt\" = NOW()
        WHERE email = '$email'
        RETURNING email;
    " 2>&1)
    
    if echo "$result" | grep -q "$email"; then
        echo "✅ Updated $email to $role"
        return 0
    else
        echo "❌ Failed to update $email: $result"
        return 1
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ Updated $email to $role"
    else
        echo "❌ Failed to update $email"
    fi
}

# Update all user roles
update_role "admin@thaliumx.com" "admin"
update_role "superadmin@thaliumx.com" "super_admin"
update_role "platformadmin@thaliumx.com" "platform-admin"
update_role "broker@thaliumx.com" "broker_admin"
update_role "broker1@thaliumx.com" "broker_1"
update_role "broker2@thaliumx.com" "broker_2"
update_role "user@thaliumx.com" "user"
update_role "user1@thaliumx.com" "user"
update_role "user2@thaliumx.com" "user"
update_role "user3@thaliumx.com" "user"
update_role "trader@thaliumx.com" "trader"

echo ""
echo "✅ Role updates complete!"
