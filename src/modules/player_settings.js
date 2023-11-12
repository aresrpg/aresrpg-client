import { on } from 'events'

import { aiter } from 'iterator-helper'

const MIN_FPS = 5
const MAX_FPS = 240

/** @type {Type.Module} */
export default function () {
  return {
    reduce(state, { type, payload }) {
      if (type === 'TARGET_FPS')
        return {
          ...state,
          settings: {
            ...state.settings,
            target_fps: Math.max(MIN_FPS, Math.min(MAX_FPS, payload)),
          },
        }
      if (type === 'GAME_SPEED')
        return {
          ...state,
          settings: {
            ...state.settings,
            game_speed: Math.max(0.1, Math.min(2, payload)),
          },
        }
      return state
    },
  }
}
