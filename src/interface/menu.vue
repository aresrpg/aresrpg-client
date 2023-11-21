<template lang="pug">
.menu
  nav
    img.logo(:src="logo")
    .version build {{ pkg.version }}
  .menu_play(v-if="menu_type === 'PLAY'")
    img.logo(:src="text_logo")
    .play.ares_btn(@click="play_as_guest") Play as guest
  .menu_characters(v-if="menu_type === 'CHARACTERS'")
    .character(v-for="character in state.characters" @click="() => select_character(character)")
      .skin
      .grad
      .name {{ character.name }}
      .level Lvl {{ character.level }}
    .character_new(
        v-if="state.characters?.length < state.characters_limit"
        @click="show_characters_creation"
      )
      .skin
      .grad
      fa(:icon="['fas', 'plus']")
  .menu_create_character(v-if="menu_type === 'CREATE_CHARACTER'")
    .slider
    .desc
    .perso
    .spells
    input.name(placeholder="Enter your name" v-model="name")
    .back.ares_btn(@click="show_characters_menu") Cancel
    .play.ares_btn(@click="create_character") Create
</template>

<script setup>
import { inject, onUnmounted, onMounted, ref, watch, watchEffect } from 'vue'

import logo from '../assets/logo.png'
import text_logo from '../assets/text_logo.png'
import pkg from '../../package.json'

const game = inject('game')
const state = inject('state')
const loading = inject('loading')
const ws_status = inject('ws_status')
const name = ref('')

const menu_type = ref(ws_status.value === 'OPEN' ? 'CHARACTERS' : 'PLAY')

function play_as_guest() {
  game.value.events.emit('CONNECT_TO_SERVER')
  loading.value = true
}

function show_characters_menu() {
  game.value.events.emit('MOVE_MENU_CAMERA', [-8, 1.2, 4])
  menu_type.value = 'CHARACTERS'
}

function show_characters_creation() {
  game.value.events.emit('MOVE_MENU_CAMERA', [-8, 1.6, 4])
  menu_type.value = 'CREATE_CHARACTER'
}

function on_character_list({ characters }) {
  loading.value = false
  if (!characters.length) show_characters_creation()
  else show_characters_menu()
}

function on_connection_success() {
  game.value.send_packet('packet/listCharacters', {})
}

function create_character() {
  if (!name.value) {
    alert('Please enter a name')
    return
  }

  game.value.send_packet('packet/createCharacter', { name: name.value })
}

function select_character({ id }) {
  game.value.dispatch('action/load_game_state', 'GAME')
  game.value.send_packet('packet/selectCharacter', { id })
}

onMounted(() => {
  game.value.events.once('packet/connectionSuccess', on_connection_success)
  game.value.events.on('packet/listCharactersResponse', on_character_list)
})

onUnmounted(() => {
  game.value.events.off('packet/connectionSuccess', on_connection_success)
  game.value.events.off('packet/listCharactersResponse', on_character_list)
})
</script>

<style lang="stylus" scoped>

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

  .menu_characters
    position absolute
    background rgba(#212121, .5)
    top 50%
    left 50%
    transform translate(-50%, -50%)
    backdrop-filter blur(12px)
    padding 2em
    border-radius 6px
    overflow hidden
    display grid
    grid-column-gap 2em
    grid-auto-flow column
    >*
      cursor pointer
      border 1px solid white
      border-radius 6px
      box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
      transition: all 0.3s cubic-bezier(.25,.8,.25,1);
      overflow hidden
      position relative
      &:hover
        box-shadow: 0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22);
      .skin
        position absolute
        width 100%
        height 100%
        background url('https://www.pockettactics.com/wp-content/sites/pockettactics/2023/08/waven-early-access.jpg') center / cover
        filter grayscale(50%)
        z-index -1
      .grad
        position absolute
        width 100%
        height 100%
        background linear-gradient(to bottom, transparent 0%, black 100%)
        z-index -1
    .character
      display flex
      flex-flow column nowrap
      height 500px
      width 200px
      align-items center
      .name
        margin-top 420px
        font-size 1.1em
        font-weight 900
        text-shadow 1px 2px 3px black
        color #eeeeee
      .level
        font-size .8em
        color #eeeeee
        text-transform uppercase
    .character_new
      height 500px
      width 200px
      display grid
      justify-content center
      align-items center
      .skin
        filter grayscale(100%) blur(3px)
        opacity .6
      >*
        color white
        font-size 2.5em




  .menu_create_character
    position absolute
    width 80%
    height 80%
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
