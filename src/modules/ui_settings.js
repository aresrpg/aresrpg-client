import { on } from 'events'

import { GUI } from 'dat.gui'
import { aiter } from 'iterator-helper'

import { INITIAL_STATE } from '../game'

import { DAY_DURATION } from './game_nature'

/** @type {Type.Module} */
export default function () {
  const settings = { ...INITIAL_STATE.settings }
  const biome_settings = { ...INITIAL_STATE.world.biome }

  return {
    name: 'ui_settings',
    observe({ events, dispatch, signal, get_state }) {
      let gui = new GUI()
      signal.addEventListener('abort', () => {
        gui?.destroy()
        gui = new GUI()
      })

      const game_folder = gui.addFolder('Game Settings')
      const terrain_folder = gui.addFolder('Terrain Settings')
      const entity_folder = gui.addFolder('Entity Settings')
      const world_gen_folder = gui.addFolder('World Gen Settings')
      const camera_folder = gui.addFolder('Camera Settings')

      const handle_change = name => value => dispatch(name, value)
      const handle_biome_change = property => value => {
        const { biome } = get_state().world
        dispatch('action/biome_settings', {
          ...biome,
          [property]: value,
        })
      }

      game_folder
        .add(settings, 'show_fps')
        .name('Show FPS')
        .onFinishChange(handle_change('action/show_fps'))

      game_folder
        .add(settings, 'target_fps', 5, 240, 1)
        .name('Target FPS')
        .onFinishChange(handle_change('action/target_fps'))

      game_folder
        .add(settings, 'game_speed', 0, 2, 0.1)
        .name('Game Speed')
        .onFinishChange(handle_change('action/game_speed'))

      game_folder
        .add(
          {
            teleport: () =>
              dispatch('packet/playerPosition', {
                position: { x: 0, y: 300, z: 0 },
              }),
          },
          'teleport',
        )
        .name('Reset player position')

      game_folder
        .add(
          {
            set_time: () => events.emit('SET_TIME', DAY_DURATION * 0.7),
          },
          'set_time',
        )
        .name('Set day')

      terrain_folder
        .add(settings, 'show_terrain')
        .name('Show Terrain')
        .onFinishChange(handle_change('action/show_terrain'))

      terrain_folder
        .add(settings, 'show_terrain_collider')
        .name('Terrain collider')
        .onFinishChange(handle_change('action/show_terrain_collider'))

      terrain_folder
        .add(settings, 'view_distance', 2, 20, 1)
        .name('View distance')
        .onFinishChange(handle_change('action/view_distance'))

      terrain_folder
        .add(settings, 'show_chunk_border')
        .name('Show Chunk Border')
        .onFinishChange(handle_change('action/show_chunk_border'))

      entity_folder
        .add(settings, 'show_entities')
        .name('Show Entities')
        .onFinishChange(handle_change('action/show_entities'))

      entity_folder
        .add(settings, 'show_entities_collider')
        .name('Entities collider')
        .onFinishChange(handle_change('action/show_entities_collider'))

      world_gen_folder
        .add(biome_settings, 'scale', 1, 1000, 1)
        .name('Scale')
        .onFinishChange(handle_biome_change('scale'))

      world_gen_folder
        .add(biome_settings, 'height', 1, 100, 1)
        .name('Height')
        .onFinishChange(handle_biome_change('height'))

      world_gen_folder
        .add(biome_settings, 'octaves', 1, 10, 1)
        .name('Octaves')
        .onFinishChange(handle_biome_change('octaves'))

      world_gen_folder
        .add(biome_settings, 'persistence', 0, 1, 0.01)
        .name('Persistence')
        .onFinishChange(handle_biome_change('persistence'))

      world_gen_folder
        .add(biome_settings, 'lacunarity', 0, 10, 0.01)
        .name('Lacunarity')
        .onFinishChange(handle_biome_change('lacunarity'))

      world_gen_folder
        .add(biome_settings, 'exponentiation', 0, 10, 0.01)
        .name('Exponentiation')
        .onFinishChange(handle_biome_change('exponentiation'))

      camera_folder
        .add(settings, 'free_camera')
        .name('Free Camera')
        .onFinishChange(handle_change('action/free_camera'))

      gui.show()
      game_folder.open()
      terrain_folder.open()
      // entity_folder.open()
      // world_gen_folder.open()
      camera_folder.open()
    },
  }
}
