const {
  VITE_KONAMI: vite_konami = 'false',
  VITE_WS_SERVER = 'ws://localhost:3000',
} = import.meta.env

export const VITE_KONAMI = vite_konami === 'true'

export { VITE_WS_SERVER }
