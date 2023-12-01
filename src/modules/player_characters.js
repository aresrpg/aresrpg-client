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
      if (type === 'action/select_character') {
        return {
          ...state,
          selected_character_id: payload,
        }
      }
      return state
    },
  }
}
