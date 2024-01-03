import { on } from 'events'

import { aiter, iter } from 'iterator-helper'

import logger from './utils/logger'

function modules_difference(from, to) {
  return from.filter(
    ({ name: from_name }) =>
      !to.some(({ name: to_name }) => from_name === to_name),
  )
}

const ADD_FUNCTIONS = [
  'on',
  'once',
  'addListener',
  'prependListener',
  'prependOnceListener',
]

function is_event_target(emitter) {
  return emitter && !!emitter.addEventListener
}

function events_interceptor(emitter) {
  let listener_array = []

  return new Proxy(emitter, {
    get: function (target, property, receiver) {
      const original_property = Reflect.get(target, property, receiver)

      const add_functions = is_event_target(emitter)
        ? [...ADD_FUNCTIONS, 'addEventListener']
        : ADD_FUNCTIONS

      if (typeof property === 'string' && add_functions.includes(property)) {
        return function (event_name, listener) {
          listener_array.push({ event_name, listener })
          return original_property.call(target, event_name, listener)
        }
      }

      if (property === 'remove_all_intercepted_listeners') {
        return function () {
          listener_array.forEach(({ event_name, listener }) => {
            const remove_method = is_event_target(emitter)
              ? 'removeEventListener'
              : 'off'
            target[remove_method](event_name, listener)
          })
          listener_array = [] // Reset the array
        }
      }

      return original_property
    },
  })
}

export default function ({ modules }) {
  let game_state = null
  const loaded_modules = new Set()

  return {
    name: 'modules_loader',
    tick(state, context, delta_seconds) {
      for (const module of loaded_modules) {
        if (module.tick) module.tick(state, context, delta_seconds)
      }
    },
    reduce(state, { type, payload }) {
      if (type === 'action/load_game_state')
        return { ...state, game_state: payload }
      return state
    },
    // this module allows the player to enable and disable other modules
    observe({ events, ...context }) {
      // when we receive a STATE_UPDATED event, we need to enable or disable modules
      aiter(on(events, 'STATE_UPDATED'))
        .map(([{ game_state: new_game_state }]) => new_game_state)
        .forEach(async new_game_state => {
          if (game_state !== new_game_state) {
            game_state = new_game_state // Update the game state
            const next_modules = modules[game_state] ?? []

            // Determine which modules to load and unload
            const modules_to_load = new Set(
              next_modules.filter(m => !loaded_modules.has(m)),
            )
            const modules_to_unload = new Set(
              [...loaded_modules].filter(m => !next_modules.includes(m)),
            )

            // Unload modules
            for (const module of modules_to_unload) {
              if (module.observe) {
                logger.CORE(`Unloading module ${module.name}`)
                module.controller.abort()
                loaded_modules.delete(module)
              }
            }

            // Load modules
            for (const module of modules_to_load) {
              if (module.observe) {
                logger.CORE(`Loading module ${module.name}`)

                // Create a new controller for the module
                const controller = new AbortController()
                const proxied_events = events_interceptor(events)

                // When the local controller is aborted (which means the module was unloaded)
                controller.signal.addEventListener(
                  'abort',
                  () => {
                    proxied_events.remove_all_intercepted_listeners()
                  },
                  { once: true },
                )

                await module.observe({
                  ...context,
                  events: proxied_events,
                  signal: controller.signal,
                })

                // Add the module with its controller to the loaded_modules
                loaded_modules.add({
                  ...module,
                  controller,
                })
              }
            }
          }
        })
    },
  }
}
