const path = require('path');
const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

process.env.NODE_ENV = "development";

module.exports = {
  bail: true,
  target: 'web',
  entry: './src/user-deposit-example/index.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'src/user-deposit-example'),
  },
  module: {
    rules: [
      // { test: /\.([cm]?ts|tsx)$/, loader: "ts-loader" },

      { test: /\.json$/, type: 'json' },
      {
        test: /\.(js|mjs|jsx|ts|tsx)$/,
        use: {
          loader: 'babel-loader',
          options: {
            targets: { chrome: "100" },
            sourceType: "unambiguous",
            presets: [
              'react-app'
            ],
            "plugins": ["@babel/plugin-transform-class-static-block"]
          }
        }
      },
    ]
  },
  mode: 'development',
  resolve: {
    extensions: [
      '.json',
      '.mjs',
      '.js',
      '.ts',
      '.tsx',
      '.jsx'
    ],
    fallback: {
      fs: false,
      path: false,
      net: false,
      tls: false,
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      assert: require.resolve('assert'),
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      os: require.resolve('os-browserify'),
      "url": require.resolve('url/'),
      util: require.resolve('util'),
      process: require.resolve("process/browser"),
      console: false,

    },
    cache: false,
    alias: { "stream": require.resolve("stream-browserify"), 'util/types': 'util/support/types' }
  },
  plugins: [
    new NodePolyfillPlugin({
      excludeAliases: ['console']
    }),
    new webpack.ProvidePlugin({
      // process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    }),
    new webpack.DefinePlugin({
      'process.env': {},
      'process.browser': JSON.stringify(true),
      'process.version': JSON.stringify('v3'),
      'process.platform': JSON.stringify(process.platform),
    })
  ],
};
