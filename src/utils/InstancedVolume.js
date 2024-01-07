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
  const r = ((hex >> 16) & 255) / 255
  const g = ((hex >> 8) & 255) / 255
  const b = (hex & 255) / 255
  return [r, g, b]
}

export default class InstancedVolume extends InstancedMesh {
  reusable_matrix = new Matrix4()
  reusable_color = new Color()
  current_index = 0

  constructor(capacity = 1000000) {
    super(
      geometry,
      new MeshPhongMaterial({
        specular: 0x999999,
        reflectivity: 0.15,
        side: FrontSide,
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

  add_volume(volume) {
    if (!volume) return false

    // Use currentIndex for setting and getting matrix and color
    const { matrix, block } = volume

    this.setMatrixAt(this.current_index, matrix)
    this.setColorAt(
      this.current_index,
      this.reusable_color.fromArray(unpack_color(block_at_index(block))),
    )

    // Increment currentIndex and cycle it if necessary
    this.current_index = (this.current_index + 1) % this.instanceMatrix.count

    // Increment count but only up to the maximum capacity
    if (this.count < this.instanceMatrix.count) this.count++

    this.force_update()

    return true
  }

  force_update() {
    this.instanceMatrix.needsUpdate = true
    this.instanceColor.needsUpdate = true
  }

  clear_volumes() {
    this.count = 0
    this.current_index = 0
    this.force_update()
  }

  expand({ envMap = null, capacity = this.count * 2 } = {}) {
    const expanded_instanced_volume = new InstancedVolume(capacity)

    expanded_instanced_volume.name = this.name
    expanded_instanced_volume.set_env_map(envMap)
    expanded_instanced_volume.copy(this)

    this.dispose()

    return expanded_instanced_volume
  }
}
