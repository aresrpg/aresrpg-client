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

      gui.open()
    },
  }
}
