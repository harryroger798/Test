#!/bin/bash
set -e

echo "=== WPVault Server Setup ==="
echo "Run this script as root on Ubuntu 22.04"

apt update && apt upgrade -y
apt install -y python3.11 python3-pip python3.11-venv nginx certbot python3-certbot-nginx git curl

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

mkdir -p /home/app
mkdir -p /tmp/downloads

if [ ! -d "/home/app/venv" ]; then
    python3.11 -m venv /home/app/venv
fi

cp -r ./* /home/app/ 2>/dev/null || true
cp .env /home/app/.env 2>/dev/null || true

cd /home/app
source venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt

playwright install chromium
playwright install-deps

echo "Initializing database..."
python3 -c "import database; database.init_db()"

echo "Performing initial login..."
python3 -c "import session_manager; session_manager.login_and_save_session()" || echo "Login failed - update .env credentials and retry manually"

echo "Running initial sync..."
python3 -c "import watcher; watcher.run_sync()" || echo "Initial sync failed - will retry on scheduler"

echo "Starting PM2 processes..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "Setting up Nginx..."
cp nginx.conf /etc/nginx/sites-available/wpvault
ln -sf /etc/nginx/sites-available/wpvault /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "=== Setup Complete ==="
echo "1. Update /home/app/.env with your actual credentials"
echo "2. Update /etc/nginx/sites-available/wpvault with your domain"
echo "3. Run: certbot --nginx -d yourdomain.com -d www.yourdomain.com"
echo "4. Restart PM2: pm2 restart all"
echo ""
echo "Default admin: admin@wpvault.com / admin123"
echo ""
