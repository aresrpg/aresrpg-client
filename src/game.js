import { EventEmitter, on } from 'events'
import { PassThrough } from 'stream'

import {
  Scene,
  Vector3,
  Color,
  WebGLRenderer,
  PerspectiveCamera,
  Line3,
  PCFSoftShadowMap,
  sRGBEncoding,
  Fog,
  Object3D,
  AnimationMixer,
  AnimationAction,
} from 'three'
import merge from 'fast-merge-async-iterators'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { aiter } from 'iterator-helper'

import { combine } from './utils/iterator.js'
import ui_fps from './modules/ui_fps.js'
import game_camera from './modules/game_camera.js'
import game_lights from './modules/game_lights.js'
import { ObjectArrayStream, WebSocketStream } from './utils/stream.js'
import window_resize from './modules/window_resize.js'
import entity_add from './modules/entity_add.js'
import player_inputs from './modules/player_inputs.js'
import player_movement from './modules/player_movement.js'
import ui_settings from './modules/ui_settings.js'
import player_settings from './modules/player_settings.js'
import World from './world.js'
import game_map from './modules/game_chunk.js'

export const GRAVITY = 9.81
export const PLAYER_ID = 'player'

const DEBUG_MODE = true

const FILTER_ACTION_IN_LOGS = ['update:keydown', 'update:keyup']

/** @typedef {typeof INITIAL_STATE} State */
/** @typedef {Omit<Readonly<ReturnType<typeof create_context>>, 'actions'>} Context */
/** @typedef {(state: State, action: Type.Action) => State} Reducer */
/** @typedef {(context: Context) => void} Observer */
/** @typedef {(state: State, context: Context, delta: number) => void} Ticker */
/** @typedef {{ renderer: WebGLRenderer }} ModuleInput */
/** @typedef {({ renderer }: ModuleInput) => { reduce?: Reducer, observe?: Observer, tick?: Ticker }} Module */
/** @typedef {typeof INITIAL_STATE.player} Entity */
/** @typedef {import("three").AnimationAction} AnimAction */

export const INITIAL_STATE = {
  entities: new Map(),
  settings: {
    target_fps: 60,
    game_speed: 1,
    mouse_sensitivity: 0.005,
    show_fps: true,
    keymap: new Map([
      ['KeyW', 'forward'],
      ['KeyS', 'backward'],
      ['KeyA', 'left'],
      ['KeyD', 'right'],
      ['Space', 'jump'],
      ['KeyF', 'dance'],
    ]),
    show_terrain: true,
    show_entities: true,
    show_terrain_collider: false,
    show_terrain_volume: false,
    show_entities_volume: false,
    show_entities_collider: false,
    volume_depth: 10,
    // if true, each frame will try to keep up to date each settings above
    // this can be useful when debugging but is ressource intensive
    debug_mode: DEBUG_MODE,
  },

  inputs: {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    dance: false,
  },
}

const GAME_MODULES = [
  ui_fps,
  ui_settings,
  window_resize,
  entity_add,
  player_inputs,
  player_movement,
  player_settings,
  game_lights,
  game_camera,
  game_map,
]

function last_event_value(emitter, event, default_value = null) {
  let value = default_value
  emitter.on(event, new_value => {
    value = new_value
  })
  return () => value
}

function create_context() {
  const scene = new Scene()

  // scene.background = new Color('#E0E0E0')
  scene.fog = new Fog(0x263238 / 2, 20, 70)

  const world = new World({ scene })
  const renderer = new WebGLRenderer({ antialias: true })

  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setClearColor(0x263238 / 2, 1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  renderer.outputEncoding = sRGBEncoding

  const camera = new PerspectiveCamera(
    75, // Field of view
    window.innerWidth / window.innerHeight, // Aspect ratio
    0.1, // Near clipping plane
    50, // Far clipping plane
  )

  camera.far = 100

  /** @type {Type.Events} */
  // @ts-ignore
  const events = new EventEmitter()
  const actions = new PassThrough({ objectMode: true })
  /** @type {() => State} */
  const get_state = last_event_value(events, 'STATE_UPDATED', INITIAL_STATE)
  return {
    world,
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
    scene,
    renderer,
    camera,
  }
}

export default async function create_game() {
  const { actions, ...context } = create_context()
  const { events, scene, renderer, get_state, camera, dispatch, world } =
    context

  const modules = GAME_MODULES.map(create => create({ renderer }))

  const packets = aiter(
    // @ts-ignore
    new ObjectArrayStream([
      { type: 'chunk_load', payload: [0, 0] },
      {
        type: 'light_add',
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
        type: 'light_add',
        payload: {
          type: 'hemisphere',
          color: '#ffffff',
          intensity: 0.7,
        },
      },
      {
        type: 'player_spawn',
        payload: [15, 10, 4],
      },
    ]),
  )

  modules
    .map(({ observe }) => observe)
    .filter(Boolean)
    .forEach(observe => observe(context))

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
        if (action.type.includes('update:')) {
          if (!FILTER_ACTION_IN_LOGS.includes(action.type)) {
            console.groupCollapsed(
              `%cinternal%c ${action.type.toUpperCase()}`,
              'background: #F57C00; color: white; padding: 2px 4px; border-radius: 2px',
              'font-weight: 800; color: #FFE082',
            )
            console.log(action.payload)
            console.groupEnd()
          }
        } else {
          console.groupCollapsed(
            `%cnetwork%c ${action.type.toUpperCase()}`,
            'background: #1E88E5; color: white; padding: 2px 4px; border-radius: 2px',
            'font-weight: 800; color: #BBDEFB',
          )
          console.log(action.payload)
          console.groupEnd()
        }
        events.emit(action.type, action.payload)
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

  function animation() {
    let frame_duration = 1000 / INITIAL_STATE.settings.target_fps
    let last_frame_time = performance.now()
    let { game_speed } = INITIAL_STATE.settings

    return function animate(current_time) {
      requestAnimationFrame(animate)

      const real_delta = current_time - last_frame_time
      const game_delta = real_delta * game_speed // Slow-motion effect on game logic

      if (real_delta >= frame_duration) {
        const state = get_state()
        const delta_seconds = game_delta / 1000

        world.step(state)
        modules
          .map(({ tick }) => tick)
          .filter(Boolean)
          .forEach(tick => tick(state, context, delta_seconds))

        renderer.render(scene, camera)

        last_frame_time = current_time - (real_delta % frame_duration)

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
    events,
    world,
    start(container) {
      container.appendChild(renderer.domElement)
      animation()(performance.now())
    },
    stop() {},
  }
}
