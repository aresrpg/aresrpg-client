import { EventEmitter } from 'events'

import { Scene, Vector3, Color, WebGLRenderer, PerspectiveCamera } from 'three'
import { World } from '@dimforge/rapier3d'
import merge from 'fast-merge-async-iterators'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { aiter } from 'iterator-helper'

import infinite_grid from './utils/infinite_grid.js'
import { combine } from './utils/iterator.js'
import ui_fps from './modules/ui_fps.js'
import game_camera from './modules/game_camera.js'
import game_lights from './modules/game_lights.js'
import {
  ObjectArrayStream,
  PassThrough,
  WebSocketStream,
} from './utils/stream.js'
import game_frame from './modules/game_frame.js'
import mouse_lock from './modules/mouse_lock.js'
import window_resize from './modules/window_resize.js'

export const GRAVITY = 9.81

/** @typedef {typeof INITIAL_STATE} State */
/** @typedef {Omit<Readonly<ReturnType<typeof create_context>>, 'actions'>} Context */
/** @typedef {(state: State, action: Type.Action) => State} Reducer */
/** @typedef {(context: Context) => void} Observer */
/** @typedef {{reduce?: Reducer, observe?: Observer }} Module */

const INITIAL_STATE = {
  /** @type {Map<string, Type.Entity>} */
  entities: new Map(),
  settings: {
    target_fps: 120,
    mouse_sensitivity: 0.002,
    ui_fps_enabled: true,
    key_forward: 'KeyW',
    key_backward: 'KeyS',
    key_left: 'KeyA',
    key_right: 'KeyD',
    key_jump: 'Space',
    show_bounding_boxes: false,
  },

  player: {
    /** @type {Type.Entity} */
    model: null,
    physics: {
      /** @type {import('@dimforge/rapier3d').RigidBody} */
      rigid_body: null,
      /** @type {import('@dimforge/rapier3d').Collider} */
      collider: null,
    },
    height: 2,
    radius: 0.5,
    position: new Vector3(),
  },
}

const GAME_MODULES = [
  ui_fps,
  mouse_lock,
  window_resize,
  game_lights,
  game_camera,
  game_frame,
]

function last_event_value(emitter, event) {
  let value = null
  emitter.on(event, new_value => (value = new_value))
  return () => value
}

function create_context() {
  const world = new World(new Vector3(0, -GRAVITY, 0))
  const scene = new Scene()
  const renderer = new WebGLRenderer()
  const camera = new PerspectiveCamera(
    75, // Field of view
    window.innerWidth / window.innerHeight, // Aspect ratio
    0.1, // Near clipping plane
    1000, // Far clipping plane
  )
  const lock_controls = new PointerLockControls(camera, document.body)
  /** @type {Type.Events} */
  const events = new EventEmitter()
  const actions = new PassThrough()
  /** @type {() => State} */
  const get_state = last_event_value(events, 'STATE_UPDATED')
  return {
    events,
    actions,
    /**
     * @template {keyof Type.Actions} K
     * @param {K} type
     * @param {Type.Actions[K]} [payload] */
    dispatch(type, payload) {
      actions.write({ type, payload })
    },
    get_state,
    world,
    scene,
    renderer,
    camera,
    lock_controls,
  }
}

export default async function create_game() {
  const { actions, ...context } = create_context()
  const { events, world, scene, renderer, get_state } = context

  scene.background = new Color('#E0E0E0')
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true

  scene.add(infinite_grid({ world }))

  const packets = aiter(
    new ObjectArrayStream([
      {
        type: 'packet:ADD_LIGHT',
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
        type: 'packet:ADD_LIGHT',
        payload: {
          type: 'ambient',
          color: '#ffffff',
          intensity: 0.7,
        },
      },
    ]),
  )

  // pipe the packets through the observers
  packets.forEach(({ type, payload }) => events.emit(type, payload))

  // pipe the actions and packets through the reducers
  aiter(combine(packets, actions))
    .reduce(
      (last_state, action) => {
        const state = GAME_MODULES.map(({ reduce }) => reduce)
          .filter(Boolean)
          .reduce((intermediate, fn) => fn(intermediate, action), last_state)
        events.emit('STATE_UPDATED', state)
        return state
      },
      {
        ...INITIAL_STATE,
      },
    )
    .catch(error => {
      console.error(error)
    })

  GAME_MODULES.map(({ observe }) => observe)
    .filter(Boolean)
    .forEach(observe => observe(context))

  function animation() {
    let frame_duration = 1000 / INITIAL_STATE.settings.target_fps
    let last_frame_time = performance.now()

    return function animate(current_time) {
      requestAnimationFrame(animate)

      const delta = current_time - last_frame_time

      if (delta >= frame_duration) {
        const state = get_state()
        events.emit('FRAME', { state, delta })
        last_frame_time = current_time - (delta % frame_duration)
        frame_duration = 1000 / state.settings.target_fps
      }
    }
  }

  return {
    start(container) {
      container.appendChild(renderer.domElement)
      animation()(performance.now())
    },
    stop() {},
  }
}
