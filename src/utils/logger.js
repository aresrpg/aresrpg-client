function logger({ header, strong, light }) {
  return (message, payload) => {
    if (payload) {
      console.groupCollapsed(
        `%c${header}%c ${message}`,
        `background: ${strong}; color: white; padding: 2px 4px; border-radius: 2px`,
        `font-weight: 800; color: ${light}`,
      )
      console.log(payload)
      console.groupEnd()
    } else {
      console.log(
        `%c${header}%c ${message}`,
        `background: ${strong}; color: white; padding: 2px 4px; border-radius: 2px`,
        `font-weight: 800; color: ${light}`,
      )
    }
  }
}

export default {
  INTERNAL: logger({
    header: 'internal',
    strong: '#FF9800',
    light: '#FFCC80',
  }),
  NETWORK_IN: logger({
    header: 'in ↙️',
    strong: '#2196F3',
    light: '#90CAF9',
  }),
  NETWORK_OUT: logger({
    header: 'out ↗️',
    strong: '#3F51B5',
    light: '#9FA8DA',
  }),
  SOCKET: logger({
    header: 'socket',
    strong: '#9C27B0',
    light: '#CE93D8',
  }),
  CORE: logger({
    header: 'core',
    strong: '#4CAF50',
    light: '#A5D6A7',
  }),
  ASSET: logger({
    header: 'asset',
    strong: '#F44336',
    light: '#EF9A9A',
  }),
}
