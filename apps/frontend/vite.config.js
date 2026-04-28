import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        home:         resolve(__dirname, 'index.html'),
        menu:         resolve(__dirname, 'menu/index.html'),
        projects:     resolve(__dirname, 'projects/index.html'),
        testimonials: resolve(__dirname, 'testimonials/index.html'),
        links:        resolve(__dirname, 'links/index.html'),
        about:        resolve(__dirname, 'about/index.html'),
        guestbook:    resolve(__dirname, 'guestbook/index.html'),
      },
    },
  },
});
