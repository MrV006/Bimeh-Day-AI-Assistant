
import { defineConfig, loadEnv } from 'vite';
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
      
      if (!fs.existsSync(distPath)) {
        fs.mkdirSync(distPath, { recursive: true });
      }
      
      fs.writeFileSync(versionPath, JSON.stringify(version));
      console.log(`\n✅ Version file generated: ${version.timestamp}\n`);
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react(), generateVersionFile()],
    // IMPORTANT: This must match your GitHub Repository name exactly
    // If your repo is https://github.com/User/My-App, this should be '/My-App/'
    base: '/Bimeh-Day-AI-Assistant/', 
    build: {
      outDir: 'dist',
      target: 'es2020'
    }
  };
});