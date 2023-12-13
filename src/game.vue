<template lang="pug">
.aresrpg(v-if="webgl_available")
  Interface(v-if="STATE.game_state === 'GAME'")
  Menu(v-else-if="STATE.game_state === 'MENU'")
  .canvas(ref='renderer_container')
.no_webgl(v-else) It seems WebGL is not available in your browser, please use a descent one 😀
</template>

<script setup>
import { PassThrough } from 'stream';

import {
  onMounted,
  onUnmounted,
  ref,
  provide,
  reactive,
  watch,
  inject,
} from 'vue';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { useWebSocket } from '@vueuse/core';
import { create_client } from 'aresrpg-protocol';

import logger from './utils/logger.js';
import Interface from './interface/ui.vue';
import Menu from './interface/menu.vue';
import { VITE_WS } from './env';
import create_game, { FILTER_PACKET_IN_LOGS } from './game.js';
import toast from './toast.js';

const name = 'app';

const renderer_container = ref(null);
const webgl_available = ref(true);
const packets = new PassThrough({ objectMode: true });
const ares_client = ref(null);
const ws_status = ref('');
const loading = inject('loading');

let disconnect_reason = null;

const game = ref(
  await create_game({
    packets,
    send_packet(type, payload) {
      if (!ares_client.value) throw new Error('Not connected to server');
      if (!FILTER_PACKET_IN_LOGS.includes(type))
        logger.NETWORK_OUT(type, payload);
      ares_client.value.send(type, payload);
    },
    connect_ws() {
      return new Promise(resolve => {
        const { status } = useWebSocket(VITE_WS, {
          autoReconnect: {
            retries: () => !disconnect_reason,
          },

          onDisconnected(ws, event) {
            loading.value--;
            if (event.reason) {
              disconnect_reason = event.reason;
              if (event.reason === 'EARLY_ACCESS_KEY_REQUIRED')
                toast.error(
                  'You need an early access key to play on AresRPG',
                  'Oh no!',
                  `<i class='bx bx-key'/>`,
                );
              else toast.error(event.reason);
            }
            ares_client.value?.notify_end(event.reason);
            logger.SOCKET(`disconnected: ${event.reason}`);
          },
          onMessage(ws, event) {
            const message = event.data;
            ares_client.value.notify_message(message);
          },
          onConnected: ws => {
            disconnect_reason = null;
            ws.binaryType = 'arraybuffer';
            logger.SOCKET(`connected to ${VITE_WS}`);

            ares_client.value = create_client({
              socket_write: ws.send.bind(ws),
              socket_end: message => ws.close(1000, message),
            });

            ares_client.value.stream.pipe(packets);

            resolve();
          },
        });

        watch(status, value => {
          ws_status.value = value;
        });
      });
    },
  }),
);

const STATE = ref({});

provide('state', STATE);
provide('game', game);
provide('ws_status', ws_status);

const update_state = state => {
  STATE.value = state;
};

onMounted(async () => {
  const { start } = game.value;
  if (WebGL.isWebGLAvailable()) {
    start(renderer_container.value);
    game.value.events.on('STATE_UPDATED', update_state);
  } else webgl_available.value = false;
});

onUnmounted(async () => {
  const { stop } = game.value;
  game.value.events.off('STATE_UPDATED', update_state);
  stop();
});
</script>

<style lang="stylus">
.aresrpg
  width 100vw
  height 100vh
  overflow hidden

.no_webgl
  display flex
  justify-content center
  align-items center
  height 100vh
  color #e1c79b
</style>
