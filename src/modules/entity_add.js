import { Vector3 } from 'three'

import { create_capsule, create_character } from '../utils/entities.js'

/** @type {Type.Module} */
export default {
  reduce(state, { type, payload }) {
    if (type === 'ENTITY_ADD') {
      const { id, type, model, physics, size } = payload

      if (id === 'player')
        return {
          ...state,
          player: {
            model,
            physics,
            size,
          },
        }

      state.entities.set(id, {
        id,
        type,
        model,
        physics,
        size,
      })
    }
    return state
  },
  observe({ events, get_state, scene, world, dispatch }) {
    events.on('packet:ENTITY_ADD', ({ id, type, position }) => {
      if (type === 'character') {
        const [x, y, z] = position
        create_character({
          world,
          position: new Vector3(x, y, z),
        })
          .then(({ model, rigid_body, collider, height, radius }) => {
            const entity = {
              id,
              type,
              model,
              physics: {
                rigid_body,
                collider,
              },
              height,
              radius,
            }

            scene.add(model)
            dispatch('ENTITY_ADD', entity)
          })
          .catch(error => {
            console.error(error)
          })
      }
    })
  },
}
