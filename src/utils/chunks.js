import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Int32BufferAttribute,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Uint32BufferAttribute,
  Vector3,
} from 'three'
import workerpool from 'workerpool'
import { CHUNK_SIZE } from '@aresrpg/aresrpg-protocol'
import { WORLD_HEIGHT } from '@aresrpg/aresrpg-protocol/src/chunk.js'
import { MeshBVH, StaticGeometryGenerator } from 'three-mesh-bvh'

import Biomes from '../world_gen/biomes.js'
import chunk_worker from '../world_gen/chunk_worker.js?worker&url'
import { VOLUME_SIZE_BYTES, read_volume } from '../world_gen/greedy_mesh.js'

import InstancedVolume from './InstancedVolume.js'

const pool = workerpool.pool(chunk_worker, {
  workerOpts: {
    type: 'module',
  },
})

export const instanced_volume = new InstancedVolume()

/** @typedef {Type.Await<ReturnType<request_chunk_load>>} chunk */

export const CHUNK_CACHE = new Map()
export const PLANE_CHUNK_CACHE = new Map()

/**
 *
 * @param {object} param0
 * @param {number} param0.x
 * @param {number} param0.z
 * @param {string} param0.seed
 */
export async function request_chunk_load({ x, z, seed }, scene) {
  const volumes_buffer = await pool.exec('create_voxel_chunk_column', [
    {
      chunk_x: x,
      chunk_z: z,
      seed,
      biome: Biomes.DEFAULT,
    },
  ])

  const origin_x = x * CHUNK_SIZE
  const origin_z = z * CHUNK_SIZE

  const meshes = []
  const instanced_datas = []
  const view = new DataView(volumes_buffer)
  const reusable_matrix = new Matrix4()
  const reusable_position = new Vector3()
  const reusable_quaternion = new Quaternion()
  const reusable_scale = new Vector3(1, 1, 1)

  for (
    let offset = 0;
    offset < volumes_buffer.byteLength;
    offset += VOLUME_SIZE_BYTES
  ) {
    const volume = read_volume(offset, view)
    if (!volume) continue

    // Calculate the dimensions of the volume
    const width = volume.max.x - volume.min.x + 1
    const height = volume.max.y - volume.min.y + 1
    const depth = volume.max.z - volume.min.z + 1

    // For rendering: create a matrix for the instanced mesh
    reusable_matrix.compose(
      reusable_position.set(
        origin_x + volume.min.x + width / 2,
        volume.min.y + height / 2,
        origin_z + volume.min.z + depth / 2,
      ),
      reusable_quaternion,
      reusable_scale.set(width, height, depth),
    )

    // For collision: create geometry for the volume
    const volume_geometry = new BoxGeometry(width, height, depth)

    // translate the volume according to the chunk position and multiply by the chunk size
    volume_geometry.translate(
      volume.min.x + width / 2,
      volume.min.y + height / 2,
      volume.min.z + depth / 2,
    )

    volume_geometry.translate(x * CHUNK_SIZE, 0, z * CHUNK_SIZE)
    meshes.push(new Mesh(volume_geometry))
    instanced_datas.push({
      matrix: reusable_matrix.clone(),
      block: volume.block,
    })
  }

  const collision_geometry = new StaticGeometryGenerator(meshes).generate()

  const collider_mesh = new Mesh(
    collision_geometry,
    new MeshStandardMaterial({
      wireframe: true,
      color: 0x76ff03,
      // emissive: 0x76ff03,
      envMapIntensity: 0.1,
    }),
  )

  collider_mesh.receiveShadow = true
  collider_mesh.castShadow = true
  collider_mesh.name = `collider ${x}:${z}`

  meshes.forEach(mesh => {
    mesh.geometry.dispose()
    // @ts-ignore
    mesh.material.dispose()
  })

  collision_geometry.boundsTree = new MeshBVH(collision_geometry)

  const chunk_border = new Mesh(
    new BoxGeometry(CHUNK_SIZE, WORLD_HEIGHT, CHUNK_SIZE),
    new MeshBasicMaterial({
      color: 0x90a4ae,
      transparent: true,
      opacity: 0.2,
    }),
  )

  chunk_border.position.set(
    x * CHUNK_SIZE + CHUNK_SIZE / 2,
    WORLD_HEIGHT / 2,
    z * CHUNK_SIZE + CHUNK_SIZE / 2,
  )

  chunk_border.visible = false
  collider_mesh.visible = false

  chunk_border.name = `border ${x}:${z}`
  scene.add(chunk_border)

  const chunk = {
    chunk_border,
    instanced_datas,
    collider: collider_mesh,
    dispose() {
      scene.remove(collider_mesh)
      scene.remove(chunk_border)

      collider_mesh.geometry.dispose()
      collider_mesh.material.dispose()
      chunk_border.geometry.dispose()
      chunk_border.material.dispose()
    },
  }

  return chunk
}

const SEGMENTS = 2

export async function request_plane_chunks_load({ chunks, seed }) {
  const geometry_buffers = await Promise.all(
    chunks.map(async key => {
      const { x, z } = from_chunk_key(key)

      if (PLANE_CHUNK_CACHE.has(key)) return PLANE_CHUNK_CACHE.get(key)

      const generated = {
        chunk_x: x,
        chunk_z: z,
        segments: SEGMENTS,
        ...(await pool.exec('create_plane_chunk_column', [
          {
            chunk_x: x,
            chunk_z: z,
            seed,
            segments: SEGMENTS,
            biome: Biomes.DEFAULT,
          },
        ])),
      }

      PLANE_CHUNK_CACHE.set(key, generated)

      return generated
    }),
  )

  const { vertices, colors, indices } = await pool.exec('merge_plane_columns', [
    geometry_buffers,
  ])

  const geometry = new BufferGeometry()

  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(new Float32Array(vertices), 3),
  )
  geometry.setAttribute(
    'color',
    new Float32BufferAttribute(new Float32Array(colors), 3),
  )
  geometry.setIndex(new Uint32BufferAttribute(new Uint32Array(indices), 1))

  return geometry
}

export const make_chunk_key = ({ x, z, seed }) => JSON.stringify({ x, z, seed })

export const from_chunk_key = key => JSON.parse(key)
