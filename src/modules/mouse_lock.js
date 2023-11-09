/** @type {Type.Module} */
export default function () {
  return {
    observe({ lock_controls }) {
      window.addEventListener('click', () => {
        lock_controls.lock()
      })
    },
  }
}
