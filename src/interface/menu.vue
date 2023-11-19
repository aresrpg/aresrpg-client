<template lang="pug">
.menu
  nav
    img.logo(:src="logo")
    .version build {{ pkg.version }}
  .menu_play(v-if="!class_selection")
    img.logo(:src="text_logo")
    .play.btn(@click="on_create_class_click") Play as guest
  .menu_classes(v-if="class_selection")
    .slider
    .desc
    .perso
    .spells
    input.name(placeholder="Enter your name" v-model="name")
    .back.btn(@click="on_back_click") Cancel
    .play.btn(@click="on_play_click") Play
</template>

<script setup>
import { inject, onMounted, ref } from 'vue'

import logo from '../assets/logo.png'
import text_logo from '../assets/text_logo.png'
import pkg from '../../package.json'

const game = inject('game')
const name = ref('')

const class_selection = ref(false)

function on_create_class_click() {
  game.events.emit('SHOW_CLASS_SELECTION', true)
  class_selection.value = true
}

function on_back_click() {
  class_selection.value = false
  game.events.emit('SHOW_CLASS_SELECTION', false)
}

function on_play_click() {
  game.dispatch('action/load_game_state', 'GAME')
  game.events.emit('CONNECT_TO_SERVER', { name: name.value })
}
</script>

<style lang="stylus" scoped>

.btn
  background linear-gradient(to right, #16222A, #3A6073)
  padding 1em 2em
  border-radius 3px
  font-weight 900
  box-shadow 1px 2px 3px black
  cursor pointer
  color #ddd

.menu
  nav
    position absolute
    top 0
    left 0
    width 100vw
    height 80px
    display flex
    align-items center
    img.logo
      padding .5em
      filter drop-shadow(1px 2px 3px black)
      width 80px
    .version
      font-weight 900
      font-size .8em
      color #212121

  .menu_classes
    position absolute
    width 80%
    height 80%
    background #212121
    top 50%
    left 50%
    transform translate(-50%, -50%)
    backdrop-filter blur(50px)
    opacity .9
    display grid
    place-items center center
    grid "slider slider slider" 4fr "desc perso spells" 4fr "back name play" 1fr / 1fr 1fr 1fr
    >*
      border 2px solid #ddd
      color #eeeeee
    .slider
      grid-area slider
      place-self stretch
      margin 1em
    .desc
      grid-area desc
      place-self stretch
      margin 1em 3em
    .perso
      grid-area perso
      place-self stretch
      margin 1em
    .spells
      grid-area spells
      place-self stretch
      margin 1em 3em
    input.name
      grid-area name
      height 50px
      width 100%
      border-radius 6px
      margin 1em 2em
      padding 0 1em
      color #212121
      font-size 1.5em
      text-align center
    .back
      grid-area back
      border none
    .play
      grid-area play
      border none

  .menu_play
    position absolute
    top 42%
    left 50%
    transform translate(-50%, -50%)
    display flex
    flex-flow column nowrap
    justify-content center
    align-items center
    img.logo
      margin-bottom 2em
      width 600px
      filter drop-shadow(1px 2px 3px black)
</style>
