import { DirectionalLight, AmbientLight, HemisphereLight } from 'three'

function create_light(type, settings) {
  switch (type) {
    case 'directional': {
      const light = new DirectionalLight(0xffffff, 3)
      light.position.set(1, 1.5, 1).multiplyScalar(50)
      light.shadow.mapSize.setScalar(2048)
      light.shadow.bias = -1e-4
      light.shadow.normalBias = 0.05
      light.castShadow = true

      light.shadow.camera.bottom = -30
      light.shadow.camera.left = -30
      light.shadow.camera.top = 30
      light.shadow.camera.right = 45

      return light
    }
    // case 'ambient':
    //   return new AmbientLight(settings.color, settings.intensity)
    case 'hemisphere':
      return new HemisphereLight(0xffffff, 0x223344, 1)
  }
}

/** @type {Type.Module} */
export default function () {
  return {
    observe({ events, scene, get_state }) {
      events.on('light_add', ({ type, ...settings }) => {
        const light = create_light(type, settings)
        scene.add(light)
      })
    },
  }
}
