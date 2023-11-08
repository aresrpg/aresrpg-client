import Stats from 'stats.js'

import { Actions, pop_actions } from '../actions.js'

/** @type {import("../game").Module} */
export default function () {
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

  return (state, delta) => {
    const {
      pending_client_actions,
      settings,
      settings: { ui_fps_enabled },
    } = state

    if (ui_fps_enabled && stats) stats.update()

    const [fps_actions, remaining_actions] = pop_actions(
      [Actions.UI_FPS],
      pending_client_actions,
    )

    fps_actions.forEach(show_stats)

    return {
      ...state,
      pending_client_actions: remaining_actions,
      settings: {
        ...settings,
        ui_fps_enabled: !!stats,
      },
    }
  }
}
