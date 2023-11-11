import {
  Mesh,
  Object3D,
  Color,
  Vector3,
  Box3,
  CapsuleGeometry,
  MeshLambertMaterial,
  MeshBasicMaterial,
} from 'three'
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d'

import { load_fbx } from './load_model'

export function create_capsule({
  height,
  radius,
  visible = true,
  color = '#ffff00',
  wireframe = false,
  opacity = 1,
}) {
  if (!visible) return new Object3D()

  const Material = wireframe ? MeshBasicMaterial : MeshLambertMaterial

  // Create a cylinder geometry with the calculated dimensions
  const geometry = new CapsuleGeometry(radius, height, 10, 10)
  const material = new Material({
    color: new Color(color),
    wireframe, // Wireframe to see through
    transparent: true,
    opacity, // Semi-transparent to visualize as a ghost object
  })

  return new Mesh(geometry, material)
}

/**
 *
 * @param {Object} param0
 * @param {import("@dimforge/rapier3d").World} param0.world
 * @param {string=} param0.type
 * @param {import("@dimforge/rapier3d").ColliderDesc} param0.collider_descriptor
 */
export function create_rigid_entity({
  world,
  type = 'kinematic',
  collider_descriptor,
}) {
  const rigid_body_descriptor =
    type === 'kinematic'
      ? RigidBodyDesc.kinematicPositionBased()
      : type === 'dynamic'
      ? RigidBodyDesc.dynamic()
      : RigidBodyDesc.fixed()

  const rigid_body = world.createRigidBody(rigid_body_descriptor)
  const collider = world.createCollider(collider_descriptor, rigid_body)

  return {
    rigid_body,
    collider,
    move(position) {
      if (type === 'kinematic') {
        rigid_body.setNextKinematicTranslation(position)
      } else if (type === 'dynamic') {
        rigid_body.setTranslation(position, true)
      } else throw new Error('Static rigid bodies cannot be moved')
    },
  }
}
