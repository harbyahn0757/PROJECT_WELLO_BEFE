module.exports = {
  apps: [
    {
      name: 'WELNO_BE',
      script: 'python',
      args: ['-u', '-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8082'],
      cwd: '/home/workspace/PROJECT_WELNO_BEFE/planning-platform/backend',
      instances: 1,
      exec_mode: 'fork',
      watch: false, // uvicorn --reload가 이미 파일 변경 감지
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PYTHONPATH: '/home/workspace/PROJECT_WELNO_BEFE/planning-platform/backend'
      },
      log_file: '/var/log/pm2/welno-be-combined.log',
      out_file: '/var/log/pm2/welno-be-out.log',
      error_file: '/var/log/pm2/welno-be-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 재시작 정책
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      // 헬스체크
      health_check_grace_period: 3000,
      // 환경 변수
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};