import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import wasm from 'vite-plugin-wasm'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const use_local = env.VITE_USE_LOCAL_API === 'true'
  const proxy = {
    '/api': {
      target: 'https://api.aresrpg.world',
      changeOrigin: true,
      secure: false, // Adjust based on your SSL setup
      rewrite: path => path.replace(/^\/api/, ''),
      headers: {
        Cookie: `aresrpg_=${env.VITE_DEV_AUTH_TOKEN}`,
      },
    },
    '/ws': {
      target: 'wss://ws.aresrpg.world',
      ws: true,
      changeOrigin: true,
      secure: false, // Adjust based on your SSL setup
      rewrite: path => path.replace(/^\/ws/, ''),
      headers: {
        Cookie: `aresrpg_=${env.VITE_DEV_AUTH_TOKEN}`,
      },
    },
  }

  return {
    optimizeDeps: { exclude: ['recast-navigation'] },
    resolve: {
      alias: {
        events: 'events-polyfill',
      },
    },
    server: {
      port: 5174,
      proxy: use_local ? undefined : proxy,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    build: {
      target: 'esnext',
      minify: true,
    },
    plugins: [
      wasm(),
      vue(),
      nodePolyfills({
        // To add only specific polyfills, add them here. If no option is passed, adds all polyfills
        include: ['stream', 'events', 'path', 'timers/promises', 'util'],
        overrides: {
          events: 'events-polyfill',
        },
        // Whether to polyfill `node:` protocol imports.
        protocolImports: true,
      }),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        manifest: {
          name: 'AresRPG.world',
          short_name: 'AresRPG',
          description:
            'Start your adventure right now and join thousands of players in an immersive fantastic world ! Fight for your life and become the strongest warrior.',
          theme_color: '#212121',
          icons: [
            {
              src: 'android-chrome-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'android-chrome-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),
    ],
  }
})
