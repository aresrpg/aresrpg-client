import { on } from 'events'

import Stats from 'stats.js'
import { aiter } from 'iterator-helper'

import { abortable } from '../utils/iterator'

/** @type {Type.Module} */
export default function () {
  const stats = new Stats()

  function show_stats(show) {
    if (show) {
      stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
      window.document.body.appendChild(stats.dom)
    } else window.document.body.removeChild(stats.dom)
  }

  return {
    name: 'ui_fps',
    tick() {
      stats.update()
    },
    reduce(state, { type, payload }) {
      if (type === 'action/show_fps')
        return {
          ...state,
          settings: {
            ...state.settings,
            show_fps: payload,
          },
        }

      return state
    },
    observe({ events, dispatch, signal }) {
      aiter(abortable(on(events, 'STATE_UPDATED', { signal })))
        .map(({ settings: { show_fps } }) => show_fps)
        .reduce((last_show_fps, show_fps) => {
          if (show_fps !== last_show_fps) show_stats(show_fps)

          return show_fps
        })
    },
  }
}
