import workerpool from 'workerpool'

import create_plane_chunk_column from './create_plane_chunk_column.js'
import create_voxel_chunk_column from './create_voxel_chunk_column.js'
import merge_plane_columns from './merge_plane_columns.js'

workerpool.worker({
  create_voxel_chunk_column,
  create_plane_chunk_column,
  merge_plane_columns,
})
