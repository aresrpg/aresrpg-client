import { on } from 'events'

import GUI from 'lil-gui'
import { aiter } from 'iterator-helper'

import { INITIAL_STATE } from '../game'

/** @type {Type.Module} */
export default function () {
  const gui = new GUI()
  const settings = {
    show_fps: INITIAL_STATE.settings.ui_fps_enabled,
    show_bounding_boxes: INITIAL_STATE.settings.show_bounding_boxes,
    target_fps: INITIAL_STATE.settings.target_fps,
    game_speed: INITIAL_STATE.settings.game_speed,
  }

  return {
    observe({ events, dispatch }) {
      gui
        .add(settings, 'show_fps')
        .name('Show FPS')
        .onChange(show_fps => {
          dispatch('SHOW_FPS', show_fps)
        })

      gui
        .add(settings, 'show_bounding_boxes')
        .name('Show Bounding Boxes')
        .onChange(show_bounding_boxes => {
          dispatch('SHOW_BOUNDING_BOXES', show_bounding_boxes)
        })

      gui
        .add(settings, 'target_fps', 5, 240, 1)
        .name('Target FPS')
        .onChange(fps => {
          dispatch('TARGET_FPS', fps)
        })

      gui
        .add(settings, 'game_speed', 0.1, 2, 0.1)
        .name('Game Speed')
        .onChange(game_speed => {
          dispatch('GAME_SPEED', game_speed)
        })

      gui.open()
    },
  }
}
