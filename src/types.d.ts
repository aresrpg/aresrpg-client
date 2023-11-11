type EventMap = Record<string, any>

type EventName<T extends EventMap> = string & keyof T
type EventListener<T> = (arg: T) => void

interface TypedEmitter<T extends EventMap> {
  on<K extends EventName<T>>(eventName: K, listener: EventListener<T[K]>): this
  on(eventName: string | symbol, listener: (arg: any) => void): this

  once<K extends EventName<T>>(
    eventName: K,
    listener: EventListener<T[K]>,
  ): this
  once(eventName: string | symbol, listener: (arg: any) => void): this

  off<K extends EventName<T>>(eventName: K, listener: EventListener<T[K]>): this
  off(eventName: string | symbol, listener: (arg: any) => void): this

  removeListener<K extends EventName<T>>(
    eventName: K,
    listener: EventListener<T[K]>,
  ): this
  removeListener(eventName: string | symbol, listener: (arg: any) => void): this

  emit<K extends EventName<T>>(eventName: K, arg: T[K]): boolean
  emit(eventName: string | symbol, arg: any): boolean

  setMaxListeners(number): this
  removeAllListeners(): this
}

declare module 'stream' {
  class PassThrough {
    constructor(options?: any)
    write(chunk: any): void
  }
}

declare module 'events' {
  interface StaticEventEmitterOptions {
    signal?: AbortSignal | undefined
  }

  function on(
    emitter: NodeJS.EventEmitter | EventTarget,
    eventName: string,
    options?: StaticEventEmitterOptions,
  ): AsyncIterableIterator<any>
  function on<T, K extends EventName<T>>(
    emitter: TypedEmitter<T> | EventTarget,
    eventName: K,
    options?: StaticEventEmitterOptions,
  ): AsyncIterableIterator<[T[K]]>
  function on<T>(
    emitter: TypedEmitter<T> | EventTarget,
    eventName: string,
    options?: StaticEventEmitterOptions,
  ): AsyncIterableIterator<any>

  class EventEmitter {
    static on(
      emitter: NodeJS.EventEmitter,
      eventName: string,
      options?: StaticEventEmitterOptions,
    ): AsyncIterableIterator<any>

    static on<T, K extends EventName<T>>(
      emitter: TypedEmitter<T>,
      eventName: K,
      options?: StaticEventEmitterOptions,
    ): AsyncIterableIterator<[T[K]]>

    static on<T>(
      emitter: TypedEmitter<T>,
      eventName: string,
      options?: StaticEventEmitterOptions,
    ): AsyncIterableIterator<any>
  }
}

type State = import('./src/game').State

declare namespace Type {
  type Module = import('./game').Module

  type Packets = {
    'packet:LIGHT_ADD': { type: string; [key: string]: any }
    'packet:ENTITY_ADD': {
      id: string
      type: string
      position: [number, number, number]
      [key: string]: any
    }
    'packet:ENTITY_ATTACH': {
      id: string
      parent: string
      offset: [number, number, number]
    }
    'packet:ENTITY_MOVE': { id: string; position: [number, number, number] }
  }

  type Entity = import('three').Group<import('three').Object3DEventMap>

  // Distributed actions which can be dispatched and then reduced
  type Actions = {
    SHOW_FPS: boolean
    ENTITY_ADD: {
      id: string
      type: string
      position: import('three').Vector3
      [key: string]: any
    }
    SHOW_BOUNDING_BOXES: boolean
    KEYDOWN: string
    KEYUP: string
    PLAYER_MOVED: import('three').Vector3
  } & Packets

  type Events = TypedEmitter<
    {
      STATE_UPDATED: State // the game state has been updated
      FRAME: { delta: number; state: State }
    } & Packets
  >

  type Dispatcher<T extends EventMap, K extends EventName<T>> = (
    type: K,
    payload: T[K],
  ) => void

  type Action = {
    [K in keyof Actions]: { type: K; payload: Actions[K] }
  }[keyof Actions]
}
