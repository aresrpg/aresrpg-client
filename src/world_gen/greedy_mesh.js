import { CHUNK_SIZE, WORLD_HEIGHT } from '@aresrpg/aresrpg-protocol'
import ndarray from 'ndarray'

export const VOLUME_SIZE_BYTES = 8 // 6 * Uint8 + 1 * Uint16

export function write_volume(offset, volume, view) {
  const { min, max, block } = volume

  view.setUint8(offset, min.x)
  view.setUint8(offset + 1, min.y)
  view.setUint8(offset + 2, min.z)
  view.setUint8(offset + 3, max.x)
  view.setUint8(offset + 4, max.y)
  view.setUint8(offset + 5, max.z)
  view.setUint16(offset + 6, block)
}

export function read_volume(offset, view) {
  const block = view.getUint16(offset + 6)

  if (block)
    return {
      min: {
        x: view.getUint8(offset),
        y: view.getUint8(offset + 1),
        z: view.getUint8(offset + 2),
      },
      max: {
        x: view.getUint8(offset + 3),
        y: view.getUint8(offset + 4),
        z: view.getUint8(offset + 5),
      },
      block,
    }
}

function mark_visited(visited, x, y, z, extend_x, extend_y, extend_z) {
  for (let i = x; i <= x + extend_x; i++) {
    for (let j = y; j <= y + extend_y; j++) {
      for (let k = z; k <= z + extend_z; k++) {
        visited.set(i, j, k, 1)
      }
    }
  }
}

function is_solid_and_unvisited(visited, chunk, x, y, z, block) {
  const data = chunk.get(x, y, z)
  if (!data) return false // Skip if no color (not solid)
  return !visited.get(x, y, z) && data.block === block
}

export default function greedy_mesh(chunk) {
  const visited = ndarray(
    new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE),
    [CHUNK_SIZE, WORLD_HEIGHT, CHUNK_SIZE],
  )
  let offset = 0
  const volumes = []

  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        if (visited.get(x, y, z)) continue

        const data = chunk.get(x, y, z)
        if (!data) continue // Skip if no block (not solid)

        const { block } = data

        let extend_x = 0
        let extend_y = 0
        let extend_z = 0

        // Extend on the X axis
        while (
          x + extend_x + 1 < CHUNK_SIZE &&
          is_solid_and_unvisited(visited, chunk, x + extend_x + 1, y, z, block)
        ) {
          extend_x++
        }

        // Extend on the Y axis
        y_loop: for (let dy = 1; y + dy < WORLD_HEIGHT; dy++) {
          for (let dx = 0; dx <= extend_x; dx++) {
            if (
              !is_solid_and_unvisited(visited, chunk, x + dx, y + dy, z, block)
            )
              break y_loop
          }
          extend_y = dy
        }

        // Extend on the Z axis
        z_loop: for (let dz = 1; z + dz < CHUNK_SIZE; dz++) {
          for (let dy = 0; dy <= extend_y; dy++) {
            for (let dx = 0; dx <= extend_x; dx++) {
              if (
                !is_solid_and_unvisited(
                  visited,
                  chunk,
                  x + dx,
                  y + dy,
                  z + dz,
                  block,
                )
              )
                break z_loop
            }
          }
          extend_z = dz
        }

        mark_visited(visited, x, y, z, extend_x, extend_y, extend_z)

        const volume = {
          min: { x, y, z },
          max: { x: x + extend_x, y: y + extend_y, z: z + extend_z },
          block,
        }

        volumes.push(volume)
        // write_volume(offset, volume, view)
        offset += VOLUME_SIZE_BYTES
      }
    }
  }

  const volumes_buffer = new SharedArrayBuffer(offset)
  const view = new DataView(volumes_buffer)
  volumes.forEach((volume, i) =>
    write_volume(i * VOLUME_SIZE_BYTES, volume, view),
  )

  return volumes_buffer
}
