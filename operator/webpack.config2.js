const path = require('path');
const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

process.env.NODE_ENV = "development";

module.exports = {
  bail: true,
  target: 'web',
  entry: './src/user-deposit-example2/index.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'src/user-deposit-example2'),
  },
  module: {
    rules: [
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
    alias: {'util/types': 'util/support/types' }
  },
  plugins: [
    new NodePolyfillPlugin({
      excludeAliases: ['console']
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer']
    }),
  ],
};
