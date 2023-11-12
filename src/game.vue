<template lang="pug">
.aresrpg(v-if="webgl_available")
  Interface
  .canvas(ref='renderer_container')
.no_webgl(v-else) It seems WebGL is not available in your browser, please use a descent one 😀
</template>

<script setup>
import { onMounted, onUnmounted, ref, provide } from 'vue'
import WebGL from 'three/addons/capabilities/WebGL.js'

import Interface from './interface/ui.vue'
import create_game from './game.js'

const name = 'app'

const renderer_container = ref(null)
const webgl_available = ref(true)
const game = await create_game()

provide('game', game)

onMounted(async () => {
  const { start } = game
  if (WebGL.isWebGLAvailable()) start(renderer_container.value)
  else webgl_available.value = false
})

onUnmounted(async () => {
  const { stop } = game
  stop()
})
</script>

<style lang="stylus">
.aresrpg
  width 100vw
  height 100vh

.no_webgl
  display flex
  justify-content center
  align-items center
  height 100vh
  color #e1c79b
</style>
