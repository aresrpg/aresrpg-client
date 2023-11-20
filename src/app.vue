<template lang="pug">
Suspense(v-if="show_game")
  Game
.blank(v-else)
  h1 Nothing to see here 👀
</template>

<script setup>
import { ref, onMounted, provide } from 'vue'
import { inject as inject_vercel_analytics } from '@vercel/analytics'
import konamiCode from '@sidp/konami-code'

import konami_1 from './assets/konami_1.wav'
import konami_2 from './assets/konami_2.wav'
import konami_3 from './assets/konami_3.wav'
import konami_ok from './assets/konami_ok.wav'
import Game from './game.vue'
import { VITE_KONAMI } from './env.js'

const name = 'app'
const show_game = ref(!VITE_KONAMI)
const konami_sounds = [konami_1, konami_2, konami_3]
const allowed_keys = [37, 38, 39, 40, 66, 65]
const loading = ref(false)

provide('loading', loading)

const play_konami_sound = event => {
  if (!allowed_keys.includes(event?.keyCode)) return
  const random_index = Math.floor(Math.random() * konami_sounds.length)
  const random_sound = konami_sounds[random_index]
  new Audio(random_sound).play()
}

const play_konami_ok = () => {
  new Audio(konami_ok).play()
}

if (VITE_KONAMI) {
  konamiCode(function () {
    show_game.value = true
    play_konami_ok()
    window.removeEventListener('keydown', play_konami_sound)
    this.remove()
  })
}

onMounted(() => {
  if (VITE_KONAMI) window.addEventListener('keydown', play_konami_sound)
  inject_vercel_analytics()
})
</script>

<style lang="stylus">
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
  font-family 'PT Serif', sans-serif
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

.blank
  width 100vw
  height 100vh
  color #EEEEEE
  text-shadow 1px 2px 3px black
  display flex
  justify-content center
  align-items center
</style>
