import { CHUNK_SIZE, WORLD_HEIGHT } from 'aresrpg-protocol'
import ndarray from 'ndarray'

export default function greedy_mesh(chunk) {
  const volumes = []
  const visited = ndarray(
    new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE),
    [CHUNK_SIZE, WORLD_HEIGHT, CHUNK_SIZE],
  )

  function mark_visited(x, y, z, extend_x, extend_y, extend_z) {
    for (let i = x; i <= x + extend_x; i++) {
      for (let j = y; j <= y + extend_y; j++) {
        for (let k = z; k <= z + extend_z; k++) {
          visited.set(i, j, k, 1)
        }
      }
    }
  }

  function is_solid_and_unvisited(x, y, z, color) {
    const data = chunk.get(x, y, z)
    if (!data) return false // Skip if no color (not solid)
    return !visited.get(x, y, z) && data.color === color
  }

  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        if (visited.get(x, y, z)) continue

        const data = chunk.get(x, y, z)
        if (!data) continue // Skip if no color (not solid)

        const { color } = data

        let extend_x = 0
        let extend_y = 0
        let extend_z = 0

        // Extend on the X axis
        while (
          x + extend_x + 1 < CHUNK_SIZE &&
          is_solid_and_unvisited(x + extend_x + 1, y, z, color)
        ) {
          extend_x++
        }

        // Extend on the Y axis
        y_loop: for (let dy = 1; y + dy < WORLD_HEIGHT; dy++) {
          for (let dx = 0; dx <= extend_x; dx++) {
            if (!is_solid_and_unvisited(x + dx, y + dy, z, color)) break y_loop
          }
          extend_y = dy
        }

        // Extend on the Z axis
        z_loop: for (let dz = 1; z + dz < CHUNK_SIZE; dz++) {
          for (let dy = 0; dy <= extend_y; dy++) {
            for (let dx = 0; dx <= extend_x; dx++) {
              if (!is_solid_and_unvisited(x + dx, y + dy, z + dz, color))
                break z_loop
            }
          }
          extend_z = dz
        }

        mark_visited(x, y, z, extend_x, extend_y, extend_z)

        volumes.push({
          min: { x, y, z },
          max: { x: x + extend_x, y: y + extend_y, z: z + extend_z },
          color, // Store the color for this volume
        })
      }
    }
  }

  return volumes
}
