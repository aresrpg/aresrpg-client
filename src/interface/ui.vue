<template lang="pug">
.ui
  .top_left
    .zone Plaine des Caffres
    .position {{ position }}
    .chunk_position {{ chunk_position }}
    .version version {{ pkg.version }}
    .ws
      .title socket
      .status(:class="{ online: ws_status === 'OPEN', connecting: ws_status === 'CONNECTING', offline: ws_status === 'CLOSED' }")
    .server players {{ server_info.online }}/{{ server_info.max }}
  //- .top_right
  .bottom_panel
    .chat
    .infos
    .inventory
    .map

  .escape_menu(v-if="escape_menu_open")
    vs-button.keys.disabled(@click="on_menu_controls_btn" type="shadow") Controls
    vs-button.quit(@click="on_menu_quit_btn" type="shadow") Change Character

</template>

<script setup>
import { onMounted, onUnmounted, inject, computed, ref, reactive } from 'vue';
import { to_chunk_position } from 'aresrpg-protocol';

import pkg from '../../package.json';

const ws_status = inject('ws_status');
const state = inject('state');
const game = inject('game');
const escape_menu_open = ref(false);
const server_info = reactive({
  online: 0,
  max: 0,
});

const position = computed(() => {
  if (!state.value.player?.position) return [0, 0, 0];
  const {
    position: { x, y, z },
  } = state.value.player;
  return [Math.round(x), Math.round(y), Math.round(z)];
});

const chunk_position = computed(() => {
  const [x, , z] = position.value;
  const { x: cx, z: cz } = to_chunk_position({ x, z });
  return [cx, cz];
});

function on_escape({ key }) {
  if (key === 'Escape') {
    escape_menu_open.value = !escape_menu_open.value;
  }
}

function on_menu_quit_btn() {
  game.value.send_packet('packet/leaveGame', {});
  game.value.dispatch('action/load_game_state', 'MENU');
}

function update_server_info({ online, max }) {
  server_info.online = online;
  server_info.max = max;
}

function on_menu_controls_btn() {}

onMounted(() => {
  window.addEventListener('keydown', on_escape);
  game.value.events.on('packet/serverInfo', update_server_info);
});

onUnmounted(() => {
  window.removeEventListener('keydown', on_escape);
  game.value.events.off('packet/serverInfo', update_server_info);
});
</script>

<style lang="stylus" scoped>
.ui
  >*
    position absolute
  .top_left
    width 300px
    height 200px
    left 0
    top 0
    padding 1em
    text-shadow 1px 2px 3px black
    .zone
      font-size 1.5em
      color #EEEEEE
    .position, .chunk_position
      font-size 1em
      color #EEEEEE
    .version
      margin-top 1em
      font-size .8em
      color #EEEEEE
    .ws
      display flex
      flex-flow row nowrap
      font-size .8em
      align-items center
      .title
        color #EEEEEE
        padding-right .5em
      .status
        width 10px
        height @width
        border-radius 50%
        &.online
          background limegreen
          box-shadow 0 0 5px limegreen
        &.connecting
          background orange
          box-shadow 0 0 5px orange
        &.offline
          background crimson
          box-shadow 0 0 5px crimson
    .server
      font-size .8em
      color #EEEEEE
  .top_right
    width 300px
    height 200px
    top 0
    right 0
  .bottom_panel
    background #212121
    opacity .7
    width 100vw
    height 150px
    bottom 0
    display grid
    display: grid;
    grid-template-columns: 1fr minmax(100px, 200px) 1fr minmax(100px, 200px)
    grid-template-areas "chat infos inventory map"

    .chat
      grid-area chat
      border 3px solid #F39C12
    .infos
      grid-area infos
      border 3px solid #3498DB
    .inventory
      grid-area inventory
      border 3px solid #9B59B6
    .map
      grid-area map
      border 3px solid #F1C40F

  .escape_menu
    position absolute
    background rgba(#212121, .5)
    top 50%
    left 50%
    transform translate(-50%, -50%)
    backdrop-filter blur(12px)
    padding 2em
    padding-bottom 1em
    border-radius 6px
    overflow hidden
    >*
      width 300px
      padding 1em .5em
      display flex
      margin-bottom 1em
    .keys
      opacity .6
</style>
