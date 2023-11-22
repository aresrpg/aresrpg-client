import { DirectionalLight, AmbientLight, HemisphereLight, Vector2 } from 'three'
import { nanoid } from 'nanoid'
import { N8AOPass } from 'n8ao'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'

/** @type {Type.Module} */
export default function () {
  const lights = new Set()
  let n8aopass = null
  let smaapass = null
  let renderpass = null

  return {
    name: 'game_lights',
    observe({ events, scene, signal, composer, camera }) {
      events.once('STATE_UPDATED', ({ type, ...settings }) => {
        if (!lights.size) {
          const light = new DirectionalLight(0xffffff, 2)
          light.position.set(1, 1.5, 1).multiplyScalar(50)
          light.shadow.mapSize.setScalar(2048)
          light.shadow.bias = -1e-4
          light.shadow.normalBias = 0.05
          light.castShadow = true

          light.shadow.camera.bottom = -30
          light.shadow.camera.left = -30
          light.shadow.camera.top = 30
          light.shadow.camera.right = 45

          const light2 = new AmbientLight(0xffffff, 2)

          scene.add(light, light2)
          lights.add(light)
          lights.add(light2)
        } else {
          lights.forEach(light => {
            light.intensity = 2
          })
        }

        renderpass = new RenderPass(scene, camera)
        smaapass = new SMAAPass(window.innerWidth, window.innerHeight)
        n8aopass = new N8AOPass(
          scene,
          camera,
          window.innerWidth,
          window.innerHeight,
        )
        composer.addPass(renderpass)
        composer.addPass(n8aopass)
        composer.addPass(smaapass)
      })

      signal.addEventListener(
        'abort',
        () => {
          lights.forEach(light => {
            light.intensity = 0
          })
          if (n8aopass) composer.removePass(n8aopass)
          if (smaapass) composer.removePass(smaapass)
          if (renderpass) composer.removePass(renderpass)
        },
        { once: true },
      )
    },
  }
}
