module.exports = {
  apps: [{
    name: 'crypto-payment-gateway',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/app.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 3000,
    // Health monitoring
    monitoring: {
      http: true,
      https: false
    }
  }]
};