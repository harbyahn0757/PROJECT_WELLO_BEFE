const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  console.log('🔧 WELLO 프록시 설정 로드됨!');
  
  // 모든 /wello-api 요청을 localhost:8082/api로 프록시
  app.use('/wello-api', createProxyMiddleware({
    target: 'http://localhost:8082',
    changeOrigin: true,
    pathRewrite: {
      '^/wello-api': '/api'
    },
    logLevel: 'info',
    onProxyReq: (proxyReq, req, res) => {
      console.log(`🚀 [PROXY] ${req.method} ${req.url} → ${proxyReq.path}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`📥 [PROXY] ${proxyRes.statusCode} ${req.url}`);
    },
    onError: (err, req, res) => {
      console.error(`❌ [PROXY ERROR] ${req.url}:`, err.message);
    }
  }));
  
  // 파트너 마케팅 API 프록시 (localhost:8000)
  app.use('/api/partner-marketing', createProxyMiddleware({
    target: 'http://localhost:8000',
    changeOrigin: true,
    logLevel: 'info',
    onProxyReq: (proxyReq, req, res) => {
      console.log(`🚀 [PARTNER PROXY] ${req.method} ${req.url} → ${proxyReq.path}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`📥 [PARTNER PROXY] ${proxyRes.statusCode} ${req.url}`);
    },
    onError: (err, req, res) => {
      console.error(`❌ [PARTNER PROXY ERROR] ${req.url}:`, err.message);
    }
  }));
  
  console.log('✅ WELLO 프록시 설정 완료: /wello-api → http://localhost:8082/api');
  console.log('✅ 파트너 마케팅 프록시 설정 완료: /api/partner-marketing → http://localhost:8000/api/partner-marketing');
};