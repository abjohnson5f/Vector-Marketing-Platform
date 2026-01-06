/**
 * PM2 Ecosystem Configuration
 * 
 * Start all services:    pm2 start ecosystem.config.cjs
 * Start API only:        pm2 start ecosystem.config.cjs --only vector-marketing-api
 * Start Worker only:     pm2 start ecosystem.config.cjs --only vector-marketing-worker
 * Restart all:           pm2 restart ecosystem.config.cjs
 * Stop all:              pm2 stop ecosystem.config.cjs
 * View logs:             pm2 logs
 * Monitor:               pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'vector-marketing-api',
      script: 'dist/index.js',
      cwd: '/var/www/vector-marketing/backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/var/log/pm2/vector-marketing-api-error.log',
      out_file: '/var/log/pm2/vector-marketing-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    {
      name: 'vector-marketing-worker',
      script: 'dist/worker.js',
      cwd: '/var/www/vector-marketing/backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/pm2/vector-marketing-worker-error.log',
      out_file: '/var/log/pm2/vector-marketing-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Worker-specific: restart on failure with exponential backoff
      exp_backoff_restart_delay: 1000,
    },
  ],
};
