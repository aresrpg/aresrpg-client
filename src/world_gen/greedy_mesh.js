import ndarray from 'ndarray'

export default function greedy_mesh({ chunk_size }) {
  return chunk => {
    const volumes = []
    const visited = ndarray(new Uint8Array(chunk_size ** 3), [
      chunk_size,
      chunk_size,
      chunk_size,
    ])

    function mark_visited(x, y, z, extend_x, extend_y, extend_z) {
      for (let i = x; i <= x + extend_x; i++) {
        for (let j = y; j <= y + extend_y; j++) {
          for (let k = z; k <= z + extend_z; k++) {
            visited.set(i, j, k, 1)
          }
        }
      }
    }

    function is_solid_and_unvisited(x, y, z) {
      return chunk.get(x, y, z) && !visited.get(x, y, z)
    }

    for (let z = 0; z < chunk_size; z++) {
      for (let y = 0; y < chunk_size; y++) {
        for (let x = 0; x < chunk_size; x++) {
          if (!is_solid_and_unvisited(x, y, z)) continue

          let extend_x = 0
          let extend_y = 0
          let extend_z = 0

          // Extend on the X axis
          while (
            x + extend_x + 1 < chunk_size &&
            is_solid_and_unvisited(x + extend_x + 1, y, z)
          ) {
            extend_x++
          }

          // Extend on the Y axis
          y_loop: for (let dy = 1; y + dy < chunk_size; dy++) {
            for (let dx = 0; dx <= extend_x; dx++) {
              if (!is_solid_and_unvisited(x + dx, y + dy, z)) break y_loop
            }
            extend_y = dy
          }

          // Extend on the Z axis
          z_loop: for (let dz = 1; z + dz < chunk_size; dz++) {
            for (let dy = 0; dy <= extend_y; dy++) {
              for (let dx = 0; dx <= extend_x; dx++) {
                if (!is_solid_and_unvisited(x + dx, y + dy, z + dz))
                  break z_loop
              }
            }
            extend_z = dz
          }

          mark_visited(x, y, z, extend_x, extend_y, extend_z)

          volumes.push({
            min: { x, y, z },
            max: { x: x + extend_x, y: y + extend_y, z: z + extend_z },
            color: chunk.get(x, y, z), // Assumes color is stored at each solid voxel
          })
        }
      }
    }

    return volumes
  }
}
