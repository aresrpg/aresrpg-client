declare module '*.ogg'
declare module '*.png'
declare module '*.jpg'
declare module '*.gltf?url'
declare module '*.fbx?url'
declare module '*.glsl?url'

declare module 'stream' {
  class PassThrough {
    constructor(options?: any)
    write(chunk: any): void
  }
}

declare module 'three/addons/capabilities/WebGL.js' {
  function isWebGLAvailable(): boolean
}

declare namespace Type {
  type Module = import('./game').Module
  type State = import('./game').State
  type Packets = import('aresrpg-protocol/src/types').Packets
  type GameState = 'MENU' | 'GAME' | 'EDITOR'

  type Entity = {
    id: string
    title: import('troika-three-text').Text
    three_body: import('three').Object3D
    height: number
    radius: number
    position: () => import('three').Vector3
    target_position: import('three').Vector3
    move: (vector: import('three').Vector3) => void
    rotate: (vector: import('three').Vector3) => void
    animate: () => void
    remove: () => void
  }

  // Distributed actions which can be dispatched and then reduced
  type Actions = {
    'action/show_fps': boolean
    'action/target_fps': number
    'action/game_speed': number
    'action/show_terrain': boolean
    'action/show_entities': boolean
    'action/show_terrain_collider': boolean
    'action/show_entities_collider': boolean
    'action/keydown': string
    'action/keyup': string
    'action/load_game_state': GameState
    'action/register_player': Entity
    'action/select_character': string
    'action/view_distance': number
    'action/far_view_distance': number
    'action/biome_settings': {
      scale: number
      height: number
      octaves: number
      persistance: number
      lacunarity: number
      exponentiation: number
    }
    'action/show_chunk_border': boolean
    'action/free_camera': boolean
    'action/navmesh_settings': {
      cell_size: number
      cell_height: number
      walkable_slope_angle: number
      walkable_radius: number
      walkable_climb: number
      walkable_height: number
      min_region_area: number
    }
    'action/show_navmesh': boolean
  } & Packets

  type Events = import('aresrpg-protocol/src/types').TypedEmitter<
    {
      STATE_UPDATED: State // the game state has been updated
      MOVE_MENU_CAMERA: [number, number, number] // move the camera of the menu screen
      CONNECT_TO_SERVER: void // request ws connection to the server
      CHANGE_CHUNK: { x: number; z: number } // change the current chunk
      SET_TIME: number // set the time of the day
      TIME_CHANGE: number // the time of the day has changed
      CLEAR_CHUNKS: void // clear all chunks
      CHUNKS_LOADED: void // notify that the loading of new chunks is finished
    } & Packets
  >

  type Action = {
    [K in keyof Actions]: { type: K; payload: Actions[K] }
  }[keyof Actions]
}
