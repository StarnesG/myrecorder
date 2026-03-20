import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'src',
  build: {
    // 相对于项目根目录，避免 root:'src' 时路径歧义
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
});
