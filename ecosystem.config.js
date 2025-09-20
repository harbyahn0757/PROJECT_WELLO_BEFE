module.exports = {
  apps: [
    {
      name: 'WELLO_BE',
      script: './start_wello.sh',
      cwd: './planning-platform/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        ENVIRONMENT: 'production',
        PYTHONPATH: '/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend'
      },
      error_file: './logs/WELLO_BE-error.log',
      out_file: './logs/WELLO_BE-out.log',
      log_file: './logs/WELLO_BE-combined.log',
      time: true
    }
  ]
};
