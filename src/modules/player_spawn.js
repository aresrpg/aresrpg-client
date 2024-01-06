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
        const selected_character = characters.find(
          ({ id }) => id === selected_character_id,
        )

        const { classe, female, name, id } = selected_character

        const player = Pool.character({ classe, female }).get({
          id,
          fixed_title_aspect: true,
          collider: true,
        })

        player.title.text = name

        dispatch('action/register_player', player)

        signal.addEventListener('abort', () => {
          player.remove()
          dispatch('action/register_player', null)
        })
      })
    },
  }
}
