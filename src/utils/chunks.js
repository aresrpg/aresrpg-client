import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshPhongMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RigidBodyDesc, ColliderDesc } from '@dimforge/rapier3d'
import { StaticGeometryGenerator } from 'three-mesh-bvh'
import workerpool from 'workerpool'
import { CHUNK_SIZE } from 'aresrpg-protocol'

import Biomes from '../world_gen/biomes.js'

import { load_gltf, load_obj } from './load_model.js'

const pool = workerpool.pool('src/world_gen/chunk_worker.js', {
  workerOpts: {
    type: 'module',
  },
})

/**
 * @param {Object} Options
 * @param {number} Options.chunk_x
 * @param {number} Options.chunk_z
 * @param {import("@dimforge/rapier3d").World} Options.world
 */
export default async function request_chunk_load({ chunk_x, chunk_z, world }) {
  const cubes = await pool.exec('create_chunk', [
    chunk_x,
    chunk_z,
    Biomes.DEFAULT,
  ])

  const voxel_geometry = new BoxGeometry(1, 1, 1)

  const mesh = new InstancedMesh(
    voxel_geometry,
    new MeshToonMaterial(),
    cubes.length,
  )

  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.set(chunk_x * CHUNK_SIZE, 0, chunk_z * CHUNK_SIZE)

  cubes.forEach((cube, index) => {
    const {
      x,
      y,
      z,
      data: { color },
    } = cube
    mesh.setColorAt(index, new Color(color))
    mesh.setMatrixAt(index, new Matrix4().setPosition(x, y, z))
  })

  const temp_meshes = cubes.map(cube => {
    const voxel = new Mesh(voxel_geometry)
    voxel.position.set(
      chunk_x * CHUNK_SIZE + cube.x,
      cube.y,
      chunk_z * CHUNK_SIZE + cube.z,
    )
    voxel.updateMatrixWorld(true)
    return voxel
  })

  const static_geometry = new StaticGeometryGenerator(temp_meshes).generate()

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
    voxel_count: cubes.length,
    terrain: mesh,
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
