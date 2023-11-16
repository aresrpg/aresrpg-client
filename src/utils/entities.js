import {
  Mesh,
  Object3D,
  Color,
  Vector3,
  Box3,
  CapsuleGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three'

export function create_capsule({
  height,
  radius,
  color = '#ffff00',
  wireframe = false,
  opacity = 1,
}) {
  console.log(wireframe)
  const Material = wireframe ? MeshBasicMaterial : MeshStandardMaterial

  // Create a cylinder geometry with the calculated dimensions
  const geometry = new CapsuleGeometry(radius, height, wireframe ? 1 : 20, 20)

  return new Mesh(geometry, new Material({ color, opacity }))
}
