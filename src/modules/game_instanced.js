/** @type {Type.Module} */
export default function () {
  return {
    name: 'game_instanced',
    tick(_, { Pool }, delta) {
      Object.values(Pool).forEach(value => {
        if (typeof value === 'function') return
        value.instanced_entity.entity.tick(delta)
      })
    },
  }
}
