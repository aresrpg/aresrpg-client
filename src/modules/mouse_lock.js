/** @type {Type.Module} */
export default {
  observe({ lock_controls }) {
    window.addEventListener('click', () => {
      lock_controls.lock()
    })
  },
}
