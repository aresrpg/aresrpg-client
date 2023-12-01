const {
  VITE_KONAMI: vite_konami = 'false',
  VITE_WS = 'ws://localhost:3002',
  VITE_API = 'http://localhost:3001',
} = import.meta.env

export const VITE_KONAMI = vite_konami === 'true'

export { VITE_WS, VITE_API }
