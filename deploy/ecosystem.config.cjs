/**
 * PM2 Ecosystem Configuration for Production VM
 *
 * Services managed:
 * 1. next-app       — Next.js dashboard (port 3000)
 * 2. wa-service     — WhatsApp notification service (port 3001)
 *
 * Note: PDF Template Service runs via Docker (see deploy/docker-compose.prod.yml)
 *       Supabase runs separately via its own docker-compose
 *
 * Usage:
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 restart all
 *   pm2 logs
 *   pm2 save
 */

const path = require('path')
const ROOT = path.resolve(__dirname, '..')

module.exports = {
  apps: [
    {
      name: 'next-app',
      script: 'npm',
      args: 'start',
      cwd: ROOT,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // Restart policy
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '1G',
      // Cluster mode for multi-core (optional, set to 1 for single instance)
      instances: 1,
      exec_mode: 'fork',
      // Logging
      error_file: path.join(ROOT, 'logs/next-app-error.log'),
      out_file: path.join(ROOT, 'logs/next-app-out.log'),
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Don't watch in production
      watch: false,
    },
    {
      name: 'wa-service',
      script: 'node_modules/.bin/tsx',
      args: 'src/index.ts',
      cwd: path.join(ROOT, 'wa-service'),
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '512M',
      // Logging
      error_file: path.join(ROOT, 'wa-service/logs/wa-service-error.log'),
      out_file: path.join(ROOT, 'wa-service/logs/wa-service-out.log'),
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      watch: false,
    },
  ],
}
