import { Matrix4, Quaternion, Vector3 } from 'three'

import { InstancedSkinnedMesh } from './InstancedSkinnedMesh.js'

export default class InstancedEntity extends InstancedSkinnedMesh {
  reusable_matrix = new Matrix4()
  entities = new Map()
  indexes = new Map()

  skinned_mesh
  actions
  mixer

  constructor({ skinned_mesh, actions, mixer, capacity = 100 }) {
    super(skinned_mesh, capacity)

    Object.assign(this, {
      skinned_mesh,
      actions,
      mixer,
    })

    this.copy(skinned_mesh)
    this.bind(skinned_mesh.skeleton, skinned_mesh.bindMatrix)

    skinned_mesh.visible = false

    this.frustumCulled = false

    this.count = 0
  }

  /**
   * Try to add an entity to the pool
   * @returns {boolean} Whether the entity was added or not, if false, the pool is full and you need to call `expand()`
   */
  add_entity(id) {
    if (this.entities.has(id)) return true

    const index = this.count

    if (index >= this.instanceMatrix.count) return false

    this.entities.set(id, {
      index,
      animations: new Map(),
      accumulated_delta: 0,
      position: new Vector3(),
      quaternion: new Quaternion(),
      last_quaternion: new Quaternion(),
    })

    this.count++
    this.instanceMatrix.needsUpdate = true

    return true
  }

  remove_entity(id) {
    if (!this.entities.has(id)) return

    const { index } = this.entities.get(id)
    const last_entity_index = this.count - 1

    // if the entity is not the last one
    if (index !== last_entity_index) {
      // move the last entity to the removed one
      this.getMatrixAt(last_entity_index, this.reusable_matrix)
      this.setMatrixAt(index, this.reusable_matrix)

      const last_entity = this.indexes.get(last_entity_index)

      last_entity.index = index
      last_entity.dirty = true

      this.indexes.set(index, last_entity)
      this.indexes.delete(last_entity_index)
    } else {
      this.indexes.delete(index)
    }

    this.count--
    this.instanceMatrix.needsUpdate = true

    this.entities.delete(id)
  }

  set_animation(id, animation_name) {
    if (!this.entities.has(id)) return

    const entity = this.entities.get(id)
    const { animations } = entity

    const existing = animations.get(animation_name) ?? { time: 0 }

    animations.forEach(animation => {
      animation.target_weight = 0
      animation.weight = 1
    })

    animations.set(animation_name, {
      ...existing,
      name: animation_name,
      target_weight: 1,
      weight: 0,
    })

    entity.dirty = true
  }

  set_low_priority(id, priority) {
    if (!this.entities.has(id)) return

    const entity = this.entities.get(id)

    entity.low_priority = priority
    entity.dirty = true
  }

  set_position(id, position) {
    if (!this.entities.has(id)) return

    const entity = this.entities.get(id)

    entity.position.copy(position)
    entity.dirty = true
  }

  set_quaternion(id, quaternion) {
    if (!this.entities.has(id)) return

    const entity = this.entities.get(id)

    entity.quaternion.copy(quaternion)
    entity.dirty = true
  }

  get_entity(id) {
    return this.entities.get(id)
  }

  tick(delta) {
    this.entities.forEach(entity => {
      entity.accumulated_delta += delta

      const {
        index,
        animations,
        accumulated_delta,
        low_priority,
        last_quaternion,
        quaternion,
        position: { x, y, z },
        dirty,
      } = entity

      if (low_priority && accumulated_delta < 0.2) return

      animations.forEach(animation => {
        const { name, weight, target_weight } = animation
        const action = this.actions[name]

        if (!weight && !target_weight) {
          animations.delete(name)
          return
        }

        if (!action) return

        animation.time += delta

        if (weight !== target_weight) {
          const fade_amount = delta / 0.3
          animation.weight +=
            animation.weight < animation.target_weight
              ? fade_amount
              : -fade_amount
          animation.weight = Math.max(0.0, Math.min(1.0, animation.weight)) // Clamp between 0 and 1
        }

        action.play()
        action.setEffectiveWeight(animation.weight)
        action.time = animation.time
      })

      this.mixer.update(0.001)

      entity.accumulated_delta = 0

      // those are needed only if the entity moved/rotated
      if (dirty) {
        entity.dirty = false

        this.skinned_mesh.rotation.setFromQuaternion(last_quaternion)
        this.skinned_mesh.quaternion.slerp(quaternion, 0.2)
        this.skinned_mesh.position.set(x, y, z)
        this.skinned_mesh.updateMatrix()

        entity.last_quaternion.copy(this.skinned_mesh.quaternion)

        this.setMatrixAt(index, this.skinned_mesh.matrix)
      }

      // those are needed in any case
      this.skinned_mesh.skeleton.bones.forEach(bone => bone.updateMatrixWorld())
      this.setBonesAt(index, this.skinned_mesh.skeleton)

      if (animations.size) {
        if (this.skeleton?.boneTexture)
          this.skeleton.boneTexture.needsUpdate = true
        // reset the mixer to avoid impacting other entities
        this.mixer.stopAllAction()
      }
    })

    this.instanceMatrix.needsUpdate = true
  }

  /**
   * Expand the pool capacity by recreating the mesh
   */
  expand({ skinned_mesh, actions, mixer, capacity = this.count ** 2 }) {
    const expanded_instanced_entity = new InstancedEntity({
      skinned_mesh,
      actions,
      capacity,
      mixer,
    })

    expanded_instanced_entity.name = this.name

    for (let index = 0; index < this.count; index++) {
      this.getMatrixAt(index, this.reusable_matrix)
      expanded_instanced_entity.setMatrixAt(index, this.reusable_matrix)
      expanded_instanced_entity.setBonesAt(index, this.skinned_mesh.skeleton)
      expanded_instanced_entity.count++
    }

    expanded_instanced_entity.entities = this.entities
    expanded_instanced_entity.indexes = this.indexes
    expanded_instanced_entity.instanceMatrix.needsUpdate = true

    this.dispose()

    return expanded_instanced_entity
  }
}
