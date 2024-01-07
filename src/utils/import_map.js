import { CHUNK_SIZE, MAP_BOUNDS } from '@aresrpg/aresrpg-protocol'
import { Matrix4, Quaternion, Vector3 } from 'three'

import heights from '../assets/world/heights.bin?url'
import world from '../assets/world/world.bin?url'
import { VOLUME_SIZE_BYTES, read_volume } from '../world_gen/greedy_mesh'
import { HEIGHTS } from '../world_gen/noise'

import logger from './logger'
import { CHUNK_CACHE, make_chunk_key } from './chunks'

async function import_chunks() {
  // Fetching the combined buffer from the URL
  const response = await fetch(world)
  const combined_buffer = await response.arrayBuffer()
  const dataView = new DataView(combined_buffer)

  // Reusable variables for matrix transformations
  const reusable_matrix = new Matrix4()
  const reusable_position = new Vector3()
  const reusable_quaternion = new Quaternion()
  const reusable_scale = new Vector3(1, 1, 1)

  let offset = 0 // Offset in the combined buffer

  for (let x = -MAP_BOUNDS / CHUNK_SIZE; x < MAP_BOUNDS / CHUNK_SIZE; x++) {
    for (let z = -MAP_BOUNDS / CHUNK_SIZE; z < MAP_BOUNDS / CHUNK_SIZE; z++) {
      if (offset >= combined_buffer.byteLength) {
        // Break if we've reached the end of the buffer
        console.log('Reached end of buffer', x, z)
        break
      }

      // Read the length of the current chunk
      const chunkLength = dataView.getInt32(offset, true)
      offset += 4

      if (offset + chunkLength > combined_buffer.byteLength) {
        // Ensure we don't go out of bounds
        break
      }

      // Extract the chunk data from the combined buffer
      const chunkBuffer = combined_buffer.slice(offset, offset + chunkLength)
      const view = new DataView(chunkBuffer)
      const key = make_chunk_key({ x, z })
      const instanced_datas = []
      const origin_x = x * CHUNK_SIZE
      const origin_z = z * CHUNK_SIZE

      let local_offset = 0
      while (local_offset < chunkLength) {
        const volume = read_volume(local_offset, view)
        if (!volume) {
          local_offset += VOLUME_SIZE_BYTES
          continue
        }

        // Calculate the dimensions of the volume
        const width = volume.max.x - volume.min.x + 1
        const height = volume.max.y - volume.min.y + 1
        const depth = volume.max.z - volume.min.z + 1

        // Create a matrix for the instanced mesh
        reusable_matrix.compose(
          reusable_position.set(
            origin_x + volume.min.x + width / 2,
            volume.min.y + height / 2,
            origin_z + volume.min.z + depth / 2,
          ),
          reusable_quaternion,
          reusable_scale.set(width, height, depth),
        )

        instanced_datas.push({
          matrix: reusable_matrix.clone(),
          block: volume.block,
        })

        local_offset += VOLUME_SIZE_BYTES
      }

      CHUNK_CACHE.set(key, instanced_datas)

      offset += chunkLength // Move to the next chunk
    }
  }
}

const time = Date.now()
logger.ASSET('Loading heights..')

fetch(heights)
  .then(response => response.arrayBuffer())
  .then(async heights_buffer => {
    new Int16Array(HEIGHTS).set(new Int16Array(heights_buffer))
    logger.ASSET(`Heights loaded in ${Date.now() - time}ms`)

    const time2 = Date.now()
    logger.ASSET('Loading chunks..')
    await import_chunks()
    logger.ASSET(`Chunks loaded in ${Date.now() - time2}ms`)
  })
