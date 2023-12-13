import ndarray from 'ndarray'
import { CHUNK_SIZE } from 'aresrpg-protocol'

import { create_fractionnal_brownian } from './noise.js'

const VOXEL_SIZE = 1
const WORLD_HEIGHT = 256

function is_chunk_empty({ chunk_x, chunk_z, row, heightfield }) {
  for (let offset_x = 0; offset_x < CHUNK_SIZE; offset_x++) {
    for (let offset_z = 0; offset_z < CHUNK_SIZE; offset_z++) {
      const x = chunk_x * CHUNK_SIZE + offset_x
      const z = chunk_z * CHUNK_SIZE + offset_z

      const world_floor = row * CHUNK_SIZE
      const world_ceiling = row * CHUNK_SIZE + CHUNK_SIZE

      const y = heightfield(x, z)
      if (y >= world_floor && y < world_ceiling) return false
    }
  }
  return true // No intersection found, layer is empty
}

function is_voxel_exposed({ x, y, z, heightfield }) {
  return (
    heightfield(x, z) === y ||
    heightfield(x - 1, z) < y ||
    heightfield(x + 1, z) < y ||
    heightfield(x, z - 1) < y ||
    heightfield(x, z + 1) < y
  )
}

function get_voxel_data({ x, y, z }) {
  const color =
    y < 15 ? 0x29b6f6 : y < 20 ? 0xc2b280 : y < 40 ? 0x43a047 : 0xffffff

  return {
    color,
  }
}

function* iterate_chunk() {
  for (let offset_x = 0; offset_x < CHUNK_SIZE; offset_x++) {
    for (let offset_z = 0; offset_z < CHUNK_SIZE; offset_z++) {
      for (let offset_y = 0; offset_y < CHUNK_SIZE; offset_y++) {
        yield [offset_x, offset_y, offset_z]
      }
    }
  }
}

function create_chunk({ chunk_x, chunk_z, row, heightfield }) {
  const chunk = ndarray(new Array(CHUNK_SIZE ** 3), [
    CHUNK_SIZE,
    CHUNK_SIZE,
    CHUNK_SIZE,
  ])

  for (const [offset_x, offset_y, offset_z] of iterate_chunk()) {
    const x = chunk_x * CHUNK_SIZE + offset_x
    const z = chunk_z * CHUNK_SIZE + offset_z
    const y = row * CHUNK_SIZE + offset_y

    const surface = heightfield(x, z)

    if (
      y <= surface &&
      is_voxel_exposed({
        x,
        y,
        z,
        heightfield,
      })
    ) {
      const data = get_voxel_data({ x, y, z })
      chunk.set(offset_x, offset_y, offset_z, data)
    }
  }

  return chunk
}

export default function create_chunk_column(chunk_x, chunk_z, biome) {
  const row_amount = WORLD_HEIGHT / CHUNK_SIZE
  const column = Array.from({ length: row_amount })
  const heightfield = create_fractionnal_brownian(biome)

  // Fill voxel data for each layer in the chunk
  for (let row = 0; row < row_amount; row++) {
    if (!is_chunk_empty({ chunk_x, chunk_z, row, heightfield }))
      column[row] = create_chunk({
        chunk_x,
        chunk_z,
        row,
        heightfield,
      })
  }

  return column.flatMap((chunk, row) => {
    if (chunk) {
      const cubes = []
      const chunk_offset_x = -CHUNK_SIZE / 2 + 0.5
      const chunk_offset_z = -CHUNK_SIZE / 2 + 0.5

      for (const [offset_x, offset_y, offset_z] of iterate_chunk()) {
        const data = chunk.get(offset_x, offset_y, offset_z)
        if (data)
          cubes.push({
            data,
            x: chunk_offset_x + offset_x,
            y: row * CHUNK_SIZE + offset_y,
            z: chunk_offset_z + offset_z,
          })
      }
      return cubes
    }
    return []
  })
}
