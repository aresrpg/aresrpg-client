import { Vector3 } from 'three'

/** @type {Type.Module} */
export default {
  reduce(state, { type, payload }) {
    if (type === 'packet:ENTITY_MOVE') {
      const { id, position } = payload
      const [x, y, z] = position
      const entity = state.entities.get(id)

      entity.position.copy(new Vector3(x, y, z))
    }

    return state
  },
  observe({ events, get_state }) {
    events.on('FRAME', ({ state, delta }) => {
      const { entities } = state

      for (const entity of entities.values()) {
        const { physics } = entity

        if (physics) {
          const { body } = physics

          entity.position.copy(body.translation())
          entity.quaternion.copy(body.rotation())
        }
      }
    })
  },
}
