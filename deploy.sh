#!/bin/bash

# Crypto Payment Gateway Deployment Script
# Phase 4: Crossmint Integration

echo "🚀 Deploying Crypto Payment Gateway with Crossmint Integration..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found. Please copy .env.example and configure it."
    exit 1
fi

# Check required environment variables
required_vars=("CROSSMINT_CLIENT_ID" "CROSSMINT_API_KEY" "CROSSMINT_ENVIRONMENT" "BASE_URL")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set in .env file"
        exit 1
    fi
done

# Build the project
echo "📦 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix errors and try again."
    exit 1
fi

echo "✅ Build successful!"

# Run tests (optional)
# echo "🧪 Running tests..."
# npm test
# if [ $? -ne 0 ]; then
#     echo "❌ Tests failed. Please fix and try again."
#     exit 1
# fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "📥 Installing PM2..."
    npm install -g pm2
fi

# Stop existing PM2 process if running
echo "🛑 Stopping existing process..."
pm2 stop crypto-payment-gateway 2>/dev/null || true
pm2 delete crypto-payment-gateway 2>/dev/null || true

# Start the application with PM2
echo "🚀 Starting application with PM2..."
pm2 start dist/index.js --name crypto-payment-gateway \
    --log logs/app.log \
    --error logs/error.log \
    --time \
    --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
echo "⚙️  Setting up PM2 startup script..."
pm2 startup

echo "✅ Deployment complete!"
echo ""
echo "📊 Application Status:"
pm2 status crypto-payment-gateway

echo ""
echo "🔗 Application URLs:"
echo "   - Checkout Page: ${BASE_URL}/checkout"
echo "   - API Documentation: ${BASE_URL}/api/v1"
echo "   - Health Check: ${BASE_URL}/health"

echo ""
echo "📝 Useful commands:"
echo "   - View logs: pm2 logs crypto-payment-gateway"
echo "   - Monitor: pm2 monit"
echo "   - Restart: pm2 restart crypto-payment-gateway"
echo "   - Stop: pm2 stop crypto-payment-gateway"

echo ""
echo "⚠️  Next Steps:"
echo "   1. Add payment method in Crossmint dashboard"
echo "   2. Configure webhook URL: ${BASE_URL}/api/crossmint/webhook"
echo "   3. Test with a live transaction"
echo "   4. Monitor logs for any issues"