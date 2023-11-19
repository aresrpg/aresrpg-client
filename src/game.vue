<template lang="pug">
.aresrpg(v-if="webgl_available")
  Interface(v-if="STATE.game_state === 'GAME'")
  Menu(v-else)
  .canvas(ref='renderer_container')
.no_webgl(v-else) It seems WebGL is not available in your browser, please use a descent one 😀
</template>

<script setup>
import { PassThrough } from 'stream'

import { onMounted, onUnmounted, ref, provide, reactive } from 'vue'
import WebGL from 'three/addons/capabilities/WebGL.js'
import { useWebSocket } from '@vueuse/core'
import { protocol_emitter } from 'aresrpg-common'

import logger from './utils/logger.js'
import Interface from './interface/ui.vue'
import Menu from './interface/menu.vue'
import { VITE_WS_SERVER } from './env'
import create_game from './game.js'

const name = 'app'

const renderer_container = ref(null)
const webgl_available = ref(true)
const packets = new PassThrough({ objectMode: true })
const server_emitter = ref(null)
const ws_status = ref(null)
const game = await create_game({
  packets,
  send_packet(type, payload) {
    if (!server_emitter.value) throw new Error('Not connected to server')
    logger.NETWORK_OUT(type, payload)
    server_emitter.value.send(type, payload)
  },
  connect_ws() {
    return new Promise(resolve => {
      const { status } = useWebSocket(VITE_WS_SERVER, {
        autoReconnect: true,
        onConnected: ws => {
          ws.binaryType = 'arraybuffer'
          logger.SOCKET(`connected to ${VITE_WS_SERVER}`)
          server_emitter.value = protocol_emitter(ws)
          server_emitter.value.on('packet', ({ type, value }) => {
            packets.write({ type, payload: value })
          })

          resolve()
        },
      })
      ws_status.value = status
    })
  },
})

const { events } = game

const STATE = reactive({})

provide('state', STATE)
provide('game', game)
provide('ws_status', status)

const update_state = state => Object.assign(STATE, state)

onMounted(async () => {
  const { start } = game
  if (WebGL.isWebGLAvailable()) {
    start(renderer_container.value)
    events.on('STATE_UPDATE', update_state)
  } else webgl_available.value = false
})

onUnmounted(async () => {
  const { stop } = game
  events.off('STATE_UPDATE', update_state)
  stop()
})
</script>

<style lang="stylus">
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
