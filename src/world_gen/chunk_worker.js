import workerpool from 'workerpool'

import create_chunk_column from './create_chunk.js'

workerpool.worker({
  create_chunk: create_chunk_column,
})
