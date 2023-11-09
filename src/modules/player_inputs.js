import { on } from 'events'

import { aiter } from 'iterator-helper'

/** @type {Type.Module} */
export default {
  reduce(state, { type, payload }) {
    if (type === 'KEYDOWN' || type === 'KEYUP') {
      const enabled = type === 'KEYDOWN'
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
      dispatch('KEYDOWN', code),
    )
    aiter(on(window, 'keyup')).forEach(({ code }) => dispatch('KEYUP', code))
  },
}
