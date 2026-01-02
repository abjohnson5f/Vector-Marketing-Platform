#!/bin/bash
# VPS Setup Script for Vector Marketing API
# Run as root on Ubuntu 24.04

set -e

echo "🚀 Setting up Vector Marketing API on VPS..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 20 LTS
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Install Nginx
echo "📦 Installing Nginx..."
apt install -y nginx

# Install Certbot for SSL
echo "📦 Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# Create app directory
echo "📁 Creating app directory..."
mkdir -p /var/www/vector-marketing
mkdir -p /var/log/vector-marketing

# Set permissions
chown -R www-data:www-data /var/www/vector-marketing
chown -R www-data:www-data /var/log/vector-marketing

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Start and enable Nginx
systemctl start nginx
systemctl enable nginx

echo ""
echo "✅ VPS setup complete!"
echo ""
echo "Next steps:"
echo "1. Upload your code to /var/www/vector-marketing/"
echo "2. Copy nginx.conf to /etc/nginx/sites-available/marketing.stiltnerlandscapes.com"
echo "3. Run: ln -s /etc/nginx/sites-available/marketing.stiltnerlandscapes.com /etc/nginx/sites-enabled/"
echo "4. Get SSL cert: certbot --nginx -d marketing.stiltnerlandscapes.com"
echo "5. Start the app: pm2 start ecosystem.config.js"
echo ""

