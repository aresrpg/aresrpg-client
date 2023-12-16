import ndarray from 'ndarray'
import { CHUNK_SIZE, WORLD_HEIGHT } from 'aresrpg-protocol'

import { create_fractionnal_brownian } from './noise.js'
import greedy_mesh from './greedy_mesh.js'

const VOXEL_SIZE = 1

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

function create_chunk({ chunk_x, chunk_z, row, heightfield, column }) {
  for (const [offset_x, offset_y, offset_z] of iterate_chunk()) {
    const x = chunk_x * CHUNK_SIZE + offset_x
    const z = chunk_z * CHUNK_SIZE + offset_z
    const y = row * CHUNK_SIZE + offset_y

    const chunk_offset_x = -CHUNK_SIZE / 2
    const chunk_offset_z = -CHUNK_SIZE / 2

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
      column.set(offset_x, y, offset_z, data)
    }
  }
}

export function create_chunk_column(chunk_x, chunk_z, biome, seed) {
  const row_amount = WORLD_HEIGHT / CHUNK_SIZE
  const column = ndarray(new Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE), [
    CHUNK_SIZE,
    WORLD_HEIGHT,
    CHUNK_SIZE,
  ])
  const heightfield = create_fractionnal_brownian(biome, seed)

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

function unpack_color(hex) {
  const r = ((hex >> 16) & 255) / 255 // Extract the RR byte and normalize
  const g = ((hex >> 8) & 255) / 255 // Extract the GG byte and normalize
  const b = (hex & 255) / 255 // Extract the BB byte and normalize
  return [r, g, b]
}

export function create_low_detail_chunk_column(
  chunk_x,
  chunk_z,
  biome,
  seed,
  segments,
) {
  const heightfield = create_fractionnal_brownian(biome, seed)
  const vertices = []
  const colors = []
  const indices = []

  // Segment size is the real world size of each grid square
  const segment_size = CHUNK_SIZE / segments

  // Generate grid vertices and color data
  for (let i = 0; i <= segments; i++) {
    for (let j = 0; j <= segments; j++) {
      const x = chunk_x * CHUNK_SIZE + i * segment_size
      const z = chunk_z * CHUNK_SIZE + j * segment_size
      const y = heightfield(x, z)

      // Push the vertex position
      vertices.push(x, y, z)

      // Get color data for the vertex
      const { color } = get_voxel_data({ x, y, z })
      colors.push(...unpack_color(color))
    }
  }

  // Generate indices for the grid vertices
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < segments; j++) {
      // Get the indices of the corners of a grid square
      const a = i * (segments + 1) + j
      const b = a + segments + 1
      const c = a + 1
      const d = b + 1

      // Create two triangles (quad) for each grid square
      indices.push(a, b, c)
      indices.push(b, d, c)
    }
  }

  return { vertices, colors, indices }
}
