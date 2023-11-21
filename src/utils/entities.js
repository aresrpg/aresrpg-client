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
import { MeshBVH } from 'three-mesh-bvh'

export function create_capsule({
  height,
  radius,
  color = '#ffff00',
  wireframe = false,
  opacity = 1,
}) {
  const Material = wireframe ? MeshBasicMaterial : MeshStandardMaterial

  // Create a cylinder geometry with the calculated dimensions
  const geometry = new CapsuleGeometry(radius, height, wireframe ? 1 : 20, 20)

  geometry.boundsTree = new MeshBVH(geometry)

  return new Mesh(geometry, new Material({ color, opacity }))
}
