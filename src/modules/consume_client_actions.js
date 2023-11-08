import { CLIENT_STREAM } from '../actions.js'

/** @type {import("../game").Module} */
export default function consume_client_actions() {
  const buffer = new Set()

  async function read_stream() {
    const reader = CLIENT_STREAM.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break // If the stream is closed, exit the loop
      buffer.add(value) // Add the action to the buffer
    }
  }
  // Start reading from the client stream immediately
  read_stream()

  return (state, delta) => {
    // Combine the actions from the buffer with the current state's pending actions
    const combined = [...state.pending_client_actions, ...buffer.values()]
    buffer.clear() // Clear the buffer after combining

    return {
      ...state,
      pending_client_actions: combined,
    }
  }
}
