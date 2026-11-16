import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'winston',
        'winston-daily-rotate-file',
        'yaml',
        'ffmpeg-static',
      ],
    },
  },
});
