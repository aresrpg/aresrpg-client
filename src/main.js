import { createApp, provide } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import { BufferGeometry, Mesh } from 'three'
import Vuesax from 'vuesax-alpha'
import 'vuesax-alpha/dist/index.css'
import 'vuesax-alpha/theme-chalk/dark/css-vars.css'
import 'boxicons'
import { inject } from '@vercel/analytics'

// @ts-ignore
import app from './app.vue'
import toast from './toast'

inject()

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
