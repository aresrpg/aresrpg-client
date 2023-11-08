import {
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Color,
} from 'three'

export default function create_ghost({
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
