const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  console.log('🔧 WELLO 프록시 설정 시작');
  
  app.use('/wello-api', createProxyMiddleware({
    target: 'http://localhost:8082/api',
    changeOrigin: true,
    pathRewrite: {
      '^/wello-api': ''
    },
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
      console.log(`🚀 프록시: ${req.url} → ${proxyReq.path}`);
    },
    onError: (err, req, res) => {
      console.error('❌ 프록시 에러:', err.message);
    }
  }));
  
  console.log('✅ WELLO 프록시 설정 완료');
};
