import {
  MeshBVH,
  MeshBVHVisualizer,
  StaticGeometryGenerator,
} from 'three-mesh-bvh'
import {
  AnimationMixer,
  Box3,
  Group,
  Line3,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  Sphere,
  TextureLoader,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import dungeon from './models/dungeon/scene.gltf?url'
import { load_gltf } from './utils/load_model.js'
import { create_capsule } from './utils/entities.js'
import Pool from './pool.js'
import { GRAVITY, PLAYER_ID } from './game'

const CHUNK_SIZE = 100

const make_chunk_key = (x, z) => `${x}:${z}`

const Chunks = {
  [make_chunk_key(0, 0)]: await load_gltf(dungeon),
}

function compute_transformed_matrix(entity, desired_movement) {
  // Create a translation matrix from the velocity vector (desired_movement)
  const translation_matrix = new Matrix4().makeTranslation(
    desired_movement.x,
    desired_movement.y,
    desired_movement.z,
  )

  // Multiply the entity's matrixWorld with the translation matrix
  return new Matrix4().multiplyMatrices(entity.matrixWorld, translation_matrix)
}

function get_model_size(model, scale = 0.01) {
  const bbox = new Box3().setFromObject(model)
  const size = bbox.getSize(new Vector3())
  const center = bbox.getCenter(new Vector3())

  const height = size.y / scale / 2
  const radius = size.z + size.x / scale / 2 / 2

  return {
    height,
    radius,
    segment: new Line3(new Vector3(), new Vector3(0, -height, 0.0)),
  }
}

export default class World {
  /** @type {Map<string, Mesh>} chunk position to chunk */
  loaded_chunks_colliders = new Map()
  loaded_chunks_models = new Map()
  loaded_chunks_visualizers = new Map()

  /** @type {Map<string, Mesh>}  id to entity */
  entities = new Map()

  visualizers_depth = 10

  constructor({ scene }) {
    this.scene = scene
  }

  /**
   * @param {import("./pool").ModelPool} pooled_entity
   */
  static create_entity(pooled_entity) {
    const { model, mixer, ...animations } = pooled_entity.get()

    if (!model) throw new Error('No more models available')

    const three_entity = new Object3D()
    const { height, radius, segment } = get_model_size(model)

    model.position.set(0, -height, 0)

    const collider = create_capsule({
      height,
      radius,
      color: '#dddddd',
    })

    collider.geometry.computeBoundsTree()
    collider.castShadow = true
    collider.receiveShadow = true
    collider.material.shadowSide = 2

    const visualizer = new MeshBVHVisualizer(collider)

    model.name = 'model'
    visualizer.name = 'visualizer'
    collider.name = 'collider'

    model.position.y -= height * 0.6
    visualizer.position.y -= height / 2
    collider.position.y -= height / 2

    three_entity.add(model)
    three_entity.add(visualizer)
    three_entity.add(collider)

    return {
      id: '',
      three_entity,
      height,
      radius,
      segment,
      animations: {
        mixer,
        ...animations,
      },
      position: three_entity.position,
      target_position: null,
    }
  }

  static chunk_position(position) {
    const x = Math.floor((position.x + CHUNK_SIZE / 2) / CHUNK_SIZE)
    const z = Math.floor((position.z + CHUNK_SIZE / 2) / CHUNK_SIZE)

    return { x, z }
  }

  /** @type {(state: Type.State) => void} */
  step({
    settings: {
      volume_depth,
      show_terrain_collider,
      show_terrain_volume,
      show_terrain,
      show_entities_collider,
      show_entities_volume,
      show_entities,
      debug_mode,
    },
  } = INITIAL_STATE) {
    for (const entity of this.entities.values()) {
      if (entity.target_position) {
        entity.position.copy(entity.target_position)
        entity.target_position = null
      }
    }

    if (!debug_mode) return

    this.loaded_chunks_visualizers.forEach(visualizer => {
      if (visualizer.depth !== volume_depth) visualizer.depth = volume_depth
      if (visualizer.visible !== show_terrain_volume)
        visualizer.visible = show_terrain_volume

      visualizer.update()
    })

    this.loaded_chunks_colliders.forEach(chunk_collider => {
      if (chunk_collider.visible !== show_terrain_collider)
        chunk_collider.visible = show_terrain_collider
    })

    this.loaded_chunks_models.forEach(chunk_model => {
      if (chunk_model.visible !== show_terrain)
        chunk_model.visible = show_terrain
    })

    this.entities.forEach(({ three_entity }) => {
      const model = three_entity.getObjectByName('model')
      const collider = three_entity.getObjectByName('collider')
      const visualizer = three_entity.getObjectByName('visualizer')

      if (collider && collider.visible !== show_entities_collider)
        collider.visible = show_entities_collider

      if (visualizer) {
        if (visualizer.visible !== show_entities_volume)
          visualizer.visible = show_entities_volume
        if (visualizer.depth !== volume_depth) visualizer.depth = volume_depth
      }

      if (model && model.visible !== show_entities)
        model.visible = show_entities
    })
  }

  spawn_entity({ id, entity, scene, position }) {
    entity.id = id
    entity.position.copy(position)
    scene.add(entity.three_entity)
    this.entities.set(id, entity)
  }

  /** @type {(x: number, z: number) => void} */
  load_chunk(x, z) {
    const model = Chunks[make_chunk_key(x, z)]

    model.position.set(x * CHUNK_SIZE, 0, z * CHUNK_SIZE)

    const box = new Box3()
    const meshes_by_color = new Map()
    const terrain = new Group()

    box.setFromObject(model)
    box.getCenter(model.position).negate()

    model.updateMatrixWorld(true)
    model.traverse(child => {
      if (child.isMesh) {
        const mesh_color = child.material.color.getHex()

        if (!meshes_by_color.has(mesh_color))
          meshes_by_color.set(mesh_color, [])

        meshes_by_color.get(mesh_color).push(child)
      }
    })

    meshes_by_color.forEach((meshes, mesh_color) => {
      const visual_geometries = meshes
        .map(mesh => {
          if (mesh.material.emissive.r) {
            terrain.attach(mesh)
            return null
          }
          return mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
        })
        .filter(Boolean)

      if (visual_geometries.length) {
        const merged_geometry = mergeGeometries(visual_geometries)
        const mesh = new Mesh(
          merged_geometry,
          new MeshStandardMaterial({
            color: parseInt(mesh_color),
            shadowSide: 2,
          }),
        )

        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.material.shadowSide = 2

        terrain.add(mesh)
      }
    })

    const static_generator = new StaticGeometryGenerator(terrain)
    static_generator.attributes = ['position']

    const generated_geometry = static_generator.generate()
    generated_geometry.computeBoundsTree()

    const collider = new Mesh(generated_geometry)
    collider.material.wireframe = true
    collider.material.opacity = 0.4
    collider.material.transparent = true

    const visualizer = new MeshBVHVisualizer(collider)

    // adding the volumes to the scene
    this.scene.add(visualizer)
    // adding the collider (with wireframe material) to the scene
    this.scene.add(collider)
    // adding the terrain model to the scene
    this.scene.add(terrain)

    const key = make_chunk_key(x, z)

    this.loaded_chunks_colliders.set(key, collider)
    this.loaded_chunks_models.set(key, terrain)
    this.loaded_chunks_visualizers.set(key, visualizer)
  }

  /**
   * This function takes an entity and its desired movement and returns the
   * actual movement that can be applied to the entity according to the terrain
   *
   * @type {(collider: Type.Entity, desired_movement: Vector3) => { corrected_movement: Vector3, on_ground: boolean }
   */
  correct_movement(
    { three_entity, position, segment, radius },
    desired_movement,
  ) {
    const chunk_position = World.chunk_position(position)
    const chunk_key = make_chunk_key(chunk_position.x, chunk_position.z)
    const chunk_collider = this.loaded_chunks_colliders.get(chunk_key)

    if (!chunk_collider) {
      console.error('Chunk not loaded:', chunk_key, 'position:', position)
      return new Vector3()
    }

    const inverted_chunk_matrix = chunk_collider.matrixWorld.clone().invert()
    const desired_model_matrix = compute_transformed_matrix(
      three_entity,
      desired_movement,
    )
    const capsule_segment = segment.clone()

    // get the position of the capsule in the local space of the entity
    capsule_segment.start
      .applyMatrix4(desired_model_matrix)
      .applyMatrix4(inverted_chunk_matrix)

    capsule_segment.end
      .applyMatrix4(desired_model_matrix)
      .applyMatrix4(inverted_chunk_matrix)

    const axis_aligned_bounding_box = new Box3()

    // get the axis aligned bounding box of the capsule
    axis_aligned_bounding_box.expandByPoint(capsule_segment.start)
    axis_aligned_bounding_box.expandByPoint(capsule_segment.end)

    axis_aligned_bounding_box.min.addScalar(-radius)
    axis_aligned_bounding_box.max.addScalar(radius)

    const closest_point_in_triangle = new Vector3()
    const closest_point_in_segment = new Vector3()

    const adjustement = new Vector3()

    chunk_collider.geometry.boundsTree.shapecast({
      intersectsBounds: box => box.intersectsBox(axis_aligned_bounding_box),
      intersectsTriangle: triangle => {
        const distance = triangle.closestPointToSegment(
          capsule_segment,
          closest_point_in_triangle,
          closest_point_in_segment,
        )

        if (distance < radius) {
          const depth = radius - distance
          const direction = closest_point_in_segment
            .sub(closest_point_in_triangle)
            .normalize()

          adjustement.add(direction.multiplyScalar(depth))

          capsule_segment.start.addScaledVector(direction, depth)
          capsule_segment.end.addScaledVector(direction, depth)
        }
      },
    })

    // Apply the correction only if it exceeds a minimal length
    const offset = Math.max(0.0, adjustement.length() - 1e-5)
    adjustement.normalize().multiplyScalar(offset)

    // Apply the total adjustment to the desired movement to get the corrected movement
    const corrected_movement = desired_movement.clone().add(adjustement)
    const scale = Math.pow(10, 3) // For three decimal places

    corrected_movement.x = Math.round(corrected_movement.x * scale) / scale
    corrected_movement.z = Math.round(corrected_movement.z * scale) / scale

    const is_moving_horizontally = !!corrected_movement
      .clone()
      .setY(0)
      .lengthSq()

    return {
      corrected_movement,
      is_on_ground: corrected_movement.y > desired_movement.y,
      is_moving_horizontally,
    }
  }
}
