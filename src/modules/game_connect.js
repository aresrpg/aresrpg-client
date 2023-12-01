import toast from '../toast'

/** @type {Type.Module} */
export default function () {
  return {
    name: 'game_connect',
    observe({ events, connect_ws, signal, send_packet, dispatch, get_state }) {
      events.on('CONNECT_TO_SERVER', () => {
        connect_ws().catch(error => {
          console.error(error)
        })
      })

      events.on('packet/connectionSuccess', () => {
        toast.success('Successfully connected to AresRPG', 'Socket')
        const { game_state, selected_character_id } = get_state()

        if (game_state === 'MENU') send_packet('packet/listCharacters', {})
        else if (game_state === 'GAME')
          send_packet('packet/selectCharacter', { id: selected_character_id })
      })

      events.on('packet/joinGame', () => {
        const { game_state } = get_state()

        // if the player is already in the game, we don't need to join it again
        // this can happen if the server restarts while the player is in the game
        if (game_state === 'GAME') send_packet('packet/joinGameReady', {})
        else dispatch('action/load_game_state', 'GAME')
      })
    },
  }
}
