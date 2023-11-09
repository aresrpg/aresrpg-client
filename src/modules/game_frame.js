export default {
  observe({ events, world, camera, scene, renderer }) {
    events.on('FRAME', () => {
      world.step()
      renderer.render(scene, camera)
    })
  },
}
