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
  type Packets = import('aresrpg-common/src/types').Packets
  type GameState = 'MENU' | 'GAME'

  type Entity = import('./world').Entity

  // Distributed actions which can be dispatched and then reduced
  type Actions = {
    'action/show_fps': boolean
    'action/target_fps': number
    'action/game_speed': number
    'action/show_terrain': boolean
    'action/show_entities': boolean
    'action/show_terrain_collider': boolean
    'action/show_entities_collider': boolean
    'action/show_terrain_volume': boolean
    'action/show_entities_volume': boolean
    'action/volume_depth': number
    'action/keydown': string
    'action/keyup': string
    'action/load_game_state': GameState
  } & Packets

  type Events = import('aresrpg-common/src/types').TypedEmitter<
    {
      STATE_UPDATED: State // the game state has been updated
      SHOW_CLASS_SELECTION: boolean // the class selection screen should be shown
      CONNECT_TO_SERVER: { name: string }
    } & Packets
  >

  type Action = {
    [K in keyof Actions]: { type: K; payload: Actions[K] }
  }[keyof Actions]
}
