/** @type {Type.Module} */
export default function () {
  return {
    name: 'window_resize',
    observe({ renderer, camera, signal, composer }) {
      window.addEventListener(
        'resize',
        () => {
          const { innerWidth, innerHeight } = window
          renderer.setSize(innerWidth, innerHeight)
          camera.aspect = innerWidth / innerHeight
          camera.updateProjectionMatrix()
          composer.setSize(innerWidth, innerHeight)
        },
        { signal },
      )
    },
  }
}
