import {
  BoxGeometry,
  Color,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  TextureLoader,
  Vector3,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import Stats from 'stats.js'
import { GUI } from 'dat.gui'
import workerpool from 'workerpool'
import { CHUNK_SIZE } from 'aresrpg-protocol'

import create_chunk_column from '../world_gen/create_chunk'
import Biomes from '../world_gen/biomes.js'
import request_chunk_load from '../utils/chunks'

const pool = workerpool.pool('src/world_gen/chunk_worker.js', {
  workerOpts: {
    type: 'module',
  },
})

/** @type {Type.Module} */
export default function () {
  const stats = new Stats()
  const settings = { ...Biomes.DEFAULT, wireframe: false, chunk_count: 5 }

  function show_stats(show) {
    if (show) {
      stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
      window.document.body.appendChild(stats.dom)
    } else window.document.body.removeChild(stats.dom)
  }

  return {
    name: 'world_editor',
    tick() {
      stats.update()
    },
    observe({ scene, signal, camera, renderer, world }) {
      const gui = new GUI({ name: 'World Gen' })
      show_stats(true)

      const controls = new OrbitControls(camera, renderer.domElement)

      signal.addEventListener('abort', () => {
        show_stats(false)
        gui.destroy()
      })

      const chunks = new Map()
      let cubes_count = 0

      async function render_cubes(chunk_x, chunk_z) {
        const key = `${chunk_x},${chunk_z}`
        if (chunks.has(key)) scene.remove(chunks.get(key))

        const { terrain, outline, voxel_count, collider } =
          await request_chunk_load({
            chunk_x,
            chunk_z,
            world,
          })

        chunks.set(key, terrain)

        scene.add(terrain, outline)

        cubes_count += voxel_count

        console.log('cubes_count', cubes_count)
      }

      function update_terrain() {
        cubes_count = 0

        for (let chunk_x = 0; chunk_x < settings.chunk_count; chunk_x++) {
          for (let chunk_z = 0; chunk_z < settings.chunk_count; chunk_z++)
            render_cubes(chunk_x, chunk_z).catch(console.error)
        }
      }

      update_terrain()

      camera.position.set(0, 100, 40)

      gui.useLocalStorage = true

      const terrain_folder = gui.addFolder('Terrain')

      terrain_folder
        .add(settings, 'scale', 1, 1000, 1)
        .name('Scale')
        .onFinishChange(update_terrain)

      terrain_folder
        .add(settings, 'height', 1, 100, 1)
        .name('Height')
        .onFinishChange(update_terrain)

      terrain_folder
        .add(settings, 'octaves', 1, 10, 1)
        .name('Octaves')
        .onFinishChange(update_terrain)

      terrain_folder
        .add(settings, 'persistence', 0, 1, 0.01)
        .name('Persistence')
        .onFinishChange(update_terrain)

      terrain_folder
        .add(settings, 'lacunarity', 0, 10, 0.01)
        .name('Lacunarity')
        .onFinishChange(update_terrain)

      terrain_folder
        .add(settings, 'exponentiation', 0, 10, 0.01)
        .name('Exponentiation')
        .onFinishChange(update_terrain)

      terrain_folder
        .add(settings, 'wireframe')
        .name('Wireframe')
        .onFinishChange(update_terrain)

      terrain_folder
        .add(settings, 'chunk_count', 1, 50, 1)
        .name('Chunk Count')
        .onFinishChange(update_terrain)
    },
  }
}
