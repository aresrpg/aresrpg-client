import { on } from 'events'

import GUI from 'lil-gui'
import { aiter } from 'iterator-helper'

import { INITIAL_STATE } from '../game'

/** @type {Type.Module} */
export default function () {
  const gui = new GUI()
  const settings = { ...INITIAL_STATE.settings }

  return {
    observe({ events, dispatch }) {
      const game_folder = gui.addFolder('Game Settings')
      const physics_folder = gui.addFolder('Physics Settings')

      const handle_change = name => value => dispatch(name, value)

      game_folder
        .add(settings, 'show_fps')
        .name('Show FPS')
        .onChange(handle_change('update:show_fps'))

      game_folder
        .add(settings, 'target_fps', 5, 240, 1)
        .name('Target FPS')
        .onChange(handle_change('update:target_fps'))

      game_folder
        .add(settings, 'game_speed', 0, 2, 0.1)
        .name('Game Speed')
        .onChange(handle_change('update:game_speed'))

      game_folder
        .add(settings, 'show_terrain')
        .name('Show Terrain')
        .onChange(handle_change('update:show_terrain'))

      game_folder
        .add(settings, 'show_entities')
        .name('Show Entities')
        .onChange(handle_change('update:show_entities'))

      physics_folder
        .add(settings, 'show_terrain_collider')
        .name('Terrain collider')
        .onChange(handle_change('update:show_terrain_collider'))

      physics_folder
        .add(settings, 'show_entities_collider')
        .name('Entities collider')
        .onChange(handle_change('update:show_entities_collider'))

      physics_folder
        .add(settings, 'show_terrain_volume')
        .name('Terrain Volume')
        .onChange(handle_change('update:show_terrain_volume'))

      physics_folder
        .add(settings, 'show_entities_volume')
        .name('Entities Volume')
        .onChange(handle_change('update:show_entities_volume'))

      physics_folder
        .add(settings, 'volume_depth', 1, 20, 1)
        .name('Volume Depth')
        .onChange(handle_change('update:volume_depth'))

      gui.open()
    },
  }
}
