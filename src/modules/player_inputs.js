import { on } from 'events'

import { aiter } from 'iterator-helper'

/** @type {Type.Module} */
export default function () {
  return {
    reduce(state, { type, payload }) {
      if (type === 'update:keydown' || type === 'update:keyup') {
        const enabled = type === 'update:keydown'
        const { inputs, settings } = state
        const key_role = settings.keymap.get(payload)

        if (key_role) inputs[key_role] = enabled

        return {
          ...state,
          inputs,
        }
      }
      return state
    },
    observe({ dispatch }) {
      aiter(on(window, 'keydown')).forEach(({ code }) =>
        dispatch('update:keydown', code),
      )
      aiter(on(window, 'keyup')).forEach(({ code }) =>
        dispatch('update:keyup', code),
      )
    },
  }
}
