import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({

  plugins: [
    viteStaticCopy({
      base: '/mediashop/',
      targets: [
        {

          src: 'node_modules/@ffmpeg/core/dist/esm/*',
          dest: '.'
        }
      ]
    })
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
});