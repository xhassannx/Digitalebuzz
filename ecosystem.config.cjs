const path = require('path');
const fs = require('fs');

// Load .env file manually and parse it
function loadEnvFile(envPath) {
  const env = {};
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
            env[key.trim()] = value.trim();
          }
        }
      });
    }
  } catch (error) {
    console.error('Error loading .env file:', error.message);
  }
  return env;
}

// Load environment variables from .env file
const envPath = path.resolve(__dirname, '.env');
const envVars = loadEnvFile(envPath);

// Also try dotenv as fallback
try {
  require('dotenv').config({ path: envPath });
} catch (error) {
  console.warn('dotenv not available, using manual parsing');
}

// Prefer .env file over ambient process.env so PM2 restarts don't keep a stale DATABASE_URL.
const allEnvVars = { ...process.env, ...envVars };

module.exports = {
  apps: [
    {
      name: 'helicoptic-whatsapp',
      script: './dist/index.js',
      cwd: path.resolve(__dirname), // Ensure PM2 runs from project root
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: allEnvVars.PORT || 5002,
        MONGODB_URI: allEnvVars.MONGODB_URI || 'mongodb://127.0.0.1:27017/digitalebuzz',
        DATABASE_URL: allEnvVars.DATABASE_URL,
        SESSION_SECRET: allEnvVars.SESSION_SECRET,
        FACEBOOK_APP_ID: allEnvVars.FACEBOOK_APP_ID,
        FACEBOOK_APP_SECRET: allEnvVars.FACEBOOK_APP_SECRET,
        BASE_URL: allEnvVars.BASE_URL,
        WEBHOOK_URL: allEnvVars.WEBHOOK_URL,
        WEBHOOK_VERIFY_TOKEN: allEnvVars.WEBHOOK_VERIFY_TOKEN,
        EMBEDDED_SIGNUP_CONFIG_ID: allEnvVars.EMBEDDED_SIGNUP_CONFIG_ID,
        // Add other required env vars here
      },
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto restart
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // Restart policy
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      // Remote RDS (cross-region) can exceed 10s before first listen; keep this generous.
      listen_timeout: 60000,
      
      // Environment variables
      // Note: All env vars are loaded from .env file above
      // The app also uses dotenv/config in server/index.ts as a fallback
      env_file: '.env', // PM2 will also try to load from .env file
    },
  ],
};

