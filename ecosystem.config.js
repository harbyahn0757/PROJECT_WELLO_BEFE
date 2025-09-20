module.exports = {
  apps: [
    {
      name: 'planning-api',
      script: 'uvicorn',
      args: 'app.main:app --host 0.0.0.0 --port 8082 --workers 2',
      cwd: './planning-platform/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PYTHONPATH: '/path/to/your/planning/backend'
      },
      error_file: './logs/planning-api-error.log',
      out_file: './logs/planning-api-out.log',
      log_file: './logs/planning-api-combined.log',
      time: true
    }
  ]
};
