import { DirectionalLight, AmbientLight } from 'three'

function create_light(type, settings) {
  switch (type) {
    case 'directional': {
      const light = new DirectionalLight(settings.color, settings.intensity)
      light.position.set(
        settings.position.x,
        settings.position.y,
        settings.position.z,
      )
      light.castShadow = settings.shadow
      light.shadow.camera.top = settings.shadow_camera.top
      light.shadow.camera.bottom = settings.shadow_camera.bottom
      light.shadow.camera.left = settings.shadow_camera.left
      light.shadow.camera.right = settings.shadow_camera.right
      light.shadow.camera.near = settings.shadow_camera.near
      light.shadow.camera.far = settings.shadow_camera.far
      light.shadow.mapSize.width = settings.shadow_camera.map_size.width
      light.shadow.mapSize.height = settings.shadow_camera.map_size.height
      return light
    }
    case 'ambient':
      return new AmbientLight(settings.color, settings.intensity)
  }
}

/** @type {Type.Module} */
export default {
  observe({ events, scene, get_state }) {
    events.on('packet:LIGHT_ADD', ({ type, ...settings }) => {
      const light = create_light(type, settings)
      scene.add(light)
    })
  },
}
