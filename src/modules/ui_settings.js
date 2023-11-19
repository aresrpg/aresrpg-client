import { on } from 'events'

import GUI from 'lil-gui'
import { aiter } from 'iterator-helper'

import { INITIAL_STATE } from '../game'

/** @type {Type.Module} */
export default function () {
  let gui = new GUI()
  const settings = { ...INITIAL_STATE.settings }

  return {
    name: 'ui_settings',
    observe({ events, dispatch, signal }) {
      signal.addEventListener('abort', () => {
        gui?.destroy()
        gui = new GUI()
      })

      const game_folder = gui.addFolder('Game Settings')
      const terrain_folder = gui.addFolder('Terrain Settings')
      const entity_folder = gui.addFolder('Entity Settings')

      const handle_change = name => value => dispatch(name, value)

      game_folder
        .add(settings, 'show_fps')
        .name('Show FPS')
        .onChange(handle_change('action/show_fps'))

      game_folder
        .add(settings, 'target_fps', 5, 240, 1)
        .name('Target FPS')
        .onChange(handle_change('action/target_fps'))

      game_folder
        .add(settings, 'game_speed', 0, 2, 0.1)
        .name('Game Speed')
        .onChange(handle_change('action/game_speed'))

      terrain_folder
        .add(settings, 'show_terrain')
        .name('Show Terrain')
        .onChange(handle_change('action/show_terrain'))

      entity_folder
        .add(settings, 'show_entities')
        .name('Show Entities')
        .onChange(handle_change('action/show_entities'))

      terrain_folder
        .add(settings, 'show_terrain_collider')
        .name('Terrain collider')
        .onChange(handle_change('action/show_terrain_collider'))

      entity_folder
        .add(settings, 'show_entities_collider')
        .name('Entities collider')
        .onChange(handle_change('action/show_entities_collider'))

      terrain_folder
        .add(settings, 'show_terrain_volume')
        .name('Terrain Volume')
        .onChange(handle_change('action/show_terrain_volume'))

      entity_folder
        .add(settings, 'show_entities_volume')
        .name('Entities Volume')
        .onChange(handle_change('action/show_entities_volume'))

      game_folder
        .add(settings, 'volume_depth', 1, 20, 1)
        .name('Volume Depth')
        .onChange(handle_change('action/volume_depth'))

      gui.open()
    },
  }
}
