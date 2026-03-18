import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // --- (FIX) ADD THIS SECTION ---
  // This tells Vite to recognize these file types as static assets
  // and provide their correct URLs when you import them.
  assetsInclude: ['**/*.ttf', '**/*.pdf'],

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  }
});
