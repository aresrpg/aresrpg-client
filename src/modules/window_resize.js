/** @type {Type.Module} */
export default function () {
  return {
    observe({ renderer, camera }) {
      window.addEventListener('resize', () => {
        const { innerWidth, innerHeight } = window
        renderer.setSize(innerWidth, innerHeight)
        camera.aspect = innerWidth / innerHeight
        camera.updateProjectionMatrix()
      })
    },
  }
}
