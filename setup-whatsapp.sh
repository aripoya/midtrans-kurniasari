#!/bin/bash

# WhatsApp API Setup Script
# This script will set up WhatsApp API credentials for Cloudflare Workers

echo "🔧 Setting up WhatsApp API credentials..."
echo ""

# WhatsApp API URL
WHATSAPP_API_URL="https://graph.facebook.com/v18.0/847534093847372/messages"

# WhatsApp API Token (from Facebook Business Manager)
WHATSAPP_API_TOKEN="CmBKKwjEtb5RjJbFAhfGZW5DQndihiJCYWtwaWEgS3VybmlhIFNhcmlQbzgyaygYaQ9gvcvEEzjmek5Rmoxjt0hT7aU4H98wD+otUzLLk0Jxe+vzotcqBCNzJQARoQebUZP7uCwPdldQYJ3MLEEdeg7Aw5Lm02ELqJbbTBVqYpS2peC6gXuThXc5YuPo5SO6tPJBNzfpdalN+CQff2kRdB46s="

echo "📱 Setting WHATSAPP_API_URL..."
echo "$WHATSAPP_API_URL" | wrangler secret put WHATSAPP_API_URL --env production

echo ""
echo "🔑 Setting WHATSAPP_API_TOKEN..."
echo "$WHATSAPP_API_TOKEN" | wrangler secret put WHATSAPP_API_TOKEN --env production

echo ""
echo "✅ WhatsApp API credentials have been set!"
echo ""
echo "Next steps:"
echo "1. Update outlet phone numbers in database"
echo "2. Test by creating a new order"
echo ""
