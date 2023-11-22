import { Group, Matrix4, Mesh, MeshStandardMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RigidBodyDesc, ColliderDesc } from '@dimforge/rapier3d'
import { StaticGeometryGenerator } from 'three-mesh-bvh'

import { load_gltf } from './utils/load_model.js'

/**
 * @param {import("@dimforge/rapier3d").World} world
 */
export default async function initialize_chunks(world) {
  async function prepare_chunk(path) {
    const model = await load_gltf(path)

    model.position.set(-20, 0, 50)

    model.updateMatrixWorld(true)
    model.traverse(child => {
      // @ts-ignore
      if (child.material) {
        child.castShadow = true
        child.receiveShadow = true
        // @ts-ignore
        child.material.shadowSide = 2
      }
    })

    const static_geometry = new StaticGeometryGenerator(model).generate()
    const collider_mesh = new Mesh(
      static_geometry,
      new MeshStandardMaterial({
        color: 0x00ff00,
        wireframe: true,
        opacity: 0.4,
      }),
    )
    const vertices = new Float32Array(static_geometry.attributes.position.array)
    const indices = new Uint32Array(static_geometry.index.array)

    const body_descriptor = RigidBodyDesc.fixed()
    const collider_descriptor = ColliderDesc.trimesh(vertices, indices)

    let rigid_body = null
    let collider = null

    return {
      terrain: model,
      collider: collider_mesh,
      enable_collisions(enable) {
        if (enable) {
          if (!rigid_body) rigid_body = world.createRigidBody(body_descriptor)
          if (!collider)
            collider = world.createCollider(collider_descriptor, rigid_body)
        } else {
          if (collider) world.removeCollider(collider, false)
          if (rigid_body) world.removeRigidBody(rigid_body)
          rigid_body = null
          collider = null
        }
      },
    }
  }

  return {
    '0:0': await prepare_chunk('/dungeon/scene.gltf'),
  }
}
