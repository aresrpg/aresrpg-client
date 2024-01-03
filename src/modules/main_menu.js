import {
  Audio,
  AudioListener,
  AudioLoader,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three'
import { nanoid } from 'nanoid'

import Grass from '../grass/grass.js'
import manracni from '../assets/sound/manracni.mp3'
import dispose from '../utils/dispose.js'
import tree_path from '../models/tree.glb?url'
import { load } from '../utils/load_model.js'
import { instanced_volume } from '../utils/chunks.js'
import { BLOCKS, block_index } from '../world_gen/chunk_data.js'

const grass = new Grass(30, 100000)
const listener = new AudioListener()
const sound = new Audio(listener)
const audio_loader = new AudioLoader()

const audio_buffer = await audio_loader.loadAsync(manracni)
const tree = await load(tree_path, {
  envMapIntensity: 0.5,
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
      camera.position.set(-0.54, 3.3, 17.2)
      camera.lookAt(0, 0, 1)
      camera.add(listener)

      sound.play()

      const audio_interval = setInterval(() => {
        sound.context.resume()
        if (sound.context.state === 'running') clearInterval(audio_interval)
      }, 500)

      iop = Pool.iop_male.get({
        id: nanoid(),
        fixed_title_aspect: true,
        collider: false,
      })

      iop.move(new Vector3(2, 1.6, 8))
      iop.animate('SIT')

      sram = Pool.sram_male.get({
        id: nanoid(),
        fixed_title_aspect: true,
        collider: false,
      })

      sram.move(new Vector3(4, 1.6, 9))

      const iopette = Pool.iop_female.get({
        id: nanoid(),
        fixed_title_aspect: true,
        collider: false,
      })

      iopette.move(new Vector3(-2, 2.3, 11.7))
      iopette.animate('DANCE')

      scene.add(grass)

      const scale = 10
      const scale_vector = new Vector3(scale, scale, scale)
      const matrix = new Matrix4()

      matrix.makeTranslation(5, 0, 5)
      matrix.scale(scale_vector)
      instanced_forest.setMatrixAt(0, matrix)

      matrix.makeTranslation(2, 0, 2)
      matrix.scale(scale_vector)
      instanced_forest.setMatrixAt(1, matrix)

      matrix.makeTranslation(-5, 0, -5)
      matrix.scale(scale_vector)
      instanced_forest.setMatrixAt(2, matrix)

      matrix.makeTranslation(-8, 0, 5)
      matrix.scale(scale_vector)
      instanced_forest.setMatrixAt(3, matrix)

      instanced_forest.instanceMatrix.needsUpdate = true

      instanced_forest.castShadow = true
      instanced_forest.receiveShadow = true

      scene.add(instanced_forest)

      events.on('MOVE_MENU_CAMERA', ([x, y, z]) => {
        camera_target_position.set(x, y, z)
        camera_moving = true
        lerp_factor = 0
      })

      const r = new Quaternion()
      const s = new Vector3(1, 1, 1)

      const vol1 = {
        vol: 1,
        block: block_index(BLOCKS.GRASS),
        matrix: new Matrix4().compose(new Vector3(-2, 0.9, 12), r, s),
      }

      const vol2 = {
        vol: 2,
        block: block_index(BLOCKS.GRASS),
        matrix: new Matrix4().compose(new Vector3(-5, 0.9, 7), r, s),
      }

      const vol3 = {
        vol: 3,
        block: block_index(BLOCKS.GRASS),
        matrix: new Matrix4().compose(new Vector3(7, 0.9, 5), r, s),
      }

      instanced_volume.add_volume(vol1)
      instanced_volume.add_volume(vol2)
      instanced_volume.add_volume(vol3)

      scene.add(instanced_volume)

      signal.addEventListener('abort', () => {
        sound.stop()

        dispose(grass)
        instanced_forest.dispose()
        instanced_volume.remove_volume(vol1)
        instanced_volume.remove_volume(vol2)
        instanced_volume.remove_volume(vol3)

        clearInterval(audio_interval)

        iop.remove()
        sram.remove()
        iopette.remove()

        scene.remove(instanced_volume)
        scene.remove(instanced_forest)
        scene.remove(grass)
      })
    },
    tick(state, { camera }, delta) {
      grass.update(delta)

      sram.rotate(new Vector3(-1, 0, 0.4))
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
