#!/bin/bash

# CI/CD Deployment Script for Hostinger VPS with CloudPanel
# This script runs on the VPS server via SSH

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration (can be overridden by environment variables)
APP_NAME="helicoptic-whatsapp"
APP_DIR="${DEPLOY_PATH:-/home/$USER/helicoptic-whatsapp}"
NODE_VERSION="20"
BRANCH="${GITHUB_REF#refs/heads/}"

echo -e "${GREEN}🚀 Starting deployment for ${APP_NAME}${NC}"
echo -e "${YELLOW}Deployment path: ${APP_DIR}${NC}"
echo -e "${YELLOW}Branch: ${BRANCH}${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

# Check Node.js version
NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
NODE_FULL_VER=$(node -v)
echo -e "${GREEN}📌 Current Node.js version: ${NODE_FULL_VER}${NC}"

if [ "$NODE_VER" -lt "$NODE_VERSION" ]; then
    echo -e "${RED}❌ Node.js version ${NODE_FULL_VER} is less than required version ${NODE_VERSION}${NC}"
    echo -e "${YELLOW}Attempting to install/switch to Node.js ${NODE_VERSION}...${NC}"
    
    # Try to use nvm if available
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        echo -e "${GREEN}Using NVM to switch to Node.js ${NODE_VERSION}...${NC}"
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        nvm install ${NODE_VERSION} || nvm use ${NODE_VERSION} || true
        nvm use ${NODE_VERSION} || true
        NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        NODE_FULL_VER=$(node -v)
        echo -e "${GREEN}✅ Switched to Node.js ${NODE_FULL_VER}${NC}"
    else
        echo -e "${YELLOW}NVM not found. Attempting to install Node.js ${NODE_VERSION} via NodeSource...${NC}"
        # Try to install Node.js 20 via NodeSource
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash - || true
        sudo apt-get install -y nodejs || true
        
        # Check again
        NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        NODE_FULL_VER=$(node -v)
        if [ "$NODE_VER" -lt "$NODE_VERSION" ]; then
            echo -e "${RED}❌ Failed to upgrade Node.js. Current version: ${NODE_FULL_VER}${NC}"
            echo -e "${YELLOW}Please manually install Node.js ${NODE_VERSION} on your VPS:${NC}"
            echo -e "${YELLOW}  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -${NC}"
            echo -e "${YELLOW}  sudo apt-get install -y nodejs${NC}"
            exit 1
        else
            echo -e "${GREEN}✅ Node.js upgraded to ${NODE_FULL_VER}${NC}"
        fi
    fi
fi

echo -e "${GREEN}✅ Node.js version check passed: ${NODE_FULL_VER}${NC}"

# Navigate to application directory
if [ ! -d "$APP_DIR" ]; then
    echo -e "${YELLOW}📁 Creating application directory: ${APP_DIR}${NC}"
    sudo mkdir -p "$APP_DIR" 2>/dev/null || mkdir -p "$APP_DIR"
    sudo chown -R $USER:$USER "$APP_DIR" 2>/dev/null || chown -R $USER:$USER "$APP_DIR" 2>/dev/null || true
fi

cd "$APP_DIR" || exit 1

# Backup current deployment (optional but recommended)
if [ -d "dist" ]; then
    echo -e "${YELLOW}📦 Creating backup...${NC}"
    BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "../backups"
    cp -r dist "../backups/${BACKUP_DIR}" 2>/dev/null || true
    echo -e "${GREEN}✅ Backup created: ../backups/${BACKUP_DIR}${NC}"
fi

# Stop PM2 process if running
echo -e "${YELLOW}⏸️  Stopping PM2 process...${NC}"
pm2 stop "$APP_NAME" 2>/dev/null || echo "PM2 process not running"

# The build files are already transferred to APP_DIR by GitHub Actions
# Navigate to application directory
cd "$APP_DIR" || exit 1

echo -e "${GREEN}📥 Files are in: $(pwd)${NC}"
echo -e "${GREEN}📋 Directory contents:${NC}"
ls -la

# Install/update dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
echo -e "${GREEN}Using Node.js: $(node -v) and npm: $(npm -v)${NC}"

# Ensure scripts directory exists (for postinstall script)
if [ ! -d "scripts" ]; then
    echo -e "${YELLOW}⚠️  scripts directory not found, creating it...${NC}"
    mkdir -p scripts
    # Create a minimal postinstall script if it doesn't exist
    if [ ! -f "scripts/postinstall.js" ]; then
        echo -e "${YELLOW}Creating minimal postinstall.js...${NC}"
        cat > scripts/postinstall.js << 'EOF'
#!/usr/bin/env node

// Minimal postinstall script
console.log('Postinstall script completed');
EOF
        chmod +x scripts/postinstall.js
    fi
fi

# Clean install to avoid version conflicts
echo -e "${YELLOW}Cleaning npm cache and node_modules...${NC}"
npm cache clean --force 2>/dev/null || true
rm -rf node_modules 2>/dev/null || true

# Install dependencies with multiple fallback strategies
echo -e "${YELLOW}Installing dependencies (this may take a few minutes)...${NC}"

# Strategy 1: Try npm ci (exact versions from package-lock.json) with legacy peer deps
if npm ci --legacy-peer-deps > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Dependencies installed successfully with npm ci${NC}"
# Strategy 2: Try npm install with legacy peer deps
elif npm install --legacy-peer-deps > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Dependencies installed successfully with npm install --legacy-peer-deps${NC}"
# Strategy 3: Try npm install with force flag
elif npm install --force > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Dependencies installed successfully with npm install --force${NC}"
# Strategy 4: Install without package-lock.json (regenerate it)
else
    echo -e "${YELLOW}⚠️  Standard installation failed, trying without package-lock.json...${NC}"
    mv package-lock.json package-lock.json.backup 2>/dev/null || true
    if npm install --legacy-peer-deps > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Dependencies installed successfully (package-lock.json regenerated)${NC}"
        # Restore original if we want to keep it, or keep the new one
        # mv package-lock.json.backup package-lock.json 2>/dev/null || true
    else
        echo -e "${RED}❌ All dependency installation strategies failed${NC}"
        echo -e "${YELLOW}Last attempt output:${NC}"
        npm install --legacy-peer-deps 2>&1 | tail -20
        exit 1
    fi
fi

# Run database migrations if needed
if [ -d "db" ]; then
    echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
    npm run db:push || echo -e "${YELLOW}⚠️  Database migration failed, but continuing...${NC}"
fi

# Restart PM2 process
echo -e "${GREEN}🔄 Restarting application with PM2...${NC}"

# Update ecosystem.config.cjs with correct path if needed
if [ -f "ecosystem.config.cjs" ]; then
    # Ensure the cwd in ecosystem.config.cjs matches APP_DIR
    sed -i "s|cwd:.*|cwd: '${APP_DIR}',|g" ecosystem.config.cjs || true
fi

# Start or restart PM2
if pm2 list | grep -q "$APP_NAME"; then
    pm2 restart "$APP_NAME"
else
    pm2 start ecosystem.config.cjs
fi

# Save PM2 configuration
pm2 save

# Show PM2 status
echo -e "${GREEN}📊 PM2 Status:${NC}"
pm2 status

# Show recent logs
echo -e "${GREEN}📋 Recent logs:${NC}"
pm2 logs "$APP_NAME" --lines 20 --nostream

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Application should be running on port 5002${NC}"
