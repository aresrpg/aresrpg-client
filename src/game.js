import { EventEmitter, on } from 'events'
import { PassThrough } from 'stream'

import { Scene, Vector3, Color, WebGLRenderer, PerspectiveCamera } from 'three'
import { CoefficientCombineRule, ColliderDesc, World } from '@dimforge/rapier3d'
import merge from 'fast-merge-async-iterators'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { aiter } from 'iterator-helper'

import create_terrain from './utils/create_terrain.js'
import { combine } from './utils/iterator.js'
import ui_fps from './modules/ui_fps.js'
import game_camera from './modules/game_camera.js'
import game_lights from './modules/game_lights.js'
import { ObjectArrayStream, WebSocketStream } from './utils/stream.js'
import window_resize from './modules/window_resize.js'
import entity_add from './modules/entity_add.js'
import entity_bbox from './modules/entity_bbox.js'
import player_inputs from './modules/player_inputs.js'
import entity_movement from './modules/entity_movement.js'
import ui_settings from './modules/ui_settings.js'
import player_settings from './modules/player_settings.js'

export const GRAVITY = 9.81
export const PLAYER_ID = 'player'

const FILTER_ACTION_IN_LOGS = ['PLAYER_MOVED', 'KEYDOWN', 'KEYUP']

/** @typedef {typeof INITIAL_STATE} State */
/** @typedef {Omit<Readonly<ReturnType<typeof create_context>>, 'actions'>} Context */
/** @typedef {(state: State, action: Type.Action) => State} Reducer */
/** @typedef {(context: Context) => void} Observer */
/** @typedef {(state: State, context: Context, delta: number) => void} Ticker */
/** @typedef {{ world: World, renderer: WebGLRenderer }} ModuleInput */
/** @typedef {({ world, renderer }: ModuleInput) => { reduce?: Reducer, observe?: Observer, tick?: Ticker }} Module */

export const INITIAL_STATE = {
  entities: new Map(),
  settings: {
    target_fps: 60,
    game_speed: 1,
    mouse_sensitivity: 0.005,
    ui_fps_enabled: true,
    keymap: new Map([
      ['KeyW', 'forward'],
      ['KeyS', 'backward'],
      ['KeyA', 'left'],
      ['KeyD', 'right'],
      ['Space', 'jump'],
      ['KeyF', 'dance'],
    ]),
    show_bounding_boxes: false,
  },

  inputs: {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    dance: false,
  },

  player: {
    id: PLAYER_ID,
    type: 'character',
    body_type: 'kinematic',
    /** @type {Type.Entity} */
    model: null,
    move: position => {},
    /** @type {import('@dimforge/rapier3d').Collider} */
    collider: null,
    /** @type {import('@dimforge/rapier3d').RigidBody} */
    rigid_body: null,
    remove: () => {},
    height: 2,
    radius: 0.5,
    // represent the supposed position (for updates)
    // the real position is inside the model
    position: new Vector3(),
    body_position() {
      return new Vector3()
    },
    feet_position() {
      return new Vector3()
    },
    animations: {
      mixer: null,
      IDLE: null,
      RUN: null,
      RUN_BACKWARDS: null,
      DANCE: null,
      JUMP: null,
      STRAFE_LEFT: null,
      STRAFE_RIGHT: null,
    },
  },
}

const GAME_MODULES = [
  ui_fps,
  ui_settings,
  window_resize,
  entity_add,
  entity_bbox,
  entity_movement,
  player_inputs,
  player_settings,
  game_lights,
  game_camera,
]

function last_event_value(emitter, event) {
  let value = null
  emitter.on(event, new_value => {
    value = new_value
  })
  return () => value
}

function create_context() {
  const world = new World(new Vector3(0, -GRAVITY, 0))
  const scene = new Scene()
  const renderer = new WebGLRenderer()
  const camera = new PerspectiveCamera(
    60, // Field of view
    window.innerWidth / window.innerHeight, // Aspect ratio
    0.1, // Near clipping plane
    1000, // Far clipping plane
  )

  /** @type {Type.Events} */
  // @ts-ignore
  const events = new EventEmitter()
  const actions = new PassThrough({ objectMode: true })
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
  }
}

export default async function create_game() {
  const { actions, ...context } = create_context()
  const { events, world, scene, renderer, get_state, camera, dispatch } =
    context

  scene.background = new Color('#E0E0E0')
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true

  create_terrain({ world, scene })

  const modules = GAME_MODULES.map(create => create({ world, renderer }))

  const packets = aiter(
    // @ts-ignore
    new ObjectArrayStream([
      {
        type: 'packet:LIGHT_ADD',
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
        type: 'packet:LIGHT_ADD',
        payload: {
          type: 'ambient',
          color: '#ffffff',
          intensity: 0.7,
        },
      },
      {
        type: 'packet:ENTITY_ADD',
        payload: {
          id: PLAYER_ID,
          type: 'character',
          position: [0, 30, 0],
        },
      },
      {
        type: 'packet:ENTITY_ADD',
        payload: {
          id: 'test',
          type: 'test',
          position: [5, 35, 0],
        },
      },
    ]),
  )

  // pipe the actions and packets through the reducers
  aiter(combine(packets, actions))
    .reduce(
      (last_state, /** @type {Type.Action} */ action) => {
        const state = modules
          .map(({ reduce }) => reduce)
          .filter(Boolean)
          .reduce((intermediate, fn) => {
            const result = fn(intermediate, action)
            if (!result) throw new Error(`Reducer ${fn} didn't return a state`)
            return result
          }, last_state)
        if (action.type.includes('packet:')) {
          console.log('%c◀️◀️', 'color: #FFA726;', action.type, action.payload)
          events.emit(action.type, action.payload)
        } else {
          if (!FILTER_ACTION_IN_LOGS.includes(action.type))
            console.log('%c▶️', 'color: #4FC3F7;', action.type, action.payload)
        }
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

  modules
    .map(({ observe }) => observe)
    .filter(Boolean)
    .forEach(observe => observe(context))

  function animation() {
    let frame_duration = 1000 / INITIAL_STATE.settings.target_fps
    let last_frame_time = performance.now()
    let { game_speed } = INITIAL_STATE.settings

    return function animate(current_time) {
      requestAnimationFrame(animate)

      const delta = (current_time - last_frame_time) * game_speed

      if (delta >= frame_duration) {
        const state = get_state()

        world.step()

        if (state && state.player.model)
          modules
            .map(({ tick }) => tick)
            .filter(Boolean)
            .forEach(tick => tick(state, context, delta))

        renderer.render(scene, camera)

        last_frame_time =
          current_time - ((current_time - last_frame_time) % frame_duration)

        const updated_fps = state?.settings?.target_fps
        if (
          updated_fps != null &&
          updated_fps !== INITIAL_STATE.settings.target_fps
        )
          frame_duration = 1000 / state.settings.target_fps
        const udpated_game_speed = state?.settings?.game_speed
        if (udpated_game_speed != null && udpated_game_speed !== game_speed)
          game_speed = udpated_game_speed
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
