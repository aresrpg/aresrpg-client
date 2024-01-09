import {
  Audio,
  AudioListener,
  AudioLoader,
  InstancedMesh,
  Matrix4,
  SpotLight,
  Vector3,
} from 'three'
import { nanoid } from 'nanoid'

import mirin from '../assets/sound/mirin.mp3'
import tree_path from '../models/tree.glb?url'
import { load } from '../utils/load_model.js'
import {
  CHUNK_CACHE,
  instanced_volume,
  make_chunk_key,
} from '../utils/chunks.js'

const listener = new AudioListener()
const sound = new Audio(listener)
const audio_loader = new AudioLoader()

const audio_buffer = await audio_loader.loadAsync(mirin)
const tree = await load(tree_path, {
  envMapIntensity: 0.25,
  mesh_name: 'Tree_03_voxel',
}).then(clone => clone())

sound.setBuffer(audio_buffer)
sound.setLoop(true)
sound.setVolume(0.5)

/** @type {Type.Module} */
export default function () {
  let camera_moving = false
  const camera_target_position = new Vector3()
  let lerp_factor = 0
  let iop = null
  let sram = null
  let iopette = null

  const instanced_forest = new InstancedMesh(
    // @ts-ignore
    tree.skinned_mesh.geometry,
    // @ts-ignore
    tree.skinned_mesh.material,
    4,
  )

  return {
    name: 'main_menu',
    observe({ scene, signal, camera, Pool, events }) {
      camera.position.set(-10, 40, 50)
      camera.lookAt(-60, 40, 1)
      camera.add(listener)

      sound.play()

      const audio_interval = setInterval(() => {
        sound.context.resume()
        if (sound.context.state === 'running') clearInterval(audio_interval)
      }, 500)

      iop = Pool.iop_male.get(nanoid())

      iop.move(new Vector3(-19, 37.88, 45))
      iop.animate('IDLE')

      sram = Pool.sram_male.get(nanoid())

      sram.move(new Vector3(-21, 38.05, 45))
      sram.animate('SIT')

      iopette = Pool.iop_female.get(nanoid())

      iopette.move(new Vector3(-17.6, 36, 34))
      iopette.animate('DANCE')

      const sramette = Pool.sram_female.get(nanoid())

      sramette.move(new Vector3(-19, 36, 34))
      sramette.animate('DANCE')

      const scale = 50
      const scale_vector = new Vector3(scale, scale, scale)
      const matrix = new Matrix4()

      matrix.makeTranslation(-40, 30, 25)
      matrix.scale(scale_vector)
      instanced_forest.setMatrixAt(0, matrix)

      matrix.makeTranslation(-25, 30, 5)
      matrix.scale(scale_vector)
      instanced_forest.setMatrixAt(1, matrix)

      instanced_forest.instanceMatrix.needsUpdate = true

      instanced_forest.castShadow = true
      instanced_forest.receiveShadow = true

      scene.add(instanced_forest)

      events.on('MOVE_MENU_CAMERA', ([x, y, z]) => {
        camera_target_position.set(x, y, z)
        camera_moving = true
        lerp_factor = 0
      })

      // @ts-ignore
      CHUNK_CACHE.loading.then(() => {
        for (let x = -3; x < 3; x++)
          for (let z = -3; z < 3; z++) {
            CHUNK_CACHE.get(make_chunk_key({ x, z })).forEach(volume =>
              instanced_volume.add_volume(volume),
            )
          }
      })

      scene.add(instanced_volume)

      const spotlight = new SpotLight(0xffffff, 10)
      spotlight.position.copy(new Vector3(-19, 38, 36))

      spotlight.castShadow = true

      scene.add(spotlight)

      signal.addEventListener('abort', () => {
        sound.stop()

        instanced_forest.dispose()
        instanced_volume.clear_volumes()

        clearInterval(audio_interval)

        iop.remove()
        sram.remove()
        iopette.remove()
        sramette.remove()

        scene.remove(instanced_volume)
        scene.remove(instanced_forest)
      })
    },
    tick(state, { camera }, delta) {
      sram.rotate(new Vector3(-0.2, 0, -1))
      iop.rotate(new Vector3(-0.2, 0, -1))
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
        camera.lookAt(-60, 40, 1)
      }
    },
  }
}
