#!/bin/bash
set -e

echo "=== WPVault Server Setup ==="
echo "Run this script as root on Ubuntu 22.04"

APP_USER="app"
APP_DIR="/home/app"
TMP_DIR="/tmp/downloads"

apt update && apt upgrade -y
apt install -y python3.11 python3-pip python3.11-venv nginx certbot python3-certbot-nginx git curl

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

if ! id -u "$APP_USER" >/dev/null 2>&1; then
    useradd -m -d "$APP_DIR" -s /bin/bash "$APP_USER"
fi

mkdir -p "$APP_DIR"
mkdir -p "$TMP_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR" "$TMP_DIR"

cp -r ./* "$APP_DIR"/ 2>/dev/null || true

if [ -f ".env" ]; then
    cp .env "$APP_DIR/.env" 2>/dev/null || true
elif [ ! -f "$APP_DIR/.env" ] && [ -f ".env.example" ]; then
    cp .env.example "$APP_DIR/.env" 2>/dev/null || true
fi

if [ ! -d "$APP_DIR/venv" ]; then
    sudo -u "$APP_USER" -H python3.11 -m venv "$APP_DIR/venv"
fi

sudo -u "$APP_USER" -H bash -c "source '$APP_DIR/venv/bin/activate' && pip install --upgrade pip"
sudo -u "$APP_USER" -H bash -c "source '$APP_DIR/venv/bin/activate' && pip install -r '$APP_DIR/requirements.txt'"

playwright install-deps
sudo -u "$APP_USER" -H bash -c "source '$APP_DIR/venv/bin/activate' && playwright install chromium"

echo "Initializing database..."
sudo -u "$APP_USER" -H bash -c "source '$APP_DIR/venv/bin/activate' && python3 -c 'import database; database.init_db()'"

echo "Performing initial login..."
sudo -u "$APP_USER" -H bash -c "source '$APP_DIR/venv/bin/activate' && python3 -c 'import session_manager; session_manager.login_and_save_session()'" || echo "Login failed - update .env credentials and retry manually"

echo "Running initial sync..."
sudo -u "$APP_USER" -H bash -c "source '$APP_DIR/venv/bin/activate' && python3 -c 'import watcher; watcher.run_sync()'" || echo "Initial sync failed - will retry on scheduler"

echo "Starting PM2 processes..."
sudo -u "$APP_USER" -H pm2 start "$APP_DIR/ecosystem.config.js"
sudo -u "$APP_USER" -H pm2 save
pm2 startup systemd -u "$APP_USER" --hp "$APP_DIR" || true

echo "Setting up Nginx..."
cp "$APP_DIR/nginx.conf" /etc/nginx/sites-available/wpvault
ln -sf /etc/nginx/sites-available/wpvault /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "=== Setup Complete ==="
echo "1. Update $APP_DIR/.env with your actual credentials (JWT_SECRET is required)"
echo "2. Update /etc/nginx/sites-available/wpvault with your domain"
echo "3. Run: certbot --nginx -d yourdomain.com -d www.yourdomain.com"
echo "4. Restart PM2 (as $APP_USER): sudo -u $APP_USER -H pm2 restart all"
echo ""
echo "Admin bootstrap: set ADMIN_EMAIL and ADMIN_PASSWORD in $APP_DIR/.env then re-run init_db"
echo ""
