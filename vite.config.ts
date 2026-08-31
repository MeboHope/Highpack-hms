import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Keep the Vite config dependency-free from Node type declarations.
// Vite runs this config with Node, so process.cwd() is available at runtime.
declare const process: { cwd: () => string };

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': `${process.cwd()}/src`,
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
