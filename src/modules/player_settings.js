import { on } from 'events'

import { aiter } from 'iterator-helper'

const MIN_FPS = 5
const MAX_FPS = 240

/** @type {Type.Module} */
export default function () {
  return {
    name: 'player_settings',
    reduce(state, { type, payload }) {
      switch (type) {
        case 'action/show_fps':
          return {
            ...state,
            settings: {
              ...state.settings,
              show_fps: payload,
            },
          }
        case 'action/target_fps':
          return {
            ...state,
            settings: {
              ...state.settings,
              target_fps: Math.max(MIN_FPS, Math.min(MAX_FPS, payload)),
            },
          }
        case 'action/game_speed':
          return {
            ...state,
            settings: {
              ...state.settings,
              game_speed: Math.max(0, Math.min(2, payload)),
            },
          }
        case 'action/show_terrain_collider':
          return {
            ...state,
            settings: {
              ...state.settings,
              show_terrain_collider: payload,
            },
          }
        case 'action/show_entities_collider':
          return {
            ...state,
            settings: {
              ...state.settings,
              show_entities_collider: payload,
            },
          }
        case 'action/show_terrain':
          return {
            ...state,
            settings: {
              ...state.settings,
              show_terrain: payload,
            },
          }
        case 'action/show_entities':
          return {
            ...state,
            settings: {
              ...state.settings,
              show_entities: payload,
            },
          }
        case 'action/view_distance':
          return {
            ...state,
            settings: {
              ...state.settings,
              view_distance: Math.max(2, Math.min(20, payload)),
            },
          }
        case 'action/far_view_distance':
          return {
            ...state,
            settings: {
              ...state.settings,
              far_view_distance: Math.max(2, Math.min(50, payload)),
            },
          }
        case 'action/biome_settings':
          return {
            ...state,
            world: {
              ...state.world,
              biome: payload,
            },
          }
        case 'action/show_chunk_border':
          return {
            ...state,
            settings: {
              ...state.settings,
              show_chunk_border: payload,
            },
          }
        case 'action/free_camera':
          return {
            ...state,
            settings: {
              ...state.settings,
              free_camera: payload,
            },
          }
      }

      return state
    },
  }
}
