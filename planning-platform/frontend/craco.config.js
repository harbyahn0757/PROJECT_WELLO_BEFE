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
    watchFiles: ['src/**/*'],
    compress: true,
    hot: false, // HMR 완전 비활성화
    liveReload: false, // Live Reload 비활성화
    client: {
      webSocketTransport: 'sockjs', // SockJS 사용 (WebSocket 대신)
      overlay: false, // 오류 오버레이 비활성화
      progress: false, // 진행률 표시 비활성화
      reconnect: false, // 재연결 비활성화
    },
    webSocketServer: 'sockjs', // SockJS 서버 사용
    setupMiddlewares: (middlewares, devServer) => {
      // WebSocket 관련 모든 경로 차단
      devServer.app.use('/ws', (req, res) => {
        res.status(404).end();
      });
      devServer.app.use('/sockjs-node', (req, res) => {
        res.status(404).end();
      });
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
