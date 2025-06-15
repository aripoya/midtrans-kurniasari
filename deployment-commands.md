# Production Deployment Commands

# 1. Create D1 Database
wrangler d1 create order-management-prod

# 2. Update wrangler.toml with the returned database ID
# Replace "your-d1-database-id" with the actual ID from step 1

# 3. Run database migrations
wrangler d1 execute order-management-prod --file=schema.sql --env production

# 4. Set environment variables (run the setup script)
./setup-env.sh

# 5. Deploy to production
wrangler deploy --env production

# 6. Test the deployment
curl https://order-management-app.your-subdomain.workers.dev/api/config

# Development commands
# Deploy to development
wrangler deploy --env development

# View logs
wrangler tail --env production

# List secrets
wrangler secret list --env production

