import ndarray from 'ndarray'
import { CHUNK_SIZE, WORLD_HEIGHT } from 'aresrpg-protocol'

import greedy_mesh from './greedy_mesh.js'
import { create_fractionnal_brownian } from './noise.js'

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

function get_voxel_data({ x, y, z, heightfield, biome: { painting } }) {
  // Calculate noise values for snow, stone, sand, and grass
  const snow_noise = heightfield(
    x * painting.snow_cover_scale,
    z * painting.snow_cover_scale,
  )
  const stone_noise = heightfield(
    x * painting.stone_noise_scale,
    z * painting.stone_noise_scale,
  )
  const sand_noise = heightfield(
    x * painting.sand_noise_scale,
    z * painting.sand_noise_scale,
  )
  const grass_noise = heightfield(
    x * painting.grass_noise_scale,
    z * painting.grass_noise_scale,
  )

  // Determine the base terrain height using heightfield
  const terrain_height = heightfield(x, z)

  // Calculate moisture for grass color variation
  const moisture = heightfield(
    x * painting.moisture_scale,
    z * painting.moisture_scale,
  )

  // Determine if the voxel is stone based on noise and height
  const is_stone = terrain_height > y && stone_noise > painting.stone_threshold

  // Check for snow coverage based on altitude and noise
  const is_snow_covered =
    y >= painting.min_snow_altitude &&
    snow_noise > painting.snow_cover_threshold
  const is_fully_snow_covered = y >= painting.full_snow_altitude

  // Grass and stone color variations
  const grass_color_variation =
    grass_noise > painting.grass_noise_threshold ? 0x679436 : 0x43a047 // Additional grass color
  const dry_grass_color_variation =
    grass_noise > painting.dry_grass_noise_threshold ? 0x8c8a55 : 0x85c17e // Additional dry grass color
  const stone_color_variation =
    stone_noise > painting.stone_color_noise_threshold ? 0x757575 : 0x8e8e8e // Additional stone color
  const sand_color_variation =
    sand_noise > painting.sand_color_noise_threshold ? 0xe9c2a6 : 0xc2b280 // Additional sand color

  // Initialize the color variable
  let color = null

  // Set the voxel color based on the terrain type
  if (is_fully_snow_covered) {
    color = 0xffffff // Full snow color
  } else if (is_stone) {
    // Stone color with variation
    color = stone_color_variation
  } else if (is_snow_covered) {
    // Blend stone and snow based on noise, with additional stone color variation
    color =
      stone_noise > painting.snow_stone_mix_threshold
        ? stone_color_variation
        : 0xffffff
  } else if (y < 25) {
    // Sand color with variation
    color = sand_color_variation
  } else {
    // Grass color varies based on moisture, with additional grass color variation
    color =
      moisture > painting.moisture_threshold
        ? grass_color_variation
        : dry_grass_color_variation
  }

  return { color }
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

function create_chunk({ chunk_x, chunk_z, row, heightfield, column, biome }) {
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
      const data = get_voxel_data({ x, y, z, heightfield, biome })
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
        biome,
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
      const { color } = get_voxel_data({ x, y, z, heightfield, biome })
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

      // Create two triangles (quad) for each grid square with the correct winding order
      // The winding order is counter-clockwise when looking from above, assuming y is up
      indices.push(a, c, b) // First triangle
      indices.push(c, d, b) // Second triangle
    }
  }

  return { vertices, colors, indices }
}
