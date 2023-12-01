import {
  AmbientLight,
  Audio,
  AudioListener,
  AudioLoader,
  DirectionalLight,
  DirectionalLightHelper,
  HemisphereLight,
  SpotLight,
  SpotLightHelper,
  Vector2,
  Vector3,
} from 'three'
import { N8AOPass } from 'n8ao'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'

import Grass from '../grass/grass.js'
import manracni from '../assets/manracni.mp3'
import dispose from '../utils/dispose.js'

const grass = new Grass(30, 100000)
const listener = new AudioListener()
const sound = new Audio(listener)
const audio_loader = new AudioLoader()

const audio_buffer = await audio_loader.loadAsync(manracni)

sound.setBuffer(audio_buffer)
sound.setLoop(true)
sound.setVolume(0.5)

/** @type {Type.Module} */
export default function () {
  let camera_moving = false
  const camera_target_position = new Vector3()
  let lerp_factor = 0
  let entity = null

  return {
    name: 'main_menu',
    observe({ scene, signal, camera, Pool, composer, events }) {
      camera.position.set(-1, 2, 7)
      camera.lookAt(0, 0, 1)
      camera.add(listener)

      sound.play()

      const audio_interval = setInterval(() => {
        sound.context.resume()
        if (sound.context.state === 'running') {
          console.log('clearing interval')
          clearInterval(audio_interval)
        }
      }, 500)

      entity = Pool.guard.get()

      const spot = new SpotLight(0xffffff, 1, 0, Math.PI / 2, 1, 2)

      spot.position.set(-2, 3, 4)
      spot.target.position.set(1, 0.5, 5)

      const light = new DirectionalLight(0xffffff, 3)
      light.position.set(-2, 3, 4)
      light.target.position.set(1, 0.5, 5)
      light.shadow.mapSize.setScalar(2048)
      light.shadow.bias = -1e-4
      light.shadow.normalBias = 0.05
      light.castShadow = true

      light.shadow.camera.bottom = -30
      light.shadow.camera.left = -30
      light.shadow.camera.top = 30
      light.shadow.camera.right = 45

      const amblight = new AmbientLight('#ffffff', 3)

      scene.add(light)
      scene.add(spot)
      scene.add(amblight)
      scene.add(grass)

      const renderpass = new RenderPass(scene, camera)
      const smaapass = new SMAAPass(window.innerWidth, window.innerHeight)
      const n8aopass = new N8AOPass(
        scene,
        camera,
        window.innerWidth,
        window.innerHeight,
      )
      composer.addPass(renderpass)
      composer.addPass(n8aopass)
      composer.addPass(smaapass)

      entity.move(new Vector3(0.5, 1.2, 5.3))
      entity.three_body.rotation.y = -0.8
      // @ts-ignore
      entity.three_body.collider.visible = false

      events.on('MOVE_MENU_CAMERA', ([x, y, z]) => {
        camera_target_position.set(x, y, z)
        camera_moving = true
        lerp_factor = 0
      })

      signal.addEventListener('abort', () => {
        sound.stop()

        composer.removePass(renderpass)
        composer.removePass(n8aopass)
        composer.removePass(smaapass)

        dispose(grass)

        clearInterval(audio_interval)

        entity.remove()
        scene.remove(grass)
        scene.remove(light)
        scene.remove(spot)
        scene.remove(amblight)
      })
    },
    tick(state, { camera }, delta) {
      grass.update(delta)
      entity.animate('IDLE', delta)

      if (camera_moving) {
        lerp_factor += delta * 0.1 // Adjust the 0.5 value to control the speed
        if (lerp_factor > 1) {
          lerp_factor = 1
          camera_moving = false
        }

        camera.position.lerpVectors(
          camera.position,
          camera_target_position,
          lerp_factor,
        )
        camera.lookAt(0, 0, 1)
      }
    },
  }
}
