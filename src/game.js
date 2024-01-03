import { EventEmitter } from 'events'
import { PassThrough } from 'stream'

import {
  Scene,
  Vector3,
  Color,
  WebGLRenderer,
  PerspectiveCamera,
  Fog,
  SRGBColorSpace,
  VSMShadowMap,
  DefaultLoadingManager,
  ACESFilmicToneMapping,
  Vector2,
  Vector4,
  Quaternion,
  Matrix4,
  Spherical,
  Box3,
  Sphere,
  Raycaster,
  OrthographicCamera,
  Clock,
} from 'three'
import { aiter } from 'iterator-helper'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import CameraControls from 'camera-controls'

import { combine } from './utils/iterator.js'
import ui_fps from './modules/ui_fps.js'
import game_camera from './modules/game_camera.js'
import game_render from './modules/game_render.js'
import window_resize from './modules/window_resize.js'
import player_inputs from './modules/player_inputs.js'
import player_movement from './modules/player_movement.js'
import ui_settings from './modules/ui_settings.js'
import player_settings from './modules/player_settings.js'
import create_modules_loader from './modules_loader.js'
import game_cache from './modules/game_cache.js'
import main_menu from './modules/main_menu.js'
import logger from './utils/logger.js'
import game_sky from './modules/game_sky.js'
import game_connect from './modules/game_connect.js'
import player_characters from './modules/player_characters.js'
import create_pools from './pool.js'
import game_lights from './modules/game_lights.js'
import game_portal from './modules/game_portal.js'
import create_shared_state from './shared_state.js'
import game_audio from './modules/game_audio.js'
import game_entities from './modules/game_entities.js'
import game_chunks from './modules/game_chunks.js'
import player_spawn from './modules/player_spawn.js'
import game_instanced from './modules/game_instanced.js'
import TaskManager from './utils/TaskManager.js'

export const GRAVITY = 9.81

const DEBUG_MODE = true
const LOADING_MANAGER = DefaultLoadingManager
const FILTER_ACTION_IN_LOGS = [
  'action/keydown',
  'action/keyup',
  'action/set_state_player_position',
]
export const FILTER_PACKET_IN_LOGS = [
  'packet/playerPosition',
  'packet/entityMove',
]

export const TASK_MANAGER = new TaskManager()

LOADING_MANAGER.onStart = (url, itemsLoaded, itemsTotal) => {
  window.dispatchEvent(new Event('assets_loading'))
  logger.ASSET(`Loading asset ${url}`, { itemsLoaded, itemsTotal })
}

LOADING_MANAGER.onLoad = () => {
  logger.ASSET('All assets loaded')
  window.dispatchEvent(new Event('assets_loaded'))
}

/** @typedef {typeof INITIAL_STATE} State */
/** @typedef {Omit<Readonly<Awaited<ReturnType<typeof create_context>>>, 'actions'>} Context */
/** @typedef {(state: State, action: Type.Action) => State} Reducer */
/** @typedef {(context: Context) => void} Observer */
/** @typedef {(state: State, context: Context, delta: number) => void} Ticker */
/** @typedef {(shared: Context['shared']) => { name: string, reduce?: Reducer, observe?: Observer, tick?: Ticker }} Module */
/** @typedef {import("three").AnimationAction} AnimAction */

export const INITIAL_STATE = {
  /** @type {Type.GameState} */
  game_state: 'MENU',
  settings: {
    target_fps: 120,
    mouse_sensitivity: 0.005,
    show_fps: true,
    keymap: new Map([
      ['KeyW', 'forward'],
      ['KeyS', 'backward'],
      ['KeyA', 'left'],
      ['KeyD', 'right'],
      ['Space', 'jump'],
      ['KeyF', 'dance'],
      ['ShiftLeft', 'walk'],
    ]),
    show_terrain: true,
    show_terrain_collider: false,
    show_entities_collider: false,
    show_navmesh: false,

    view_distance: 3,
    far_view_distance: 20,
    show_chunk_border: false,

    free_camera: false,

    // if true, each frame will try to keep up to date each settings above
    // this can be useful when debugging but is ressource intensive
    debug_mode: DEBUG_MODE,
  },

  inputs: {
    forward: false,
    backward: false,
    left: false,
    right: false,
    walk: false,
    jump: false,
    dance: false,
  },

  world: {
    seed: '',
    /** @type {(x: number, z: number) => number} */
    heightfield: null,
  },

  /** @type {Type.Entity} */
  player: null,
  selected_character_id: null,
  characters_limit: 3,
  characters: [
    {
      id: 'some-id',
      name: 'some-name',
      level: 1,
    },
  ],
}

CameraControls.install({
  THREE: {
    Vector2,
    Vector3,
    Vector4,
    Quaternion,
    Matrix4,
    Spherical,
    Box3,
    Sphere,
    Raycaster,
  },
})

const PERMANENT_MODULES = [
  // might need to stay first
  game_cache,

  ui_fps,
  window_resize,
  player_inputs,
  player_settings,
  game_sky,
  game_connect,
  player_characters,
  game_render,
  game_lights,
  game_instanced,
]

const GAME_MODULES = {
  MENU: [main_menu],
  GAME: [
    ui_settings,
    player_movement,
    player_spawn,
    game_camera,
    game_audio,
    game_entities,
    game_chunks,
    // game_portal,
  ],
}

function last_event_value(emitter, event, default_value = null) {
  let value = default_value
  emitter.on(event, new_value => {
    value = new_value
  })
  return () => value
}

async function create_context({ send_packet, connect_ws }) {
  const scene = new Scene()
  scene.background = new Color('#E0E0E0')
  scene.fog = new Fog('#E0E0E0', 0, 1500)

  const renderer = new WebGLRenderer({ antialias: true })

  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setClearColor(0x263238 / 2, 1)
  renderer.shadowMap.enabled = true
  renderer.outputColorSpace = SRGBColorSpace
  // renderer.shadowMap.type = VSMShadowMap
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = Math.pow(0.9, 5.0)
  renderer.info.autoReset = false

  const composer = new EffectComposer(renderer)
  composer.setSize(window.innerWidth, window.innerHeight)

  const camera = new PerspectiveCamera(
    60, // Field of view
    window.innerWidth / window.innerHeight, // Aspect ratio
    0.1, // Near clipping plane
    1500, // Far clipping plane
  )

  const shared = create_shared_state({ scene, camera })

  const Pool = create_pools({ scene, shared })
  const orthographic_camera = new OrthographicCamera()

  /** @type {Type.Events} */
  // @ts-ignore
  const events = new EventEmitter()
  const actions = new PassThrough({ objectMode: true })
  /** @type {() => State} */
  const get_state = last_event_value(events, 'STATE_UPDATED', INITIAL_STATE)
  return {
    events,
    actions,
    Pool,
    composer,
    shared,
    camera_controls: new CameraControls(camera, renderer.domElement),
    /** @type {import("@aresrpg/aresrpg-protocol/src/types").create_client['send']} */
    send_packet,
    /** @type {() => Promise<void>} */
    connect_ws,
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
    orthographic_camera,
    camera,
    /** @type {AbortSignal} */
    signal: new AbortController().signal,
  }
}

export default async function create_game({
  packets,
  send_packet,
  connect_ws,
}) {
  const { actions, ...context } = await create_context({
    send_packet,
    connect_ws,
  })
  const {
    events,
    scene,
    camera,
    renderer,
    get_state,
    dispatch,
    composer,
    shared,
  } = context

  const permanent_modules = PERMANENT_MODULES.map(create => create(shared))
  const game_modules = Object.fromEntries(
    Object.entries(GAME_MODULES).map(([key, modules]) => [
      key,
      modules.map(create => create(shared)),
    ]),
  )
  const modules_loader = create_modules_loader({ modules: game_modules })

  permanent_modules
    .map(({ observe }) => observe)
    .filter(Boolean)
    .forEach(observe => observe(context))

  modules_loader.observe(context)

  const combined_modules = [
    modules_loader,
    ...permanent_modules,
    ...new Set(Object.values(game_modules).flat()).values(),
  ]

  // pipe the actions and packets through the reducers
  aiter(combine(actions, packets))
    .reduce(
      (last_state, /** @type {Type.Action} */ action) => {
        const state = combined_modules
          .map(({ reduce }) => reduce)
          .filter(Boolean)
          .reduce((intermediate, fn) => {
            const result = fn(intermediate, action)
            if (!result) throw new Error(`Reducer ${fn} didn't return a state`)
            return result
          }, last_state)
        if (action.type.includes('action/')) {
          if (!FILTER_ACTION_IN_LOGS.includes(action.type))
            logger.INTERNAL(action.type, action.payload)
        } else if (!FILTER_PACKET_IN_LOGS.includes(action.type))
          logger.NETWORK_IN(action.type, action.payload)
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

  dispatch('action/load_game_state', 'MENU')

  const clock = new Clock()
  let frame_duration = 1000 / INITIAL_STATE.settings.target_fps
  let time_target = 0

  function animate() {
    requestAnimationFrame(animate)

    if (performance.now() >= time_target) {
      const state = get_state()
      const delta = Math.min(clock.getDelta(), 0.5)

      permanent_modules
        .map(({ tick }) => tick)
        .filter(Boolean)
        .forEach(tick => tick(state, context, delta))

      modules_loader.tick(state, context, delta)

      renderer.info.reset()
      // renderer.render(scene, camera)
      composer.render()

      TASK_MANAGER.tick(time_target + frame_duration - performance.now())

      const next_frame_duration = 1000 / state.settings.target_fps

      if (frame_duration !== next_frame_duration)
        frame_duration = next_frame_duration

      time_target += frame_duration
      if (performance.now() >= time_target) time_target = performance.now()
    }
  }

  return {
    events,
    dispatch,
    send_packet,
    start(container) {
      container.appendChild(renderer.domElement)
      animate()
    },
    stop() {},
  }
}
