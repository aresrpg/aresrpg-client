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
  Uint32BufferAttribute,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import workerpool from 'workerpool'
import { CHUNK_SIZE } from '@aresrpg/aresrpg-protocol'
import { WORLD_HEIGHT } from '@aresrpg/aresrpg-protocol/src/chunk.js'
import { MeshBVH, StaticGeometryGenerator } from 'three-mesh-bvh'

import Biomes from '../world_gen/biomes.js'
import greedy_mesh from '../world_gen/greedy_mesh.js'
import { from_chunk_key } from '../modules/game_world.js'
import chunk_worker from '../world_gen/chunk_worker.js?worker&url'

const pool = workerpool.pool(chunk_worker, {
  workerOpts: {
    type: 'module',
  },
})

const SEGMENTS = 16

export async function request_low_detail_chunks_load({ chunks, seed, biome }) {
  const geometries_data = await Promise.all(
    chunks.map(async key => {
      const { x, z } = from_chunk_key(key)

      const { vertices, colors, indices } = await pool.exec(
        'create_low_detail_chunk_column',
        [x, z, biome, seed, SEGMENTS],
      )

      // Convert vertices, colors, and indices to typed arrays
      const vertices_array = new Float32Array(vertices)
      const colors_array = new Float32Array(colors)
      const indices_array = new Uint32Array(indices) // assuming indices are of type number

      return {
        vertices: vertices_array,
        colors: colors_array,
        indices: indices_array,
      }
    }),
  )

  const total_vertices = geometries_data.reduce(
    (acc, data) => acc + data.vertices.length,
    0,
  )
  const total_colors = geometries_data.reduce(
    (acc, data) => acc + data.colors.length,
    0,
  )
  const total_indices = geometries_data.reduce(
    (acc, data) => acc + data.indices.length,
    0,
  )

  // Create SharedArrayBuffers
  const vertices_buffer = new SharedArrayBuffer(total_vertices * 4) // Float32 needs 4 bytes
  const colors_buffer = new SharedArrayBuffer(total_colors * 4) // Float32 needs 4 bytes
  const indices_buffer = new SharedArrayBuffer(total_indices * 4) // Assuming Uint32

  const shallow_geometry = await pool.exec('merge_geometries', [
    geometries_data,
    {
      vertices_buffer,
      colors_buffer,
      indices_buffer,
    },
  ])

  const geometry = new BufferGeometry()

  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(new Float32Array(vertices_buffer), 3),
  )
  geometry.setAttribute(
    'color',
    new Float32BufferAttribute(new Float32Array(colors_buffer), 3),
  )
  geometry.setIndex(
    new Uint32BufferAttribute(new Uint32Array(indices_buffer), 1),
  )

  return geometry
}

export async function request_chunk_load({
  chunk_x,
  chunk_z,
  seed,
  biome = Biomes.DEFAULT,
}) {
  /** @type {ReturnType<import("../world_gen/create_chunk.js")["create_chunk_column"]>} */
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
    specular: 0x404040,
  })
  const mesh = new InstancedMesh(voxel_geometry, material, volumes.length)

  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.set(chunk_x * CHUNK_SIZE, 0, chunk_z * CHUNK_SIZE)

  // Array to store mesh data for collision
  const collision_vertices = []
  const collision_indices = []

  const meshes = []

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
    meshes.push(new Mesh(volume_geometry))
  })

  mesh.instanceMatrix.needsUpdate = true

  const collision_geometry = new StaticGeometryGenerator(meshes).generate()

  const collider_mesh = new Mesh(
    collision_geometry,
    new MeshStandardMaterial({
      wireframe: true,
      color: 0x76ff03,
      emissive: 0x76ff03,
    }),
  )

  meshes.forEach(mesh => {
    mesh.geometry.dispose()
    mesh.material.dispose()
  })

  collision_geometry.boundsTree = new MeshBVH(collision_geometry)

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
  }
}
