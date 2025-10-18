/**
 * 프론트엔드 프록시 설정
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // WELLO API 프록시: /api/v1/wello/* → http://localhost:8082/api/v1/*
  app.use(
    '/api/v1/wello',
    createProxyMiddleware({
      target: process.env.REACT_APP_BACKEND_URL || 'http://localhost:8082',
      changeOrigin: true,
      secure: false,
      ws: false, // WebSocket 지원 비활성화 (HMR과 충돌 방지)
      timeout: 30000,
      logLevel: 'info', // 디버그 로그 레벨 낮춤
      pathRewrite: {
        '^/api/v1/wello': '/api/v1'  // /api/v1/wello/patients → /api/v1/patients
      },
      onError: (err, req, res) => {
        console.error('WELLO Backend proxy error:', err.message);
        res.status(500).json({
          success: false,
          message: 'WELLO 백엔드 서버 연결에 실패했습니다',
          error: err.message
        });
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log(`[WELLO Proxy] ${req.method} ${req.originalUrl} -> ${proxyReq.path}`);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log(`[WELLO Proxy] ${proxyRes.statusCode} ${req.originalUrl}`);
      }
    })
  );

  // WELLO WebSocket 전용 프록시 (필요한 경우에만)
  app.use(
    '/api/v1/wello/tilko/ws',
    createProxyMiddleware({
      target: process.env.REACT_APP_BACKEND_URL || 'http://localhost:8082',
      changeOrigin: true,
      secure: false,
      ws: true, // 특정 경로에서만 WebSocket 지원
      timeout: 30000,
      logLevel: 'info',
      pathRewrite: {
        '^/api/v1/wello': '/api/v1'
      },
      onProxyReqWs: (proxyReq, req, socket) => {
        console.log(`[WELLO Tilko WebSocket] ${req.url} -> ${proxyReq.path}`);
      },
      onError: (err, req, res) => {
        console.error('WELLO Tilko WebSocket proxy error:', err.message);
      }
    })
  );

  // Health Connect API 프록시 (백엔드를 통해)
  app.use(
    '/health-connect',
    createProxyMiddleware({
      target: process.env.REACT_APP_BACKEND_URL || 'http://localhost:8082',
      changeOrigin: true,
      secure: false,
      timeout: 60000, // Tilko API는 더 긴 타임아웃 필요
      logLevel: 'info',
      pathRewrite: {
        '^/health-connect': '/health-connect'
      },
      onError: (err, req, res) => {
        console.error('Health Connect proxy error:', err.message);
        res.status(500).json({
          success: false,
          message: '건강 데이터 연동 서비스에 연결할 수 없습니다',
          error: err.message
        });
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log(`[HealthConnect] ${req.method} ${req.originalUrl} -> ${proxyReq.path}`);
        
        // 요청 헤더 설정
        proxyReq.setHeader('X-Forwarded-For', req.ip);
        proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
        proxyReq.setHeader('X-Forwarded-Host', req.get('Host'));
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log(`[HealthConnect] ${proxyRes.statusCode} ${req.originalUrl}`);
        
        // CORS 헤더 설정
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
      }
    })
  );

  // 개발 모드에서 에러 처리 미들웨어
  if (process.env.NODE_ENV === 'development') {
    app.use((err, req, res, next) => {
      console.error('Development proxy error:', err);
      res.status(500).json({
        success: false,
        message: '개발 서버 에러가 발생했습니다',
        error: err.message,
        stack: err.stack
      });
    });
  }
};
