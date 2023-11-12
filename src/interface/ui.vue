<script setup>
import { onMounted, onUnmounted, inject, reactive } from 'vue'

import pkg from '../../package.json'

const game = inject('game')
const player_location = reactive({ x: 0, y: 0, z: 0 })

const on_state_update = state => {
  const { position } = state.player

  const x = Math.floor(position.x)
  const y = Math.floor(position.y)
  const z = Math.floor(position.z)

  if (player_location.x !== x) player_location.x = x
  if (player_location.y !== y) player_location.y = y
  if (player_location.z !== z) player_location.z = z
}

onMounted(() => {
  const { events } = game
  events.on('STATE_UPDATED', on_state_update)
})

onUnmounted(() => {
  const { events } = game
  events.off('STATE_UPDATED', on_state_update)
})
</script>

<template lang="pug">
.ui
  .top_left
    .zone Plaine des Caffres
    .location ({{ player_location.x }}, {{ player_location.y }}, {{ player_location.z }})
    .version release {{ pkg.version }}
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