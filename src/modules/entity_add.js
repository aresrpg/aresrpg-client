import { Vector3 } from 'three'

import Pool from '../pool.js'
import { PLAYER_ID } from '../game.js'

/** @type {Type.Module} */
export default {
  reduce(state, { type, payload }) {
    if (type === 'ENTITY_ADD') {
      const { id, ...entity } = payload

      if (id === PLAYER_ID)
        return {
          ...state,
          player: {
            id,
            ...entity,
          },
        }

      state.entities.set(id, entity)
    }
    return state
  },
  observe({ events, get_state, scene, world, dispatch }) {
    events.on('packet:ENTITY_ADD', ({ id, type, position }) => {
      if (type === 'character') {
        const [x, y, z] = position
        const pooled_entity = Pool.guard.get(world)

        if (!pooled_entity) return

        const entity = {
          id,
          type,
          position: new Vector3(x, y, z),
          on_ground: false,
          ...pooled_entity,
        }

        entity.move(entity.position)
        scene.add(entity.model)
        dispatch('ENTITY_ADD', entity)
      }
    })
  },
}
