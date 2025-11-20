import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Change 'bimeh-day-ai' to your GitHub repository name
  base: '/bimeh-day-ai/',
  build: {
    outDir: 'dist',
    target: 'esnext'
  }
});