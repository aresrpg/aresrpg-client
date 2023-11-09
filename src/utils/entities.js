import {
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Color,
  Vector3,
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
 * @param {Object} param
 * @param {import('@dimforge/rapier3d').World} param.world
 * @returns
 */
export async function create_kinetic_entity({
  world,
  height,
  radius,
  position,
}) {
  // Create a dynamic body for the character
  const rigid_body_descriptor = RigidBodyDesc.kinematicPositionBased()
  const collider_descriptor = ColliderDesc.capsule(height, radius)
  const rigid_body = world.createRigidBody(rigid_body_descriptor)
  const collider = world.createCollider(collider_descriptor, rigid_body)

  rigid_body.setNextKinematicTranslation(position)

  return { rigid_body, collider }
}

export async function create_character({ world, position }) {
  const model = await load_fbx('src/models/guard.fbx')
  const size = new Vector3()
  const bounding_box = new Box3().setFromObject(model)

  bounding_box.getSize(size)

  const height = size.y
  const radius = Math.max(size.x, size.z) * 0.5

  const { rigid_body, collider } = await create_kinetic_entity({
    world,
    height,
    radius,
    position,
  })

  scene.add(model)

  return { model, rigid_body, collider, height, radius }
}
