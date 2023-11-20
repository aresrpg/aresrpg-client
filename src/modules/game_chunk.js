/** @type {Type.Module} */
export default function () {
  return {
    name: 'game_chunk',
    observe({ scene, events, world, signal }) {
      events.on('packet/chunkLoad', ({ position: { x, z } }) => {
        world.load_chunk(x, z, signal)
      })
    },
  }
}
