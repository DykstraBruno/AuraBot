import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const isElectronBuild = process.env.BUILD_TARGET === 'electron';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },

  // Para Electron: caminhos relativos (file://)
  // Para Web: caminhos absolutos (http://)
  base: isElectronBuild ? './' : '/',

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
