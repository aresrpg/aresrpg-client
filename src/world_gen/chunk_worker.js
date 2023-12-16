import workerpool from 'workerpool'

import {
  create_chunk_column,
  create_low_detail_chunk_column,
} from '../world_gen/create_chunk.js'

workerpool.worker({
  create_chunk_column,
  create_low_detail_chunk_column,
})
