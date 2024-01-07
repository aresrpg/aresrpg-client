import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  Uint32BufferAttribute,
  Vector3,
} from 'three'
import workerpool from 'workerpool'
import { CHUNK_SIZE } from '@aresrpg/aresrpg-protocol'

import chunk_worker from '../world_gen/chunk_worker.js?worker&url'
import { VOLUME_SIZE_BYTES, read_volume } from '../world_gen/greedy_mesh.js'
import { HEIGHTS } from '../world_gen/noise.js'

import InstancedVolume from './InstancedVolume.js'

const pool = workerpool.pool(chunk_worker, {
  workerOpts: {
    type: 'module',
  },
})

export const instanced_volume = new InstancedVolume(100000)

/** @typedef {{ matrix: import('three').Matrix4, block: number }} volume */

/** @type {Map<string, volume[]>} */
export const CHUNK_CACHE = new Map()
export const PLANE_CHUNK_CACHE = new Map()

// /**
//  *
//  * @param {object} param0
//  * @param {number} param0.x
//  * @param {number} param0.z
//  */
// export async function request_chunk_load({ x, z }) {
//   const volumes_buffer = await pool.exec('create_voxel_chunk_column', [
//     {
//       chunk_x: x,
//       chunk_z: z,
//       noise_buffer: HEIGHTS,
//     },
//   ])

//   const origin_x = x * CHUNK_SIZE
//   const origin_z = z * CHUNK_SIZE

//   const instanced_datas = []
//   const view = new DataView(volumes_buffer)
//   const reusable_matrix = new Matrix4()
//   const reusable_position = new Vector3()
//   const reusable_quaternion = new Quaternion()
//   const reusable_scale = new Vector3(1, 1, 1)

//   for (
//     let offset = 0;
//     offset < volumes_buffer.byteLength;
//     offset += VOLUME_SIZE_BYTES
//   ) {
//     const volume = read_volume(offset, view)
//     if (!volume) continue

//     // Calculate the dimensions of the volume
//     const width = volume.max.x - volume.min.x + 1
//     const height = volume.max.y - volume.min.y + 1
//     const depth = volume.max.z - volume.min.z + 1

//     // For rendering: create a matrix for the instanced mesh
//     reusable_matrix.compose(
//       reusable_position.set(
//         origin_x + volume.min.x + width / 2,
//         volume.min.y + height / 2,
//         origin_z + volume.min.z + depth / 2,
//       ),
//       reusable_quaternion,
//       reusable_scale.set(width, height, depth),
//     )

//     instanced_datas.push({
//       matrix: reusable_matrix.clone(),
//       block: volume.block,
//     })
//   }

//   return instanced_datas
// }

const SEGMENTS = 2

export async function request_plane_chunks_load({ chunks }) {
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
            segments: SEGMENTS,
            noise_buffer: HEIGHTS,
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

export const make_chunk_key = ({ x, z }) => JSON.stringify({ x, z })

export const from_chunk_key = key => JSON.parse(key)
