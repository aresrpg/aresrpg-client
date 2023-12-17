import { EventEmitter, on } from 'events'
import { PassThrough } from 'stream'

import {
  Scene,
  Vector3,
  Color,
  WebGLRenderer,
  PerspectiveCamera,
  Fog,
  AnimationAction,
  SRGBColorSpace,
  VSMShadowMap,
  DefaultLoadingManager,
  ACESFilmicToneMapping,
  FogExp2,
  Vector2,
  Vector4,
  Quaternion,
  Matrix4,
  Spherical,
  Box3,
  Sphere,
  Raycaster,
  OrthographicCamera,
} from 'three'
import merge from 'fast-merge-async-iterators'
import { aiter } from 'iterator-helper'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { World } from '@dimforge/rapier3d'
import CameraControls from 'camera-controls'
import { init as init_recast_navigation } from 'recast-navigation'

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
import game_world from './modules/game_world.js'
import create_pools from './pool.js'
import game_nature from './modules/game_nature.js'
import Biomes from './world_gen/biomes.js'

export const GRAVITY = 9.81
export const PLAYER_ID = 'player'

await init_recast_navigation()

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
/** @typedef {(module_params: {world?: World, modules?: any}) => { name: string, reduce?: Reducer, observe?: Observer, tick?: Ticker }} Module */
/** @typedef {import("three").AnimationAction} AnimAction */

export const INITIAL_STATE = {
  /** @type {Type.GameState} */
  game_state: 'MENU',
  settings: {
    target_fps: 120,
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
    show_entities_collider: false,
    show_navmesh: false,

    // view_distance: 10,
    // far_view_distance: 35,
    view_distance: 3,
    far_view_distance: 5,
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
    jump: false,
    dance: false,
  },

  world: {
    seed: 'aresrpg',
    biome: { ...Biomes.DEFAULT },
    navmesh: {
      cell_size: 0.2,
      cell_height: 0.2,
      walkable_slope_angle: 45,
      walkable_radius: 0.5,
      walkable_climb: 2,
      walkable_height: 2,
      min_region_area: 12,
    },
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
  game_nature,
]

const GAME_MODULES = {
  MENU: [main_menu],
  GAME: [ui_settings, player_movement, game_camera, game_world],
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
  const world = new World(new Vector3(0, -GRAVITY, 0))
  scene.background = new Color('#E0E0E0')
  scene.fog = new Fog('#E0E0E0', 0, 1500)

  const renderer = new WebGLRenderer()

  const Pool = await create_pools({ scene, world })

  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setClearColor(0x263238 / 2, 1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = VSMShadowMap
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping

  const composer = new EffectComposer(renderer)
  composer.setSize(window.innerWidth, window.innerHeight)

  const camera = new PerspectiveCamera(
    60, // Field of view
    window.innerWidth / window.innerHeight, // Aspect ratio
    0.1, // Near clipping plane
    2000, // Far clipping plane
  )

  const orthographic_camera = new OrthographicCamera()

  camera.far = 2000

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
    camera_controls: new CameraControls(camera, renderer.domElement),
    /** @type {import("aresrpg-protocol/src/types").create_client['send']} */
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
    world,
    /** @type {AbortSignal} */
    signal: new AbortController().signal,
    navigation: {
      /** @type {import('recast-navigation').NavMesh} */
      navmesh: null,
      /** @type {import('recast-navigation').NavMeshQuery} */
      navmesh_query: null,
    },
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
    world,
    scene,
    renderer,
    get_state,
    camera,
    dispatch,
    composer,
  } = context

  const permanent_modules = PERMANENT_MODULES.map(create => create({ world }))
  const game_modules = Object.fromEntries(
    Object.entries(GAME_MODULES).map(([key, modules]) => [
      key,
      modules.map(create => create({ world })),
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

        world.step()

        permanent_modules
          .map(({ tick }) => tick)
          .filter(Boolean)
          .forEach(tick => tick(state, context, delta_seconds))

        modules_loader.tick(state, context, delta_seconds)
        // renderer.render(scene, camera)
        composer.render()

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
    dispatch,
    send_packet,
    start(container) {
      container.appendChild(renderer.domElement)
      animation()(performance.now())
    },
    stop() {},
  }
}
