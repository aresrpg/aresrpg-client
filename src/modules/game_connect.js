/** @type {Type.Module} */
export default function () {
  return {
    name: 'game_connect',
    observe({ events, connect_ws, signal, send_packet }) {
      events.once('CONNECT_TO_SERVER', ({ name }) => {
        connect_ws()
          .then(() => {
            send_packet('packet/connectionRequest', { name })
          })
          .catch(error => {
            console.error(error)
          })
      })
    },
  }
}
