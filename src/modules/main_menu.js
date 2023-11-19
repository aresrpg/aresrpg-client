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
import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass.js'
import { SSAARenderPass } from 'three/examples/jsm/postprocessing/SSAARenderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

import Grass from '../grass/grass.js'
import manracni from '../assets/manracni.mp3'
import Pool from '../pool.js'
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
  const { model, mixer, ...animations } = Pool.guard.get()

  let camera_moving = false
  const camera_target_position = new Vector3()
  let lerp_factor = 0
  // is the focus on the class selection menu?
  let class_selection = false

  return {
    name: 'main_menu',
    observe({ scene, signal, camera, connect_ws, composer, events }) {
      scene.add(grass)
      camera.position.set(-1, 2, 7)
      camera.lookAt(0, 0, 1)
      camera.add(listener)

      sound.play()

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

      const helper = new DirectionalLightHelper(light, 10, '#ff0000')
      const spothelper = new SpotLightHelper(spot, '#ff0000')

      scene.add(light)
      scene.add(spot)
      scene.add(amblight)
      // scene.add(helper)
      // scene.add(spothelper)

      const n8aopass = new N8AOPass(
        scene,
        camera,
        window.innerWidth,
        window.innerHeight,
      )
      const renderpass = new RenderPass(scene, camera)
      const smaapass = new SMAAPass(window.innerWidth, window.innerHeight)
      const pixelpass = new RenderPixelatedPass(4, scene, camera)
      const bloomPass = new UnrealBloomPass(
        new Vector2(window.innerWidth, window.innerHeight),
        0.5,
        0,
        0.95,
      )
      const outputpass = new OutputPass()
      const ssaapass = new SSAARenderPass(scene, camera, 0xaaaaaa, 0)

      n8aopass.configuration.gammaCorrection = false

      composer.addPass(renderpass)
      // composer.addPass(ssaapass)
      // composer.addPass(n8aopass)
      // composer.addPass(bloomPass)
      // composer.addPass(pixelpass)
      // composer.addPass(smaapass)
      // composer.addPass(outputpass)

      model.position.set(1, 0.3, 5)
      model.rotation.y = 4

      animations.IDLE.play()

      scene.add(model)

      events.on('SHOW_CLASS_SELECTION', show => {
        if (!class_selection && show) camera_target_position.set(-8, 1.3, 4)
        else if (class_selection && !show) camera_target_position.set(-1, 2, 7)
        camera_moving = true
        lerp_factor = 0
        class_selection = show
      })

      signal.addEventListener('abort', () => {
        sound.stop()
        composer.removePass(n8aopass)
        composer.removePass(smaapass)
        model.visible = false
        dispose(grass)
        scene.remove(grass)
      })
    },
    tick(state, { camera }, delta) {
      grass.update(delta)
      mixer.update(delta)

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
