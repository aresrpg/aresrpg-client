import { createApp, provide } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import Toast, { useToast } from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import { BufferGeometry, Mesh } from 'three'
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from 'three-mesh-bvh'
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'

// @ts-ignore
import app from './app.vue'

BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
Mesh.prototype.raycast = acceleratedRaycast

const vue_app = createApp(app)
const toast = useToast()

library.add(faPlus)

vue_app.component('fa', FontAwesomeIcon).use(Toast).mount('#app')

const updateSW = registerSW({
  onOfflineReady() {
    toast('ready to work offline!')
  },
})

vue_app.config.compilerOptions.isCustomElement = tag => {
  if (tag.startsWith('el-')) return true
  if (tag.startsWith('upload-')) return true
  return false
}
