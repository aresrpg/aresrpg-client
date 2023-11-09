import { on } from 'events'

import Stats from 'stats.js'
import { aiter } from 'iterator-helper'

/** @type {Type.Module} */
export default {
  reduce(state, { type, payload }) {
    if (type === 'SHOW_FPS')
      return {
        ...state,
        settings: {
          ...state.settings,
          ui_fps_enabled: payload,
        },
      }

    return state
  },
  observe({ events, dispatch }) {
    let stats = null

    function show_stats(show) {
      if (show && !stats) {
        stats = new Stats()
        stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
        window.document.body.appendChild(stats.dom)
      } else if (!show && stats) {
        window.document.body.removeChild(stats.dom)
        stats = null
      }
    }

    events.on('FRAME', () => stats?.update())

    aiter(on(events, 'STATE_UPDATED'))
      .map(({ settings: { ui_fps_enabled } }) => ui_fps_enabled)
      .reduce(({ last_ui_fps_enabled }, ui_fps_enabled) => {
        if (ui_fps_enabled !== last_ui_fps_enabled) show_stats(ui_fps_enabled)

        return { last_ui_fps_enabled: ui_fps_enabled }
      })
  },
}
