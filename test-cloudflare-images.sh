#!/bin/bash

# Test Cloudflare Images credentials
# Replace with your actual credentials

ACCOUNT_ID="your-account-id-here"
API_TOKEN="your-api-token-here"

echo "Testing Cloudflare Images API..."
echo "Account ID: $ACCOUNT_ID"
echo "API Token: ${API_TOKEN:0:20}..."

# Test API access
curl -X GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/images/v1" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "If you see 'success: true' above, your credentials are working!"
echo "If you see errors, double-check your Account ID and API Token."
