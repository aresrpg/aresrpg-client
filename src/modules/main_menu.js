import { Audio, AudioListener, AudioLoader, Vector3 } from 'three'

import Grass from '../grass/grass.js'
import manracni from '../assets/sound/manracni.mp3'
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
        if (sound.context.state === 'running') clearInterval(audio_interval)
      }, 500)

      entity = Pool.iop_male.get()

      scene.add(grass)

      entity.move(new Vector3(0.5, 1.9, 5))
      entity.three_body.rotation.y = Math.PI * 1.75
      // @ts-ignore
      entity.three_body.collider.visible = false

      events.on('MOVE_MENU_CAMERA', ([x, y, z]) => {
        camera_target_position.set(x, y, z)
        camera_moving = true
        lerp_factor = 0
      })

      signal.addEventListener('abort', () => {
        sound.stop()

        dispose(grass)

        clearInterval(audio_interval)

        entity.remove()
        scene.remove(grass)
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
