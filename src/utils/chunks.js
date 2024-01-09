import {
  BufferGeometry,
  Float32BufferAttribute,
  Uint32BufferAttribute,
} from 'three'
import workerpool from 'workerpool'

import chunk_worker from '../world_gen/chunk_worker.js?worker&url'
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
