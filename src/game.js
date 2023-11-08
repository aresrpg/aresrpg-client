import { Scene, Vector3, Color, WebGLRenderer } from 'three'
import { iter } from 'iterator-helper'
import { World } from '@dimforge/rapier3d'

import infinite_grid from './utils/infinite_grid.js'
import { Actions, Packets } from './actions.js'
import entity_attacheable from './modules/entity_attacheable.js'
import ui_fps from './modules/ui_fps.js'
import game_camera from './modules/game_camera.js'
import game_lights from './modules/game_lights.js'
import consume_client_actions from './modules/consume_client_actions.js'

export const GRAVITY = 9.81

/** @typedef {typeof INITIAL_STATE} State */
/** @typedef {() => (state: State, delta: number) => State} Module */

const INITIAL_STATE = {
  target_fps: 120,
  scene: new Scene(),
  world: new World(new Vector3(0, -GRAVITY, 0)),
  renderer: new WebGLRenderer(),
  entities: [],
  lights: new Set(),
  pending_client_actions: [{ type: Actions.UI_FPS, payload: true }],
  pending_server_actions: [
    {
      type: Packets.ADD_LIGHT,
      payload: {
        type: 'directional',
        color: '#ffffff',
        intensity: 1,
        position: { x: -60, y: 100, z: -10 },
        shadow: true,
        shadow_camera: {
          top: 50,
          bottom: -50,
          left: -50,
          right: 50,
          near: 0.1,
          far: 200,
          map_size: { width: 4096, height: 4096 },
        },
      },
    },
    {
      type: Packets.ADD_LIGHT,
      payload: {
        type: 'ambient',
        color: '#ffffff',
        intensity: 0.7,
      },
    },
  ],

  settings: {
    mouse_sensitivity: 0.002,
    ui_fps_enabled: false,
  },

  // indicate that the user entered the pointer lock mode
  camera_control_locked: false,

  player: {
    /** @type {import("three").Object3D} */
    model: null,
  },
}

const GAME_MODULES = [
  consume_client_actions,
  entity_attacheable,
  ui_fps,
  game_camera,
  game_lights,
]

export default async function create_game() {
  const game_state = {
    ...INITIAL_STATE,
  }

  game_state.scene.background = new Color('#E0E0E0')
  game_state.renderer.setPixelRatio(window.devicePixelRatio)
  game_state.renderer.setSize(window.innerWidth, window.innerHeight)
  game_state.renderer.shadowMap.enabled = true

  game_state.scene.add(infinite_grid({ world: game_state.world }))

  const modules = await iter(GAME_MODULES)
    .toAsyncIterator()
    .map(create => create())
    .toArray()

  function animation() {
    let frame_duration = 1000 / game_state.target_fps
    let last_frame_time = performance.now()
    /** @type {State} */
    let current_state = game_state

    return function animate(current_time) {
      requestAnimationFrame(animate)

      const delta = current_time - last_frame_time

      if (delta >= frame_duration) {
        current_state = iter(modules).reduce(
          (state, update) => update(state, delta),
          current_state,
        )
        current_state.world.step()
        last_frame_time = current_time - (delta % frame_duration)
        frame_duration = 1000 / current_state.target_fps
      }
    }
  }

  return {
    start(container) {
      container.appendChild(game_state.renderer.domElement)
      animation()(performance.now())
    },
    stop() {},
  }
}
