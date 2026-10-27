import { defineConfig } from 'vite';

export default defineConfig({
  // relative asset paths: the build works from any folder or sub-path
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
});
