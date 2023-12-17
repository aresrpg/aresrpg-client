import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  Group,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RigidBodyDesc, ColliderDesc } from '@dimforge/rapier3d'
import workerpool from 'workerpool'
import { CHUNK_SIZE } from 'aresrpg-protocol'
import { WORLD_HEIGHT } from 'aresrpg-protocol/src/chunk.js'

import Biomes from '../world_gen/biomes.js'
import greedy_mesh from '../world_gen/greedy_mesh.js'

const pool = workerpool.pool('src/world_gen/chunk_worker.js', {
  workerOpts: {
    type: 'module',
  },
})

export async function request_low_detail_chunk_load({
  chunk_x,
  chunk_z,
  seed,
  biome,
  segments = 16,
}) {
  const { vertices, colors, indices } = await pool.exec(
    'create_low_detail_chunk_column',
    [chunk_x, chunk_z, biome, seed, segments],
  )

  const geometry = new BufferGeometry()

  // Convert vertices, colors, and indices to typed arrays
  const verticesTypedArray = new Float32Array(vertices)
  const colorsTypedArray = new Float32Array(colors)
  const indicesTypedArray = new Uint32Array(indices) // assuming indices are of type number

  // Add vertices, colors, and indices to geometry
  geometry.setIndex(new BufferAttribute(indicesTypedArray, 1))
  geometry.setAttribute('position', new BufferAttribute(verticesTypedArray, 3))
  geometry.setAttribute('color', new BufferAttribute(colorsTypedArray, 3))
  geometry.computeVertexNormals()

  const material = new MeshPhongMaterial({
    vertexColors: true,
    color: new Color(0.4, 0.4, 0.4), // Darken the base color
    emissive: new Color(0, 0, 0), // No additional light from the material itself
    specular: new Color(0, 0, 0), // Low specular highlights
    shininess: 10, // Adjust shininess for the size of the specular highlight
    side: BackSide,
  })

  const mesh = new Mesh(geometry, material)

  return {
    terrain: mesh,
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

/**
 * @param {Object} Options
 * @param {number} Options.chunk_x
 * @param {number} Options.chunk_z
 * @param {import("@dimforge/rapier3d").World} Options.world
 */
export async function request_chunk_load({
  chunk_x,
  chunk_z,
  world,
  seed,
  biome = Biomes.DEFAULT,
}) {
  /** @type {{ x: number, y: number, z: number, data: Object }[]} */
  const volumes = await pool.exec('create_chunk_column', [
    chunk_x,
    chunk_z,
    biome,
    seed,
  ])

  // Create an InstancedMesh for rendering
  const voxel_geometry = new BoxGeometry(1, 1, 1)
  const material = new MeshPhongMaterial({
    side: FrontSide,
  })
  const mesh = new InstancedMesh(voxel_geometry, material, volumes.length)

  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.set(chunk_x * CHUNK_SIZE, 0, chunk_z * CHUNK_SIZE)

  // Array to store mesh data for collision
  const collision_vertices = []
  const collision_indices = []

  // Process greedy volumes for rendering and collision
  volumes.forEach((volume, index) => {
    // Calculate the dimensions of the volume
    const width = volume.max.x - volume.min.x + 1
    const height = volume.max.y - volume.min.y + 1
    const depth = volume.max.z - volume.min.z + 1

    // For rendering: create a matrix for the instanced mesh
    const matrix = new Matrix4()
    matrix.makeTranslation(
      volume.min.x + width / 2,
      volume.min.y + height / 2,
      volume.min.z + depth / 2,
    )
    matrix.scale(new Vector3(width, height, depth))

    // Apply color and matrix to the instanced mesh
    mesh.setColorAt(index, new Color(volume.color))
    mesh.setMatrixAt(index, matrix)

    // For collision: create geometry for the volume
    const volume_geometry = new BoxGeometry(width, height, depth)

    // translate the volume according to the chunk position and multiply by the chunk size
    volume_geometry.translate(
      volume.min.x + width / 2,
      volume.min.y + height / 2,
      volume.min.z + depth / 2,
    )

    volume_geometry.translate(chunk_x * CHUNK_SIZE, 0, chunk_z * CHUNK_SIZE)

    // Merge this volume geometry into a single geometry for collision
    if (index === 0) {
      collision_vertices.push(...volume_geometry.attributes.position.array)
      collision_indices.push(...volume_geometry.index.array)
    } else {
      const offset = collision_vertices.length / 3
      collision_vertices.push(...volume_geometry.attributes.position.array)
      collision_indices.push(
        ...volume_geometry.index.array.map(idx => idx + offset),
      )
    }

    // Dispose of the temporary volume geometry
    volume_geometry.dispose()
  })

  mesh.instanceMatrix.needsUpdate = true

  // Create the collider mesh using the combined collision data
  const collision_geometry = new BufferGeometry()
  collision_geometry.setAttribute(
    'position',
    new Float32BufferAttribute(collision_vertices, 3),
  )
  collision_geometry.setIndex(collision_indices)
  const collider_mesh = new Mesh(
    collision_geometry,
    new MeshStandardMaterial({
      wireframe: true,
      color: 0x76ff03,
      emissive: 0x76ff03,
    }),
  )

  const vertices = new Float32Array(collision_vertices)
  const indices = new Uint32Array(collision_indices)

  const body_descriptor = RigidBodyDesc.fixed()
  const collider_descriptor = ColliderDesc.trimesh(vertices, indices)

  let rigid_body = null
  let collider = null

  const chunk_border = new Mesh(
    new BoxGeometry(CHUNK_SIZE, WORLD_HEIGHT, CHUNK_SIZE),
    new MeshBasicMaterial({
      color: 0x90a4ae,
      transparent: true,
      opacity: 0.2,
    }),
  )

  chunk_border.position.set(
    chunk_x * CHUNK_SIZE + CHUNK_SIZE / 2,
    WORLD_HEIGHT / 2,
    chunk_z * CHUNK_SIZE + CHUNK_SIZE / 2,
  )

  return {
    chunk_border,
    voxel_count: volumes.length,
    terrain: mesh,
    collider: collider_mesh,
    dispose() {
      mesh.dispose()
      mesh.geometry.dispose()
      mesh.material.dispose()
      collider_mesh.geometry.dispose()
      collider_mesh.material.dispose()
      chunk_border.geometry.dispose()
      chunk_border.material.dispose()
    },
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
