import { createApp, provide } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import { BufferGeometry, Mesh } from 'three'
import Vuesax from 'vuesax-alpha'
import 'vuesax-alpha/dist/index.css'
import 'vuesax-alpha/theme-chalk/dark/css-vars.css'
import { inject } from '@vercel/analytics'
// @ts-ignore
import { CHUNK_SIZE, WORLD_HEIGHT } from '@aresrpg/aresrpg-protocol'

import app from './app.vue'
import toast from './toast'

inject()

console.log(
  `%c You're curious, I like you 🤭🍑`,
  'color: #1565C0;font-weight:bold;font-size:22px;',
)
console.log(
  "%c but don't bother, i'm open-source!",
  'color: #E67E22;font-size:18px;',
)
console.log('%c https://github.com/aresrpg/aresrpg-client', 'font-size:15px;')

console.log('Chunk size verification:', CHUNK_SIZE)
console.log('World height verification:', WORLD_HEIGHT)

const vue_app = createApp(app)

vue_app
  .use(Vuesax, {
    color: {
      primary: '#F1C40F',
      success: '#2ECC71',
      danger: '#E74C3C',
      warning: '#E67E22',
      dark: '#2C3E50',
    },
  })
  .mount('#app')

const updateSW = registerSW({
  onOfflineReady() {
    toast.info('AresRPG was cached for faster loading.', 'Service Worker')
  },
})
