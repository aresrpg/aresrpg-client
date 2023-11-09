import {
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Color,
  Vector3,
  Box3,
} from 'three'
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d'

import { load_fbx } from './load_model'

export function create_capsule({
  height,
  radius,
  position,
  visible = true,
  color = '#ffff00',
  wireframe = false,
  opacity = 1,
}) {
  if (!visible) return new Object3D()

  // Create a cylinder geometry with the calculated dimensions
  const geometry = new CylinderGeometry(radius, radius, height, 32)
  const material = new MeshBasicMaterial({
    color: new Color(color),
    wireframe, // Wireframe to see through
    transparent: true,
    opacity, // Semi-transparent to visualize as a ghost object
  })

  // Create a mesh with the geometry and material
  const capsule = new Mesh(geometry, material)

  // Move the capsule to the position of the model
  capsule.position.copy(position)

  // Adjust the position of the capsule to align it with the bottom of the model if necessary
  capsule.position.y += height / 2

  return capsule
}

/**
 *
 * @param {Object} param0
 * @param {import("@dimforge/rapier3d").World} param0.world
 */
export function create_rigid_entity({
  world,
  height,
  radius,
  type = 'kinematic',
  shape = 'capsule',
}) {
  const rigid_body_descriptor =
    type === 'kinematic'
      ? RigidBodyDesc.kinematicPositionBased()
      : type === 'dynamic'
      ? RigidBodyDesc.dynamic()
      : RigidBodyDesc.fixed()

  const collider_descriptor = ColliderDesc[shape](height, radius)
  const rigid_body = world.createRigidBody(rigid_body_descriptor)
  const collider = world.createCollider(collider_descriptor, rigid_body)

  return {
    rigid_body,
    collider,
    move(position) {
      if (type === 'kinematic') {
        rigid_body.setNextKinematicTranslation(position)
      } else if (type === 'dynamic') {
        rigid_body.setTranslation(position)
      } else throw new Error('Static rigid bodies cannot be moved')

      return rigid_body.translation()
    },
  }
}
