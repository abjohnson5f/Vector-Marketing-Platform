// PM2 Ecosystem Configuration
// Start with: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'vector-marketing-api',
      script: 'src/index.ts',
      interpreter: 'node_modules/.bin/tsx',
      cwd: '/var/www/vector-marketing/backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/var/log/vector-marketing/error.log',
      out_file: '/var/log/vector-marketing/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
