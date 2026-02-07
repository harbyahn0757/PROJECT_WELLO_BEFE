const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/embed/WelnoRagChatWidget.js',
  output: {
    path: path.resolve(__dirname, 'dist/embed'),
    filename: 'welno-rag-chat-widget.min.js',
    library: 'WelnoRagChatWidget',
    libraryTarget: 'umd',
    libraryExport: 'default',
    globalObject: 'this'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  optimization: {
    minimize: true
  },
  resolve: {
    extensions: ['.js']
  }
};