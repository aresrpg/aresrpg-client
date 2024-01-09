/** @type {Type.Module} */
export default function ({ outline }) {
  let player = null
  return {
    name: 'player_spawn',
    reduce(state, { type, payload }) {
      if (type === 'action/register_player')
        return { ...state, player: payload }
      return state
    },
    tick(_, __, delta) {
      if (player) player.mixer.update(delta)
    },
    observe({ events, Pool, dispatch, signal, send_packet }) {
      events.once('STATE_UPDATED', ({ selected_character_id, characters }) => {
        const selected_character = characters.find(
          ({ id }) => id === selected_character_id,
        )

        const { classe, female, name } = selected_character

        player = Pool.character({ classe, female }).get_non_instanced(outline)

        player.title.text = name

        dispatch('action/register_player', player)

        setTimeout(() => {
          // notify the server that we are ready to receive chunks and more
          send_packet('packet/joinGameReady', {})
        }, 10)

        signal.addEventListener('abort', () => {
          player.remove()
          dispatch('action/register_player', null)
        })
      })
    },
  }
}
