#!/bin/bash

# Seed users via API
# This script creates users for all roles using the registration API

API_URL="${API_URL:-http://localhost:3002}"
PASSWORD="foobarfoobar"

echo "🌱 Seeding users via API..."
echo "API URL: $API_URL"
echo ""

# Function to create user
create_user() {
    local email=$1
    local first_name=$2
    local last_name=$3
    local role=$4
    
    echo "Creating user: $email ($role)..."
    
    # First register the user
    response=$(curl -s -X POST "$API_URL/api/auth/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$email\",
            \"password\": \"$PASSWORD\",
            \"firstName\": \"$first_name\",
            \"lastName\": \"$last_name\"
        }")
    
    if echo "$response" | grep -q "success"; then
        echo "✅ User $email registered successfully"
    else
        echo "⚠️  User $email may already exist or registration failed"
        echo "   Response: $response"
    fi
}

# Create all users
create_user "admin@thaliumx.com" "Admin" "User" "admin"
create_user "superadmin@thaliumx.com" "Super" "Admin" "super_admin"
create_user "platformadmin@thaliumx.com" "Platform" "Admin" "platform-admin"
create_user "broker@thaliumx.com" "Broker" "Admin" "broker_admin"
create_user "broker1@thaliumx.com" "Broker" "One" "broker_1"
create_user "broker2@thaliumx.com" "Broker" "Two" "broker_2"
create_user "user@thaliumx.com" "Regular" "User" "user"
create_user "user1@thaliumx.com" "User" "One" "user"
create_user "user2@thaliumx.com" "User" "Two" "user"
create_user "user3@thaliumx.com" "User" "Three" "user"
create_user "trader@thaliumx.com" "Test" "Trader" "trader"

echo ""
echo "✅ Seeding complete!"
echo "📋 All users have password: $PASSWORD"
echo ""
echo "Note: Roles need to be updated manually via admin panel or database"
