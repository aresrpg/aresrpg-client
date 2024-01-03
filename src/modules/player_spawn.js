/** @type {Type.Module} */
export default function () {
  return {
    name: 'player_spawn',
    reduce(state, { type, payload }) {
      if (type === 'action/register_player') {
        return {
          ...state,
          player: payload,
        }
      }
      return state
    },
    observe({ events, Pool, dispatch, signal }) {
      events.once('STATE_UPDATED', ({ selected_character_id, characters }) => {
        const player = Pool.iop_male.get({
          id: 'player',
          fixed_title_aspect: true,
          collider: true,
        })

        const selected_character = characters.find(
          ({ id }) => id === selected_character_id,
        )

        player.title.text = selected_character.name

        dispatch('action/register_player', player)

        signal.addEventListener('abort', () => {
          player.remove()
          dispatch('action/register_player', null)
        })
      })
    },
  }
}
