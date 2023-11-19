import { DirectionalLight, AmbientLight, HemisphereLight } from 'three'
import { nanoid } from 'nanoid'

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
    case 'ambient':
      return new AmbientLight(settings.color, settings.intensity)
    case 'hemisphere':
      return new HemisphereLight(0xffffff, 0x223344, 1)
  }
}

/** @type {Type.Module} */
export default function () {
  const lights_names = new Set()

  return {
    name: 'game_lights',
    observe({ events, scene, signal }) {
      events.on('light_add', ({ type, ...settings }) => {
        const light = create_light(type, settings)
        light.name = nanoid()
        scene.add(light)
        lights_names.add(light.name)
      })

      signal.addEventListener('abort', () => {
        lights_names.forEach(name => {
          const light = scene.getObjectByName(name)
          if (light) scene.remove(light)
        })
      })
    },
  }
}
