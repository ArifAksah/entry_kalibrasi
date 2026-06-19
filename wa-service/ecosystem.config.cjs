module.exports = {
  apps: [
    {
      name: 'wa-service',
      script: 'npm',
      args: 'start',
      cwd: __dirname,
      env: {
        PORT: 3002,
        NODE_ENV: 'production',
      },
      // Auto-restart on crash
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      // Watch for file changes (disable in production)
      watch: false,
      // Logging
      error_file: './logs/wa-service-error.log',
      out_file: './logs/wa-service-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
