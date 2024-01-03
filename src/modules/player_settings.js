const MIN_FPS = 5
const MAX_FPS = 240

/** @type {Type.Module} */
export default function () {
  return {
    name: 'player_settings',
    tick({ player, settings: { show_entities_collider, debug_mode } }) {
      if (debug_mode && player?.collider) {
        const { collider } = player
        if (collider && collider.visible !== show_entities_collider)
          collider.visible = show_entities_collider
      }
    },
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
        case 'action/view_distance':
          return {
            ...state,
            settings: {
              ...state.settings,
              view_distance: Math.max(1, Math.min(15, payload)),
            },
          }
        case 'action/far_view_distance':
          return {
            ...state,
            settings: {
              ...state.settings,
              far_view_distance: Math.max(5, Math.min(60, payload)),
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
