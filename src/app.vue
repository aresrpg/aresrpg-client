<template lang="pug">
.aresrpg(v-if="webgl_available")
  .canvas(ref='renderer_container')
.no_webgl(v-else) It seems WebGL is not available in your browser, please use a descent one 😀
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import WebGL from 'three/addons/capabilities/WebGL.js'

import create_game from './game.js'

const name = 'app'

const renderer_container = ref(null)
const webgl_available = ref(true)
const game = create_game()

onMounted(async () => {
  const { start } = await game
  if (WebGL.isWebGLAvailable()) start(renderer_container.value)
  else webgl_available.value = false
})

onUnmounted(async () => {
  const { stop } = await game
  stop()
})
</script>

<style lang="stylus">
@font-face
  font-family "nimbus-sans"
  src url("assets/nimbus-sans.bold.otf") format("otf");

sc-reset()
    margin 0
    padding 0
    box-sizing border-box

sc-disableScollBar()
    ::-webkit-scrollbar
        display: none;

:root
  font-size 18px
  background #212121

*
  sc-reset()
  sc-disableScollBar()
  font-family 'Raleway', sans-serif
  outline none
  scroll-behavior smooth
  &::-webkit-scrollbar-track
    box-shadow inset 0 0 6px rgba(0, 0, 0, .3)
    background-color #555
  &::-webkit-scrollbar
    width 12px
    background-color #F5F5F5
  &::-webkit-scrollbar-thumb
    box-shadow inset 0 0 6px rgba(0, 0, 0, .3)
    background-color #252525
  a
    :active
      color #e1c79b
      fill #e1c79b

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
