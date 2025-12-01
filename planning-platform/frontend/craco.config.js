const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // 메모리 최적화 설정
      if (env === 'development') {
        // 개발 환경에서 메모리 사용량 최적화
        webpackConfig.devtool = 'eval-cheap-source-map';
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          removeAvailableModules: false,
          removeEmptyChunks: false,
          splitChunks: false,
        };
        
        // 파일 감시 설정 최적화
        webpackConfig.watchOptions = {
          aggregateTimeout: 300,
          poll: false,
          ignored: /node_modules/,
        };
        
        // devServer 포트 명시적 설정 (webpack configure에서 직접 설정)
        if (!webpackConfig.devServer) {
          webpackConfig.devServer = {};
        }
        webpackConfig.devServer.port = 9282;
        webpackConfig.devServer.host = '0.0.0.0';
      }

      // SCSS 빌드 최적화
      const oneOfRule = webpackConfig.module.rules.find(rule => rule.oneOf);
      if (oneOfRule) {
        const sassRule = oneOfRule.oneOf.find(rule => 
          rule.test && rule.test.toString().includes('scss')
        );
        
        if (sassRule) {
          sassRule.use = sassRule.use.map(loader => {
            if (typeof loader === 'object' && loader.loader && loader.loader.includes('sass-loader')) {
              return {
                ...loader,
                options: {
                  ...loader.options,
                  sassOptions: {
                    ...loader.options?.sassOptions,
                    outputStyle: env === 'development' ? 'expanded' : 'compressed',
                    includePaths: [path.resolve(__dirname, 'src/styles')],
                  },
                },
              };
            }
            return loader;
          });
        }
      }

      return webpackConfig;
    },
  },
  devServer: {
    port: 9282, // 명시적으로 포트 설정 (환경 변수보다 우선)
    host: '0.0.0.0', // 모든 네트워크 인터페이스에서 접속 허용
    allowedHosts: 'all', // 모든 호스트에서 접속 허용
    watchFiles: ['src/**/*'],
    compress: true,
    hot: true, // HMR 활성화 (자동 리로드)
    liveReload: true, // Live Reload 활성화 (자동 리로드)
    client: {
      webSocketTransport: 'sockjs', // SockJS 사용 (WebSocket 대신)
      webSocketURL: {
        hostname: 'localhost',
        pathname: '/sockjs-node',
        port: 9282, // WebSocket도 9282 포트 사용
        protocol: 'ws',
      },
      overlay: false, // 오류 오버레이 비활성화
      progress: false, // 진행률 표시 비활성화
      reconnect: false, // 재연결 비활성화
    },
    webSocketServer: 'sockjs', // SockJS 서버 사용
    setupMiddlewares: (middlewares, devServer) => {
      console.log('🔧 craco setupMiddlewares 실행됨');
      
      // 포트 강제 설정 (setupMiddlewares에서 직접 설정)
      if (devServer && devServer.options) {
        devServer.options.port = 9282;
        devServer.options.host = '0.0.0.0';
        console.log('✅ [CRACO] 포트 강제 설정: 9282');
      }
      
      // WELLO API 프록시 직접 설정
      const { createProxyMiddleware } = require('http-proxy-middleware');
      
      devServer.app.use('/wello-api', createProxyMiddleware({
        target: 'http://localhost:8082',
        changeOrigin: true,
        pathRewrite: {
          '^/wello-api': '/api'
        },
        logLevel: 'info',
        onProxyReq: (proxyReq, req, res) => {
          console.log(`🚀 [CRACO PROXY] ${req.method} ${req.url} → ${proxyReq.path}`);
        },
        onProxyRes: (proxyRes, req, res) => {
          console.log(`📥 [CRACO PROXY] ${proxyRes.statusCode} ${req.url}`);
        },
        onError: (err, req, res) => {
          console.error(`❌ [CRACO PROXY ERROR] ${req.url}:`, err.message);
        }
      }));
      
      console.log('✅ WELLO 프록시 직접 설정 완료: /wello-api → http://localhost:8082/api');
      
      // 파트너 마케팅 API 프록시 (localhost:8000)
      devServer.app.use('/api/partner-marketing', createProxyMiddleware({
        target: 'http://localhost:8000',
        changeOrigin: true,
        logLevel: 'info',
        onProxyReq: (proxyReq, req, res) => {
          console.log(`🚀 [CRACO PARTNER PROXY] ${req.method} ${req.url} → ${proxyReq.path}`);
        },
        onProxyRes: (proxyRes, req, res) => {
          console.log(`📥 [CRACO PARTNER PROXY] ${proxyRes.statusCode} ${req.url}`);
        },
        onError: (err, req, res) => {
          console.error(`❌ [CRACO PARTNER PROXY ERROR] ${req.url}:`, err.message);
        }
      }));
      
      console.log('✅ 파트너 마케팅 프록시 직접 설정 완료: /api/partner-marketing → http://localhost:8000/api/partner-marketing');
      
      return middlewares;
    },
  },
  babel: {
    loaderOptions: {
      cacheDirectory: true,
      cacheCompression: false,
    },
  },
};
