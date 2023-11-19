<script setup>
import { onMounted, onUnmounted, inject, reactive } from 'vue'

import { PLAYER_ID } from '../game.js'
import World from '../world.js'
import pkg from '../../package.json'

const game = inject('game')
const ws_status = inject('ws_status')
const player_chunk_position = reactive({ x: 0, z: 0 })

let interval = null

onMounted(() => {
  const { world } = game
  interval = setInterval(() => {
    const player = world.entities.get(PLAYER_ID)
    if (!player) return

    Object.assign(player_chunk_position, World.chunk_position(player.position))
  }, 1000)
})

onUnmounted(() => {
  clearInterval(interval)
})
</script>

<template lang="pug">
.ui
  .top_left
    .zone Plaine des Caffres
    .location ({{ player_chunk_position.x }}, {{ player_chunk_position.z }})
    .version version {{ pkg.version }}
    .ws
      .title socket
      .status(:class="{ online: ws_status === 'OPEN', connecting: ws_status === 'CONNECTING', offline: ws_status === 'CLOSED' }")
  //- .top_right
  .bottom_panel
    .chat
    .infos
    .inventory
    .map

</template>

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
    .location
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
</style>
