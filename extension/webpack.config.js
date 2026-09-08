const path = require('path');
const { ProvidePlugin, DefinePlugin } = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
require('dotenv').config();

const isDevelopment = process.env.NODE_ENV === 'development';

module.exports = {
  mode: isDevelopment ? 'development' : 'production',
  devtool: isDevelopment ? 'cheap-module-source-map' : false,

  entry: {
    background: './src/background/index.ts',
    popup: './src/popup/popup.tsx',
    permissions: './src/popup/permissions.js',
    'content-script': './src/content/content-script.ts',
    'injected-provider': './src/content/injected-provider.ts',
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
    fullySpecified: false,
    alias: {
      'process/browser': require.resolve('process/browser.js'),
    },
    fallback: {
      buffer: require.resolve('buffer/'),
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      path: require.resolve('path-browserify'),
      zlib: require.resolve('browserify-zlib'),
      https: require.resolve('https-browserify'),
      http: require.resolve('stream-http'),
      fs: false,
      os: false,
    },
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpg|jpeg|svg|gif)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name][ext]'
        }
      },
    ],
  },

  plugins: [
    new ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
    new DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(isDevelopment ? 'development' : 'production'),
      'process.env.NOW_NODES_API': JSON.stringify(process.env.NOW_NODES_API || ''),
      // OpenAI configuration
      'process.env.VITE_OPENAI_API_KEY': JSON.stringify(process.env.VITE_OPENAI_API_KEY || ''),
      'process.env.VITE_OPENAI_MODEL': JSON.stringify(process.env.VITE_OPENAI_MODEL || ''),
      'process.env.VITE_OPENAI_MAX_TOKENS': JSON.stringify(process.env.VITE_OPENAI_MAX_TOKENS || ''),
      'process.env.VITE_OPENAI_TEMPERATURE': JSON.stringify(process.env.VITE_OPENAI_TEMPERATURE || ''),
      // Agent configuration
      'process.env.VITE_AGENT_MAX_CONTEXT_MESSAGES': JSON.stringify(process.env.VITE_AGENT_MAX_CONTEXT_MESSAGES || ''),
      'process.env.VITE_AGENT_SESSION_TIMEOUT_MS': JSON.stringify(process.env.VITE_AGENT_SESSION_TIMEOUT_MS || ''),
      'process.env.VITE_AGENT_RATE_LIMIT_PER_MINUTE': JSON.stringify(process.env.VITE_AGENT_RATE_LIMIT_PER_MINUTE || ''),
      'process.env.VITE_AGENT_MAX_TRANSACTION_SOL': JSON.stringify(process.env.VITE_AGENT_MAX_TRANSACTION_SOL || ''),
      // ElevenLabs configuration
      'process.env.VITE_ELEVENLABS_API_KEY': JSON.stringify(process.env.VITE_ELEVENLABS_API_KEY || ''),
      'process.env.VITE_ELEVENLABS_VOICE_ID': JSON.stringify(process.env.VITE_ELEVENLABS_VOICE_ID || ''),
      'process.env.VITE_ELEVENLABS_MODEL': JSON.stringify(process.env.VITE_ELEVENLABS_MODEL || ''),
      'process.env.VITE_DEBUG_MODE': JSON.stringify(process.env.VITE_DEBUG_MODE || ''),
      // Feature flags
      'process.env.VITE_ENABLE_AGENT': JSON.stringify(process.env.VITE_ENABLE_AGENT || ''),
      'process.env.VITE_ENABLE_VOICE': JSON.stringify(process.env.VITE_ENABLE_VOICE || ''),
      'process.env.VITE_SOLANA_RPC_URL': JSON.stringify(process.env.VITE_SOLANA_RPC_URL || ''),
    }),
    new HtmlWebpackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup.html',
      chunks: ['popup'],
    }),
    new HtmlWebpackPlugin({
      template: './src/popup/permissions.html',
      filename: 'permissions.html',
      chunks: ['permissions'],
    }),
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
      ],
    }),
  ],
};
