<template lang="pug">
Suspense(v-if="show_game")
  Game
.blank(v-else)
  h1 Nothing to see here 👀
</template>

<script setup>
import {
  ref,
  onMounted,
  provide,
  onUnmounted,
  watch,
  reactive,
  watchEffect,
} from 'vue';
import konamiCode from '@sidp/konami-code';
import { VsLoadingFn } from 'vuesax-alpha';

import konami_1 from './assets/konami_1.wav';
import konami_2 from './assets/konami_2.wav';
import konami_3 from './assets/konami_3.wav';
import konami_ok from './assets/konami_ok.wav';
import Game from './game.vue';
import { VITE_KONAMI, VITE_API } from './env.js';

const name = 'app';
const show_game = ref(!VITE_KONAMI);
const konami_sounds = [konami_1, konami_2, konami_3];
const allowed_keys = [37, 38, 39, 40, 66, 65];
const loading = ref(0);

const auth_user = reactive({});

provide('loading', loading);
provide('auth_user', auth_user);

let loading_instance = null;

watchEffect(() => {
  if (loading.value < 0) loading.value = 0;
  if (loading.value === 1) {
    loading_instance?.close();
    loading_instance = VsLoadingFn({
      type: 'square',
      color: '#F1C40F',
      background: '#212121',
    });
  } else if (!loading.value) {
    loading_instance?.close();
  }
});

function request(query, variables = {}) {
  return fetch(VITE_API, {
    credentials: 'include',
    method: 'POST',
    body: JSON.stringify({
      query,
      variables,
    }),
  });
}

const play_konami_sound = event => {
  if (!allowed_keys.includes(event?.keyCode)) return;
  const random_index = Math.floor(Math.random() * konami_sounds.length);
  const random_sound = konami_sounds[random_index];
  new Audio(random_sound).play();
};

const play_konami_ok = () => {
  new Audio(konami_ok).play();
};

if (VITE_KONAMI) {
  konamiCode(function () {
    show_game.value = true;
    play_konami_ok();
    window.removeEventListener('keydown', play_konami_sound);
    this.remove();
  });
}

function on_assets_loaded() {
  loading.value--;
}
function on_assets_loading() {
  loading.value++;
}

onMounted(() => {
  if (VITE_KONAMI) window.addEventListener('keydown', play_konami_sound);

  loading.value++;
  request(`{ me { uuid } }`)
    .then(res => res.json())
    .then(({ data }) => {
      if (data) Object.assign(auth_user, data.me);
    })
    .finally(() => {
      loading.value--;
    });

  window.addEventListener('assets_loaded', on_assets_loaded);
  window.addEventListener('assets_loading', on_assets_loading);
});

onUnmounted(() => {
  window.removeEventListener('assets_loaded', on_assets_loaded);
  window.removeEventListener('assets_loading', on_assets_loading);
});
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

.ares_btn
  background rgba(#212121, .3)
  backdrop-filter blur(12px)
  padding 1em 2em
  border-radius 3px
  text-transform uppercase
  font-weight 900
  cursor pointer
  border 1px solid rgba(black .4)
  font-size .9em
  text-shadow 0 0 3px black
  color #eee
  display flex
  justify-content center
  box-shadow 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)
  transition all 0.3s cubic-bezier(.25,.8,.25,1)
  &:hover
    box-shadow 0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)
  &.disabled
    opacity .5
    cursor default
    pointer-events none

*
  sc-reset()
  sc-disableScollBar()
  font-family 'PT Sans', sans-serif
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

.card-1
  box-shadow 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)
  transition all 0.3s cubic-bezier(.25,.8,.25,1)

.card-1:hover
  box-shadow 0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)

.card-2
  box-shadow 0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)


.card-3
  box-shadow 0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)


.card-4
  box-shadow 0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)


.card-5
  box-shadow 0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22)
</style>
