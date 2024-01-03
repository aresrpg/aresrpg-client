import ndarray from 'ndarray'
import { CHUNK_SIZE, WORLD_HEIGHT } from '@aresrpg/aresrpg-protocol'

import greedy_mesh from './greedy_mesh.js'
import { create_fractionnal_brownian } from './noise.js'
import { get_voxel_data } from './chunk_data.js'

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
    Math.round(heightfield(x, z)) === Math.round(y) ||
    heightfield(x - 1, z) < y ||
    heightfield(x + 1, z) < y ||
    heightfield(x, z - 1) < y ||
    heightfield(x, z + 1) < y
  )
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

function create_chunk({ chunk_x, chunk_z, row, heightfield, column }) {
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
      const data = get_voxel_data({ x, y, z, heightfield })
      column.set(offset_x, y, offset_z, data)
    }
  }
}

export default function create_voxel_chunk_column({
  chunk_x,
  chunk_z,
  seed,
  biome,
}) {
  const row_amount = WORLD_HEIGHT / CHUNK_SIZE
  const column = ndarray(new Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE), [
    CHUNK_SIZE,
    WORLD_HEIGHT,
    CHUNK_SIZE,
  ])
  const heightfield = create_fractionnal_brownian(seed, biome)

  // Fill voxel data for each layer in the chunk
  for (let row = 0; row < row_amount; row++) {
    if (!is_chunk_empty({ chunk_x, chunk_z, row, heightfield }))
      create_chunk({
        chunk_x,
        chunk_z,
        row,
        heightfield,
        column,
      })
  }

  return greedy_mesh(column)
}
