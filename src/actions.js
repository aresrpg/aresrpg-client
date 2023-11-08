export const Actions = {
  UI_FPS: 'ui_fps',
  KEY_DOWN: 'key_down',
  WINDOW_CLICK: 'click',
  WINDOW_RESIZE: 'window_resize',
  MOUSE_MOVE: 'mouse_move',
  MOUSE_WHEEL: 'mouse_wheel',
}

export const Packets = {
  ADD_LIGHT: 'add_light',
}

export function pop_actions(types, pending_actions) {
  if (!pending_actions.length) return types.map(() => []).concat([[]])

  const actions_by_type = types.map(type =>
    pending_actions
      .filter(action => action.type === type)
      .map(action => action.payload),
  )

  const remaining_actions = pending_actions.filter(
    action => !types.includes(action.type),
  )

  return [...actions_by_type, remaining_actions]
}

export const SERVER_STREAM = new ReadableStream({
  start(controller) {
    const socket = {}

    socket.onmessage = event => {
      try {
        const json = JSON.parse(event.data) // Parse the JSON string
        controller.enqueue(json) // Enqueue the parsed object for processing
      } catch (error) {
        console.error('Error parsing JSON:', error)
        controller.error(error) // Handle JSON parsing errors
      }
    }

    socket.onclose = () => controller.close()
    socket.onerror = error => {
      console.error('WebSocket error:', error)
      controller.error(error)
    }
  },
})

export const CLIENT_STREAM = new ReadableStream({
  start(controller) {
    const push = type => event => {
      console.log('client >', type, event)
      controller.enqueue({ type, payload: event })
    }

    const on_keydown = push(Actions.KEY_DOWN)
    const on_click = push(Actions.WINDOW_CLICK)
    const on_resize = push(Actions.WINDOW_RESIZE)
    const on_mouse_move = push(Actions.MOUSE_MOVE)
    const on_mouse_wheel = push(Actions.MOUSE_WHEEL)

    // Listen for events and pass them to the push function
    window.addEventListener('keydown', on_keydown)
    window.addEventListener('click', on_click)
    window.addEventListener('resize', on_resize)
    window.addEventListener('mousemove', on_mouse_move)
    window.addEventListener('wheel', on_mouse_wheel)

    // Provide a way to clean up the event listeners if the stream is cancelled
    this.cancel = () => {
      window.removeEventListener('keydown', on_keydown)
      window.removeEventListener('click', on_click)
      window.removeEventListener('resize', on_resize)
      window.removeEventListener('mousemove', on_mouse_move)
      window.removeEventListener('wheel', on_mouse_wheel)
    }
  },
})
