var webpack = require('webpack');
var path = require('path');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var mergeWebpackConfig = require('webpack-config-merger');

// Default configurations
var config =  {
  entry: [
    './app.jsx', // App entry point
    './index.html',
    './styles/App.scss'
  ],
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  resolve: {
    extensions: ['', '.js', '.jsx']
  },
  module: {
    loaders: [{
      test: /\.jsx?$/,
      exclude: /(node_modules|bower_components)/,
      loaders: ['babel']
    },
    {
      test: /\.html$/,
      loader: "file?name=[name].[ext]"
    },
    {
      test: /\.scss$/,
      loader: ExtractTextPlugin.extract(
        'css?sourceMap!' +
        'sass?sourceMap'
      )
    }]
  },
  plugins: [
    new webpack.NoErrorsPlugin(),
    new ExtractTextPlugin('app.css')
  ]
};

// Development specific configurations
var devConfig = {
  entry: [
    'webpack-dev-server/client?http://0.0.0.0:8080', // WebpackDevServer host and port
    'webpack/hot/only-dev-server'
  ],
  devtool: process.env.WEBPACK_DEVTOOL || 'source-map',
  module: {
    loaders: [{
      test: /\.jsx?$/,
      exclude: /(node_modules|bower_components)/,
      loaders: ['react-hot', 'babel']
    }]
  },
  devServer: {
    contentBase: "./dist",
    noInfo: true, //  --no-info option
    hot: true,
    inline: true
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
  ]
};

var isDev = process.env.NODE_ENV !== 'production';
if(isDev) {
  mergeWebpackConfig(config, devConfig);
}

module.exports = config;