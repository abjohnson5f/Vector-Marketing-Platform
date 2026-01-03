#!/bin/bash
set -e

echo "🚀 Deploying Vector Marketing Frontend..."

cd /var/www/vector-marketing

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install

# Create production .env for frontend
echo "📝 Creating frontend environment..."
cat > .env.local << 'EOF'
VITE_API_URL=/api
EOF

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Create frontend directory and move build
echo "📁 Setting up frontend files..."
mkdir -p /var/www/vector-marketing/frontend
rm -rf /var/www/vector-marketing/frontend/dist
mv dist /var/www/vector-marketing/frontend/

# Update Nginx config
echo "🔧 Updating Nginx configuration..."
cp /var/www/vector-marketing/backend/deploy/nginx-full.conf /etc/nginx/sites-available/marketing.stiltnerlandscapes.com

# Test and reload Nginx
echo "✅ Testing Nginx config..."
nginx -t

echo "🔄 Reloading Nginx..."
systemctl reload nginx

echo ""
echo "✅ Frontend deployed successfully!"
echo "🌐 Visit: https://marketing.stiltnerlandscapes.com"

