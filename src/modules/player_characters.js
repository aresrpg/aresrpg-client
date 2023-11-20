/** @type {Type.Module} */
export default function () {
  return {
    name: 'player_characters',
    reduce(state, { type, payload }) {
      if (type === 'packet/listCharactersResponse') {
        return {
          ...state,
          characters: payload.characters,
          characters_limit: payload.limit,
        }
      }
      return state
    },
  }
}
