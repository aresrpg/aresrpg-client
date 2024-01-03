/** @type {Type.Module} */
export default function () {
  return {
    name: 'game_instanced',
    tick(_, { Pool }, delta) {
      Object.values(Pool).forEach(({ entity }) => entity().tick(delta))
    },
  }
}
