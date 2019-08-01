const path = require('path')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

const config = {
  entry: path.resolve(__dirname, 'src', 'index.js'),
  devtool: 'source-map',
  output: {
    filename: 'yatte.js',
    path: path.resolve(__dirname, 'lib'),
    globalObject: 'this',
    library: 'yatte',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ],
  },
  resolve: {
    modules: [ path.resolve(__dirname, 'src'), 'node_modules' ],
    extensions: ['.mjs', '.js']
  }
}

module.exports = (env, argv) => {
  if (argv.mode === 'development') {
    //config.mode = 'development'
  } else {
    //config.mode = 'production'
    config.output.filename = 'yatte.min.js'
    if (!config.optimization) {
      config.optimization = {}
    }
    config.optimization.minimizer = [new UglifyJsPlugin()]
  }
  return config
}
