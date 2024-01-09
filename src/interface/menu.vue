<script setup>
import { inject, onUnmounted, onMounted, ref, watch, computed } from 'vue';
import Spells from '@aresrpg/aresrpg-protocol/src/spells.json';

import logo from '../assets/logo.png';
import text_logo from '../assets/text_logo.png';
import pkg from '../../package.json';
import iop from '../assets/class/iop.jpg';
import iop_f from '../assets/class/iop_f.jpg';
import sram from '../assets/class/sram.jpg';
import sram_f from '../assets/class/sram_f.jpg';
import xelor from '../assets/class/xelor.jpg';

import Display from './menu_class_display.vue';
import SpellDisplay from './menu_spell_display.vue';

const game = inject('game');
const state = inject('state');
const loading = inject('loading');
const ws_status = inject('ws_status');
const auth_user = inject('auth_user');
const name = ref('');
const play_button_disabled = ref(false);

const name_error = ref('');
const selected_class_type = ref('IOP_MALE');

const characters = [
  {
    type: 'IOP_MALE',
    class: 'iop',
    image: iop,
    name: 'Iop (male)',
    desc: "Knights of the realm, the Iop's are as brave as they are brawn. With a penchant for charging headfirst into battle, their formidable strength is an asset in close combat. Though not the most strategic fighters, an Iop's presence on the battlefield can change the tide with a swing of their mighty sword.",
  },
  {
    type: 'IOP_FEMALE',
    class: 'iop',
    image: iop_f,
    name: 'Iop (female)',
    desc: 'The female Iop stands tall among her peers, blending grace with overwhelming power. Her sword, a whirlwind of steel, carves through enemies with precision and might. While often underestimated, her strategic prowess and indomitable courage make her a true force to be reckoned with.',
  },
  {
    type: 'SRAM_MALE',
    class: 'sram',
    image: sram,
    name: 'Sram (male)',
    desc: "Emerging from the shadows, the male Sram is the embodiment of death's guile. A master of stealth and deceit, he can vanish from sight to strike when least expected. With the power to summon skeletal warriors and lay cunning traps, he ensures that the battlefield is always in his favor.",
  },
  {
    type: 'SRAM_FEMALE',
    class: 'sram',
    image: sram_f,
    name: 'Sram (female)',
    desc: 'The female Sram, a specter of stealth and subterfuge, wields the powers of invisibility and necromancy with sinister finesse. Her traps ensnare the unwary, and her summoned minions rise from the earth to do her bidding. In the art of silent assassination, she has no equal.',
  },
  {
    type: 'XELOR',
    image: xelor,
    disabled: true,
    desc: 'Xelors are the manipulators of time itself, capable of bending moments to their will. They can slow down foes, hasten allies, and, if legends are to be believed, reverse the flow of battle. Their command over temporal magic makes them enigmatic and unpredictable adversaries.',
  },
  { type: 'XELOR', image: xelor, disabled: true },
  { type: 'XELOR', image: xelor, disabled: true },
  { type: 'XELOR', image: xelor, disabled: true },
  { type: 'XELOR', image: xelor, disabled: true },
];

function get_character_skin({ classe, female, ...rest }) {
  if (classe === 'IOP') return female ? iop_f : iop;
  if (classe === 'SRAM') return female ? sram_f : sram;
}

const selected_class_data = computed(() => {
  const character = characters.find(
    character => character.type === selected_class_type.value,
  );

  return {
    ...character,
    spells: Spells[character.class],
  };
});
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
  game.value.events.emit('MOVE_MENU_CAMERA', [-10, 45, 47]);
  menu_type.value = 'CHARACTERS';
}

function show_characters_creation() {
  game.value.events.emit('MOVE_MENU_CAMERA', [-10, 39, 50]);
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
  const female = selected_class_type.value.includes('FEMALE');
  const classe = selected_class_type.value.includes('IOP') ? 'IOP' : 'SRAM';
  game.value.send_packet('packet/createCharacter', {
    name: name.value,
    classe,
    female,
  });
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
      .ares_btn.green(v-else @click="play" :class="{ disabled: play_button_disabled}") Play
      .sub
        .discord.ares_btn(@click="open_discord") Discord
        .twitter.ares_btn(@click="open_twitter") Twitter
  .menu_characters(v-if="menu_type === 'CHARACTERS'")
    .character(v-for="character in state.characters" @click="() => select_character(character)")
      .skin(:style="{ background: `url(${get_character_skin(character)}) center / cover`}")
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
    .class_name {{ selected_class_data.name }}
    .slider
      .character(
        v-for="character in characters"
        :style="{ background: `url(${character.image}) center / cover` }"
        @click="() => selected_class_type = character.type"
        :class="{ selected: selected_class_type === character.type, disabled: character.disabled }"
      )
    .desc {{ selected_class_data.desc }}
    .perso
      Display(:type="selected_class_type")
    .spells
      SpellDisplay(:spells="selected_class_data.spells")
    vs-input.name(block placeholder="Enter your name" v-model="name" @keyup.enter="create_character")
      template(#message-danger v-if="name_error") {{ name_error }}
    vs-button.back(type="shadow" color="#2ECC71" @click="show_characters_menu") Cancel
    vs-button.play(:class=`{ disabled: name_error || name_too_short || name_too_long || name_invalid }` type="shadow" color="#2ECC71" @click="create_character") Create
</template>

<style lang="stylus" scoped>
.ares_btn.green
  background #2ECC71
  &:hover
    background #27ae60
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
        background url('../assets/iop_bg.png') center / cover
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
    grid "title title title" 50px "slider slider slider" 4fr "desc perso spells" 4fr "back name play" 1fr / 1fr 1fr 1fr
    >*
      color #eeeeee
    .class_name
      grid-area title
      font-size 1.5em
      text-align center
      font-weight 900
      text-shadow 1px 2px 3px black
      text-transform uppercase
      place-self end center
    .slider
      grid-area slider
      place-self stretch
      margin 1em
      display flex
      flex-flow row nowrap
      justify-content center
      padding 0 5%
      .character
        border-bottom 3px solid black
        width 150px // adjust if necessary to fill the container width
        max-height 500px
        cursor pointer
        opacity .5
        position relative // For pseudo-element positioning
        // Adjust the clip-path to cover the gap; tweak the percentages as necessary
        clip-path polygon(40% 0, 100% 0, 65% 100%, 5% 100%)
        margin-left -60px
        filter drop-shadow(3px 1px 1px black)
        &::after
          content ''
          position absolute
          top 0
          right 0
          width 36%
          height 100%
          background white
          z-index 10
          clip-path polygon(90% 0, 100% 0, 65% 100%, 5% 100%)
        &:hover
          filter brightness(1.2)
        &.selected
          opacity 1
          // filter drop-shadow(1px 2px 3px black)
        &.disabled
          filter grayscale(100%)
          opacity .2
          cursor default
        &:first-child
          margin-left 0
          border-top-left-radius 6px
          border-bottom-left-radius 6px
          clip-path polygon(0 0, 100% 0, 65% 100%, 0 100%)
        &:last-child
          border-top-right-radius 6px
          border-bottom-right-radius 6px
          clip-path polygon(40% 0, 100% 0, 100% 100%, 5% 100%)
          &::after
            display none

    .desc
      grid-area desc
      margin 1em 3em
      padding 1em
      place-self stretch
      background rgba(0,0,0,0.5)
      border 1px solid #8b7355 // A border color that fits the game's aesthetic
      box-shadow 0 4px 8px rgba(0, 0, 0, 0.1) // Soft shadow for depth
      color #E0E0E0 // Light text for readability
      font-size 1.2em
      line-height 1.5
      overflow-y auto // Allows scrolling if the content is too long
      border-radius 6px // Slight rounding of corners

    .perso
      grid-area perso
      place-self stretch
      margin 1em
    .spells
      grid-area spells
      place-self stretch
      margin 1em 3em
      background rgba(0,0,0,0.2)
      border 1px solid #8b7355 // A border color that fits the game's aesthetic
      border-radius 6px // Slight rounding of corners

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
