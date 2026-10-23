import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { assetsDir: 'mermaid-assets', rollupOptions: { input: { index: 'index.html', 'index_v2.0': 'index_v2.0.html' } } } });
