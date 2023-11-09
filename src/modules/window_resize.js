/** @type {Type.Module} */
export default {
  observe({ renderer, camera }) {
    window.addEventListener('resize', ({ innerWidth, innerHeight }) => {
      renderer.setSize(innerWidth, innerHeight)
      camera.aspect = innerWidth / innerHeight
      camera.updateProjectionMatrix()
    })
  },
}
