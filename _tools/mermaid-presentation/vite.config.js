import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { assetsDir: 'mermaid-assets', rollupOptions: { input: 'index.html' } } });
