# Cloudflare Workers Environment Setup Script

# This script helps you configure environment variables for production deployment

echo "🚀 Setting up Cloudflare Workers Environment Variables"
echo "=================================================="

# Set secrets (sensitive data)
echo "Setting up Midtrans credentials..."
wrangler secret put MIDTRANS_SERVER_KEY --env production
wrangler secret put MIDTRANS_CLIENT_KEY --env production
wrangler secret put WEBHOOK_SECRET --env production

# Optional: Email configuration
echo "Setting up email configuration (optional)..."
read -p "Do you want to configure email settings? (y/n): " configure_email
if [ "$configure_email" = "y" ]; then
    wrangler secret put SMTP_HOST --env production
    wrangler secret put SMTP_PORT --env production
    wrangler secret put SMTP_USER --env production
    wrangler secret put SMTP_PASS --env production
fi

echo "✅ Environment variables configured!"
echo ""
echo "Next steps:"
echo "1. Create D1 database: wrangler d1 create order-management-prod"
echo "2. Update wrangler.toml with the database ID"
echo "3. Run database migrations: wrangler d1 execute order-management-prod --file=schema.sql --env production"
echo "4. Deploy: wrangler deploy --env production"

