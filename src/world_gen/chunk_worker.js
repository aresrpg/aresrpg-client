import workerpool from 'workerpool'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BufferAttribute, BufferGeometry } from 'three'

import {
  create_chunk_column,
  create_low_detail_chunk_column,
} from '../world_gen/create_chunk.js'

workerpool.worker({
  create_chunk_column,
  create_low_detail_chunk_column,
  merge_geometries(geometries_data, shared_buffers) {
    const { vertices_buffer, colors_buffer, indices_buffer } = shared_buffers

    let vertex_offset = 0
    let color_offset = 0
    let index_offset = 0

    // Create views on the shared buffers
    const vertices_view = new Float32Array(vertices_buffer)
    const colors_view = new Float32Array(colors_buffer)
    const indices_view = new Uint32Array(indices_buffer)

    geometries_data.forEach(({ vertices, colors, indices }) => {
      // Copy vertices
      vertices_view.set(new Float32Array(vertices), vertex_offset)

      // Copy colors
      colors_view.set(new Float32Array(colors), color_offset)
      color_offset += colors.length

      // Copy indices. Need to offset indices to match the merged vertex positions
      const offset_indices = new Uint32Array(indices).map(
        index => index + vertex_offset / 3,
      )
      indices_view.set(offset_indices, index_offset)
      index_offset += indices.length

      vertex_offset += vertices.length
    })
  },
})
