module.exports = {
  apps: [
    {
      name: 'WELNO_BE',
      script: './start_welno.sh',
      cwd: './planning-platform/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        ENVIRONMENT: 'production',
        PYTHONPATH: '/home/welno/workspace/PROJECT_WELNO_BEFE/planning-platform/backend'
      },
      error_file: './logs/WELNO_BE-error.log',
      out_file: './logs/WELNO_BE-out.log',
      log_file: './logs/WELNO_BE-combined.log',
      time: true
    }
  ]
};
