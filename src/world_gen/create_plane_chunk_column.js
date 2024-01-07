import { CHUNK_SIZE } from '@aresrpg/aresrpg-protocol'

import { unpack_color } from '../utils/InstancedVolume.js'

import { block_at_index, get_voxel_data } from './chunk_data.js'
import { create_shared_fractionnal_brownian } from './noise'

export default function create_plane_chunk_column({
  chunk_x,
  chunk_z,
  segments,
  noise_buffer,
}) {
  const heightfield = create_shared_fractionnal_brownian(noise_buffer)

  // Define the size of each segment in the chunk
  const segment_size = CHUNK_SIZE / segments

  // Calculate the total number of vertices
  const total_vertices = (segments + 1) * (segments + 1)

  // Create SharedArrayBuffers for vertices, blocks, and indices
  const vertices = new SharedArrayBuffer(
    total_vertices * 3 * Float32Array.BYTES_PER_ELEMENT, // Use Float32Array for vertices
  )
  const colors = new SharedArrayBuffer(
    total_vertices * 3 * Float32Array.BYTES_PER_ELEMENT,
  )
  const indices = new SharedArrayBuffer(
    segments * segments * 6 * Uint32Array.BYTES_PER_ELEMENT,
  )

  // Create views for the buffers
  const vertices_view = new Float32Array(vertices) // Float32 view for vertex positions
  const colors_view = new Float32Array(colors)
  const indices_view = new Uint32Array(indices)

  let vertex_index = 0
  let color_index = 0

  // Generate grid vertices and color data
  for (let i = 0; i <= segments; i++) {
    for (let j = 0; j <= segments; j++) {
      const x = chunk_x * CHUNK_SIZE + i * segment_size
      const z = chunk_z * CHUNK_SIZE + j * segment_size
      const y = heightfield(x, z)

      vertices_view.set([x, y - 1, z], vertex_index)
      vertex_index += 3

      // Get color data for the vertex and store it
      const { block } = get_voxel_data({ x, y, z, heightfield })
      const [r, g, b] = unpack_color(block_at_index(block))
      colors_view.set([r, g, b], color_index)

      color_index += 3
    }
  }

  // Generate indices for the grid vertices
  let index_index = 0
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j
      const b = a + segments + 1
      const c = a + 1
      const d = b + 1

      indices_view.set([a, c, b, c, d, b], index_index)
      index_index += 6
    }
  }

  return { vertices, colors, indices }
}
