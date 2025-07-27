#!/bin/bash

echo "==================================="
echo "🚀 Cloudflare Images Setup Script"
echo "==================================="
echo

# Function to validate input
validate_input() {
    if [ -z "$1" ]; then
        echo "❌ Error: Input cannot be empty"
        return 1
    fi
    return 0
}

# Get Account ID
echo "📋 Step 1: Account ID"
echo "Get this from Cloudflare Dashboard → Right sidebar"
echo "Example: 1234567890abcdef1234567890abcdef"
echo
read -p "Enter your Cloudflare Account ID: " ACCOUNT_ID

if ! validate_input "$ACCOUNT_ID"; then
    echo "Please run the script again with valid Account ID"
    exit 1
fi

# Get API Token
echo
echo "🔑 Step 2: API Token"
echo "Create at: Cloudflare Dashboard → Profile → API Tokens → Create Token"
echo "Permission: Account: Cloudflare Images:Edit"
echo
read -p "Enter your Cloudflare Images API Token: " API_TOKEN

if ! validate_input "$API_TOKEN"; then
    echo "Please run the script again with valid API Token"
    exit 1
fi

# Get Images Hash
echo
echo "🖼️  Step 3: Images Hash"
echo "Get from: Images → Overview → Delivery URL"
echo "Example: abcdef1234567890abcd"
echo
read -p "Enter your Cloudflare Images Hash: " IMAGES_HASH

if ! validate_input "$IMAGES_HASH"; then
    echo "Please run the script again with valid Images Hash"
    exit 1
fi

echo
echo "==================================="
echo "🧪 Testing Credentials..."
echo "==================================="

# Test the credentials
echo "Testing API access..."
RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/images/v1" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json")

# Check if the response contains success: true
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Credentials are valid!"
    echo
    
    echo "==================================="
    echo "💾 Setting up Wrangler Secrets..."
    echo "==================================="
    
    # Set secrets for production environment
    echo "Setting CLOUDFLARE_ACCOUNT_ID..."
    echo "$ACCOUNT_ID" | wrangler secret put CLOUDFLARE_ACCOUNT_ID --env production
    
    echo "Setting CLOUDFLARE_IMAGES_TOKEN..."
    echo "$API_TOKEN" | wrangler secret put CLOUDFLARE_IMAGES_TOKEN --env production
    
    echo "Setting CLOUDFLARE_IMAGES_HASH..."
    echo "$IMAGES_HASH" | wrangler secret put CLOUDFLARE_IMAGES_HASH --env production
    
    echo
    echo "✅ All secrets have been set for production environment!"
    echo
    echo "==================================="
    echo "🚀 Next Steps:"
    echo "==================================="
    echo "1. Deploy your worker: wrangler deploy --env production"
    echo "2. Test image upload in your admin panel"
    echo "3. Check that images load without corruption"
    echo
    echo "Your image delivery URL format will be:"
    echo "https://imagedelivery.net/$IMAGES_HASH/[IMAGE_ID]/[VARIANT]"
    echo
    echo "Available variants: thumbnail, medium, large, public"
    
else
    echo "❌ Credentials test failed!"
    echo "Response: $RESPONSE"
    echo
    echo "Please check:"
    echo "1. Account ID is correct"
    echo "2. API Token has 'Cloudflare Images:Edit' permission"
    echo "3. Token is not expired"
    echo "4. Cloudflare Images is enabled for your account"
fi
