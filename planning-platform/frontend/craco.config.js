const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      if (env === 'development') {
        webpackConfig.devtool = 'eval-cheap-source-map';
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          removeAvailableModules: false,
          removeEmptyChunks: false,
          splitChunks: false,
        };
        
        webpackConfig.watchOptions = {
          aggregateTimeout: 300,
          poll: false,
          ignored: /node_modules/,
        };
        
        if (!webpackConfig.devServer) {
          webpackConfig.devServer = {};
        }
        webpackConfig.devServer.port = 9282;
        webpackConfig.devServer.host = '0.0.0.0';
      }

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
    port: 9282,
    host: '0.0.0.0',
    allowedHosts: 'all',
    watchFiles: ['src/**/*'],
    compress: true,
    hot: false,
    liveReload: false,
    client: {
      overlay: false,
      progress: false,
      logging: 'none',
      webSocketURL: undefined,
    },
    webSocketServer: false,
    // 표준 프록시 설정 (webpack-dev-server 기본 기능)
    proxy: {
      '/welno-api': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        pathRewrite: { '^/welno-api': '/api' },
        logLevel: 'debug',
        ws: true
      },
      '/api/partner-marketing': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        logLevel: 'debug'
      }
    },
    setupMiddlewares: (middlewares, devServer) => {
      console.log('🔧 [CRACO] setupMiddlewares: 정적 파일 서빙 등록 중...');
      
      const fs = require('fs');
      
      // 정적 파일 서빙 미들웨어 (/welno/ 하위의 이미지 등)
      devServer.app.use('/welno', (req, res, next) => {
        if (req.path.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/i)) {
          const fileName = req.path.replace(/^\/welno\//, '');
          const filePath = path.join(__dirname, 'public', 'welno', fileName);
          
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            const contentType = {
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.svg': 'image/svg+xml',
              '.ico': 'image/x-icon',
              '.webp': 'image/webp'
            }[ext] || 'application/octet-stream';
            
            res.setHeader('Content-Type', contentType);
            return res.sendFile(path.resolve(filePath));
          }
        }
        next();
      });
      
      console.log('✅ [CRACO] 설정 완료');
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
