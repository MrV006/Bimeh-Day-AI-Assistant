import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base URL set to the repository name for GitHub Pages
  base: '/Bimeh-Day-AI-Assistant/',
  build: {
    outDir: 'dist',
    target: 'esnext'
  }
});