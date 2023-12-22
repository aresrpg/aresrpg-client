import { on } from 'events'

import { aiter } from 'iterator-helper'

/** @type {Type.Module} */
export default function () {
  return {
    name: 'player_inputs',
    reduce(state, { type, payload }) {
      if (type === 'action/keydown' || type === 'action/keyup') {
        const enabled = type === 'action/keydown'
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
    observe({ dispatch, signal }) {
      // @ts-ignore
      aiter(on(window, 'keydown', { signal })).forEach(([{ code }]) =>
        dispatch('action/keydown', code),
      )
      // @ts-ignore
      aiter(on(window, 'keyup', { signal })).forEach(([{ code }]) =>
        dispatch('action/keyup', code),
      )
    },
  }
}
