import {
  BoxGeometry,
  Color,
  FrontSide,
  InstancedMesh,
  Matrix4,
  MeshPhongMaterial,
} from 'three'

import { block_at_index } from '../world_gen/chunk_data'

const geometry = new BoxGeometry(1, 1, 1)

export function unpack_color(hex) {
  const r = ((hex >> 16) & 255) / 255 // Extract the RR byte and normalize
  const g = ((hex >> 8) & 255) / 255 // Extract the GG byte and normalize
  const b = (hex & 255) / 255 // Extract the BB byte and normalize
  return [r, g, b]
}

export default class InstancedVolume extends InstancedMesh {
  reusable_matrix = new Matrix4()
  reusable_color = new Color()
  volumes = new Map()
  indexes = new Map()

  constructor(capacity = 1000000) {
    super(
      geometry,
      new MeshPhongMaterial({
        specular: 0x999999,
        // emissive: 0x000000,
        // emissiveIntensity: 0.5,
        reflectivity: 0.15,
        side: FrontSide,
        // roughness: 1,
        // metalness: 0,
        // flatShading: true,
        shininess: 30,
      }),
      capacity,
    )

    this.frustumCulled = false
    this.count = 0
    this.castShadow = true
    this.receiveShadow = true
  }

  set_env_map(envMap) {
    this.material.envMap = envMap
    this.material.needsUpdate = true
  }

  /**
   * Try to add a volume to the pool
   * @returns {boolean} Whether the volume was added (or already present) or not, if false, the pool is full and you need to call `expand()`
   */
  add_volume(volume) {
    if (!volume || this.volumes.has(volume)) return true

    const index = this.count

    if (index >= this.instanceMatrix.count) return false

    this.volumes.set(volume, index)
    this.indexes.set(index, volume)

    const { matrix, block } = volume

    // Apply color and matrix to the instanced mesh
    this.setColorAt(
      index,
      this.reusable_color.fromArray(unpack_color(block_at_index(block))),
    )
    this.setMatrixAt(index, matrix)

    this.count++
    this.instanceMatrix.needsUpdate = true
    this.instanceColor.needsUpdate = true

    return true
  }

  remove_volume(volume) {
    if (!volume || !this.volumes.has(volume)) return

    const index = this.volumes.get(volume)
    const last_volume_index = this.count - 1

    // if the volume is not the last one, move the last one to the removed one
    if (index !== last_volume_index) {
      this.getMatrixAt(last_volume_index, this.reusable_matrix)
      this.getColorAt(last_volume_index, this.reusable_color)
      this.setMatrixAt(index, this.reusable_matrix)
      this.setColorAt(index, this.reusable_color)

      // we also need to tell this volume that his index changed
      const last_volume = this.indexes.get(last_volume_index)

      this.volumes.set(last_volume, index)
      this.indexes.set(index, last_volume)
      this.indexes.delete(last_volume_index)
    } else {
      this.indexes.delete(index)
    }

    this.count--
    this.instanceMatrix.needsUpdate = true
    this.instanceColor.needsUpdate = true

    this.volumes.delete(volume)
  }

  /**
   * Expand the pool capacity by recreating the mesh
   */
  expand({ envMap = null, capacity = this.count * 2 } = {}) {
    const expanded_instanced_volume = new InstancedVolume(capacity)

    expanded_instanced_volume.name = this.name
    expanded_instanced_volume.set_env_map(envMap)
    expanded_instanced_volume.copy(this)
    expanded_instanced_volume.volumes = this.volumes
    expanded_instanced_volume.instanceMatrix.needsUpdate = true
    expanded_instanced_volume.instanceColor.needsUpdate = true

    this.dispose()

    return expanded_instanced_volume
  }
}
