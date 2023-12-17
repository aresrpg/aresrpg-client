<template lang="pug">
.menu
  nav
    img.logo(:src="logo")
    .version build {{ pkg.version }}
  .infos(v-if="menu_type === 'PLAY'")
    vs-alert(color="#3498DB" type="gradient")
      | We moved away from Minecraft as it was too limited for our needs. We are now using our own game engine, which allows us to do much more. We are still in early development, but we are working hard to bring you the best experience possible. Stay tuned!
      | #[b If you own an early access key, you can already connect to the game and follow the development.]
      template(#title) AresRPG is now a standalone game!

  .menu_play(v-if="menu_type === 'PLAY'")
    img.logo(:src="text_logo")
    .btns
      .ares_btn(v-if="!is_logged" @click="open_app" ) Login
      .ares_btn(v-else @click="play" :class="{ disabled: play_button_disabled}") Play
      .sub
        .discord.ares_btn(@click="open_discord") Discord
        .twitter.ares_btn(@click="open_twitter") Twitter
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
      i.bx.bx-plus.bx-md
  .menu_create_character(v-if="menu_type === 'CREATE_CHARACTER'")
    .slider
    .desc
    .perso
    .spells
    vs-input.name(block placeholder="Enter your name" v-model="name" @keyup.enter="create_character")
      template(#message-danger v-if="name_error") {{ name_error }}
    vs-button.back(type="shadow" color="#2ECC71" @click="show_characters_menu") Cancel
    vs-button.play(:class=`{ disabled: name_error || name_too_short || name_too_long || name_invalid }` type="shadow" color="#2ECC71" @click="create_character") Create
</template>

<script setup>
import {
  inject,
  onUnmounted,
  onMounted,
  ref,
  watch,
  watchEffect,
  computed,
} from 'vue';

import logo from '../assets/logo.png';
import text_logo from '../assets/text_logo.png';
import pkg from '../../package.json';
import { VITE_API } from '../env';

const game = inject('game');
const state = inject('state');
const loading = inject('loading');
const ws_status = inject('ws_status');
const auth_user = inject('auth_user');
const name = ref('');
const play_button_disabled = ref(false);

const name_error = ref('');

const is_logged = computed(() => !!auth_user?.uuid);

const menu_type = ref(ws_status.value === 'OPEN' ? 'CHARACTERS' : 'PLAY');

const open_app = () => {
  window.location.href = 'https://app.aresrpg.world';
};

const open_discord = () => {
  window.open('https://discord.gg/aresrpg', '_blank');
};

const open_twitter = () => {
  window.open('https://twitter.com/aresrpg', '_blank');
};

function play() {
  play_button_disabled.value = true;
  game.value.events.emit('CONNECT_TO_SERVER');
  loading.value++;

  // prevent spam
  setTimeout(() => {
    play_button_disabled.value = false;
  }, 4000);
}

function show_characters_menu() {
  game.value.events.emit('MOVE_MENU_CAMERA', [-8, 1.2, 4]);
  menu_type.value = 'CHARACTERS';
}

function show_characters_creation() {
  game.value.events.emit('MOVE_MENU_CAMERA', [-8, 1.6, 4]);
  menu_type.value = 'CREATE_CHARACTER';
}

function on_character_list({ characters }) {
  loading.value--;
  name.value = '';
  if (!characters.length) show_characters_creation();
  else show_characters_menu();
}

const name_too_short = computed(() => name.value.trim().length < 3);
const name_too_long = computed(() => name.value.trim().length > 20);
const name_invalid = computed(
  () => !name.value.trim().match(/^[a-zA-Z0-9-_]+$/),
);

function on_server_error({ code }) {
  switch (code) {
    case 'CREATE_CHARACTER_NAME_TAKEN':
      name_error.value = 'This name is already taken';
      break;
    default:
      break;
  }
}

watch(name, value => {
  if (value.length > 2 && name_too_long.value)
    name_error.value = 'Name is too long';
  else if (value.length > 2 && name_invalid.value)
    name_error.value = 'Name is invalid';
  else if (value) name_error.value = '';
});

function create_character() {
  game.value.send_packet('packet/createCharacter', { name: name.value });
}

function select_character({ id }) {
  game.value.dispatch('action/select_character', id);
  game.value.send_packet('packet/selectCharacter', { id });
}

onMounted(() => {
  game.value.events.on('packet/listCharactersResponse', on_character_list);
  game.value.events.on('packet/error', on_server_error);
});

onUnmounted(() => {
  game.value.events.off('packet/listCharactersResponse', on_character_list);
  game.value.events.off('packet/error', on_server_error);
});
</script>

<style lang="stylus" scoped>
a
  text-decoration none
  &:hover
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

  .infos
    position absolute
    top 1em
    left 50%
    transform translateX(-50%)
    b
      display flex
      padding-top 1em
      text-decoration underline


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
        background url('src/assets/iop_bg.png') center / cover
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
    display grid
    background rgba(#212121, .5)
    border-radius 12px
    overflow hidden
    place-items center center
    grid "slider slider slider" 4fr "desc perso spells" 4fr "back name play" 1fr / 1fr 1fr 1fr
    >*
      color #eeeeee
    .slider
      grid-area slider
      place-self stretch
      margin 1em
      background grey
    .desc
      grid-area desc
      place-self stretch
      margin 1em 3em
      background grey
    .perso
      grid-area perso
      place-self stretch
      margin 1em
      background grey
    .spells
      grid-area spells
      place-self stretch
      margin 1em 3em
      background grey
    .name
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
    .play
      grid-area play

  .menu_play
    position absolute
    top 42%
    left 50%
    transform translate(-50%, -50%)
    display flex
    flex-flow column nowrap
    justify-content center
    align-items center
    .btns
      width 300px
      user-select none
      >div
        margin-bottom .5em
      .sub
        display flex
        flex-flow row nowrap
        justify-content space-between
        >div
          width 100%
      .discord
        margin-right .5em
        background rgba(#7289DA, .8)
        &:hover
          background #5b6eae
      .twitter
        background rgba(#1DA1F2, .8)
        &:hover
          background #1b7bb9
    .play
      margin-bottom 1em
      width 200px
    img.logo
      margin-bottom 2em
      width 600px
      filter drop-shadow(1px 2px 3px black)
</style>
