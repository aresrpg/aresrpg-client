import fs from 'fs'

import { CHUNK_SIZE, MAP_BOUNDS } from '@aresrpg/aresrpg-protocol'

import { HEIGHTS, fill_heights } from '../world_gen/noise.js'
import biomes from '../world_gen/biomes.js'
import create_voxel_chunk_column from '../world_gen/create_voxel_chunk_column.js'

const SEED = 'aresrpg_'

async function export_heights() {
  await fill_heights(SEED, biomes.DEFAULT)

  const buffer = Buffer.from(HEIGHTS)
  fs.writeFileSync(`./src/assets/world/heights.bin`, buffer)
}

async function export_chunks() {
  await fill_heights(SEED, biomes.DEFAULT)
  let total_size = 0
  const chunk_buffers = []

  for (let x = -MAP_BOUNDS / CHUNK_SIZE; x < MAP_BOUNDS / CHUNK_SIZE; x++) {
    for (let z = -MAP_BOUNDS / CHUNK_SIZE; z < MAP_BOUNDS / CHUNK_SIZE; z++) {
      console.log('Creating chunk', x, z)
      const buffer = await create_voxel_chunk_column({
        chunk_x: x,
        chunk_z: z,
        noise_buffer: HEIGHTS,
      })
      chunk_buffers.push(buffer)
      total_size += buffer.byteLength
    }
  }

  console.log('---------')

  // Now concatenate all buffers
  // Now concatenate all buffers with their lengths
  const combined_buffer = Buffer.alloc(total_size + chunk_buffers.length * 4) // additional space for lengths
  let offset = 0
  for (const buffer of chunk_buffers) {
    const buffer_length = buffer.byteLength
    console.log('wrtie buffer of length', buffer_length)
    combined_buffer.writeInt32LE(buffer_length, offset) // write the length of the buffer
    offset += Int32Array.BYTES_PER_ELEMENT
    combined_buffer.set(new Uint8Array(buffer), offset) // write the buffer
    offset += buffer_length
  }

  console.log('Total size:', offset)
  // Write the final combined buffer to a file
  fs.writeFileSync('./src/assets/world/world.bin', combined_buffer)
}

const time = Date.now()
await export_chunks()
console.log('Exported in', (Date.now() - time) / 1000, 'seconds')
