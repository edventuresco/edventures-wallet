import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': '{}',
    'process.env.NODE_ENV': '"production"',
    global: 'globalThis',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/bridge.ts'),
        injected: resolve(__dirname, 'src/injected/provider.ts'),
        popup: resolve(__dirname, 'src/popup/popup.html'),
      },
      output: {
        // Use IIFE for all to avoid module loading issues
        // Background will be converted to support both
        format: 'iife',
        inlineDynamicImports: false,
        entryFileNames: (chunkInfo) => {
          const name = chunkInfo.name;
          if (name === 'background') return 'background.js';
          if (name === 'content') return 'content-bridge.js';
          if (name === 'injected') return 'injected-provider.js';
          return '[name].[hash].js';
        },
        chunkFileNames: '[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          if (name === 'popup.html') return 'popup.html';
          if (name.endsWith('.css')) return '[name].[hash].css';
          return '[name].[ext]';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
