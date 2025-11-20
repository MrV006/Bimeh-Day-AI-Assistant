import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const generateVersionFile = () => {
  return {
    name: 'generate-version-file',
    writeBundle() {
      const version = { timestamp: Date.now() };
      const distPath = path.resolve(__dirname, 'dist');
      const versionPath = path.join(distPath, 'version.json');
      
      // Ensure dist directory exists (it should after build)
      if (!fs.existsSync(distPath)) {
        fs.mkdirSync(distPath, { recursive: true });
      }
      
      fs.writeFileSync(versionPath, JSON.stringify(version));
      console.log(`\n✅ Version file generated: ${version.timestamp}\n`);
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), generateVersionFile()],
  // Base URL set to the repository name for GitHub Pages
  base: '/Bimeh-Day-AI-Assistant/',
  build: {
    outDir: 'dist',
    target: 'es2020'
  }
});