const { VITE_KONAMI: vite_konami = 'false' } = import.meta.env

export const VITE_KONAMI = vite_konami === 'true'
