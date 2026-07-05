import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'AirCanvas',
        short_name: 'AirCanvas',
        description:
          'Draw in the air with your finger — webcam hand tracking, no stylus needed.',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The self-hosted wasm runtime ships in three variants (~11 MB each)
        // but the browser only ever loads one — runtime-cache the one that is
        // actually requested instead of precaching all of them.
        globIgnores: ['wasm/**'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/[^/]+\/wasm\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mediapipe-wasm',
              expiration: { maxEntries: 8 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/storage\.googleapis\.com\/mediapipe-models\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mediapipe-models',
              expiration: { maxEntries: 4 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
