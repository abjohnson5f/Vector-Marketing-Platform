#!/bin/bash
# Deployment Script - Run this from your local machine
# Usage: ./deploy.sh

set -e

VPS_USER="root"
VPS_HOST="72.62.164.236"
REMOTE_PATH="/var/www/vector-marketing"

echo "🚀 Deploying Vector Marketing API to VPS..."

# Build locally (optional - we use tsx in production)
echo "📦 Preparing files..."

# Sync files to VPS (excluding node_modules and .env)
echo "📤 Uploading to VPS..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude '.git' \
  --exclude 'deploy' \
  --exclude '*.log' \
  ../ ${VPS_USER}@${VPS_HOST}:${REMOTE_PATH}/

# Run remote commands
echo "🔧 Installing dependencies and restarting..."
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/vector-marketing/backend
npm ci --production=false
pm2 restart vector-marketing-api || pm2 start deploy/ecosystem.config.js
pm2 save
ENDSSH

echo ""
echo "✅ Deployment complete!"
echo "🌐 API available at: https://marketing.stiltnerlandscapes.com"
echo ""

