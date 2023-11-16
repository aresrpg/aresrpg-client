import { on } from 'events'

import { aiter } from 'iterator-helper'

const MIN_FPS = 5
const MAX_FPS = 240

/** @type {Type.Module} */
export default function () {
  return {
    reduce(state, { type, payload }) {
      switch (type) {
        case 'update:show_fps':
          return {
            ...state,
            settings: {
              ...state.settings,
              show_fps: payload,
            },
          }
        case 'update:target_fps':
          return {
            ...state,
            settings: {
              ...state.settings,
              target_fps: Math.max(MIN_FPS, Math.min(MAX_FPS, payload)),
            },
          }
        case 'update:game_speed':
          return {
            ...state,
            settings: {
              ...state.settings,
              game_speed: Math.max(0, Math.min(2, payload)),
            },
          }
        case 'update:show_terrain_collider':
          return {
            ...state,
            settings: {
              ...state.settings,
              show_terrain_collider: payload,
            },
          }
        case 'update:show_entities_collider':
          return {
            ...state,
            settings: {
              ...state.settings,
              show_entities_collider: payload,
            },
          }
        case 'update:show_terrain_volume':
          return {
            ...state,
            settings: {
              ...state.settings,
              show_terrain_volume: payload,
            },
          }
        case 'update:show_entities_volume':
          return {
            ...state,
            settings: {
              ...state.settings,
              show_entities_volume: payload,
            },
          }
        case 'update:volume_depth':
          return {
            ...state,
            settings: {
              ...state.settings,
              volume_depth: Math.max(1, Math.min(20, payload)),
            },
          }
        case 'update:show_terrain':
          return {
            ...state,
            settings: {
              ...state.settings,
              show_terrain: payload,
            },
          }
        case 'update:show_entities':
          return {
            ...state,
            settings: {
              ...state.settings,
              show_entities: payload,
            },
          }
      }

      return state
    },
  }
}
