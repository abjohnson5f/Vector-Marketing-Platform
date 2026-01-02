// PM2 Ecosystem Configuration
// Start with: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'vector-marketing-api',
      script: 'node_modules/.bin/tsx',
      args: 'src/index.ts',
      cwd: '/var/www/vector-marketing/backend',
      instances: 2, // Use 2 instances for redundancy
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_file: '/var/www/vector-marketing/backend/.env',
      error_file: '/var/log/vector-marketing/error.log',
      out_file: '/var/log/vector-marketing/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};

