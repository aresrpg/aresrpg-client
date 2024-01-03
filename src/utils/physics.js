import { Box3, Line3, Matrix4, Raycaster, Vector3 } from 'three'

const axis_aligned_bounding_box = new Box3()
const terrain_collider_matrix_in_local_space = new Matrix4()
const segment = new Line3()

const temporary_vector = new Vector3()
const temporary_vector2 = new Vector3()

const ray = new Raycaster()
const down_vector = new Vector3(0, -1, 0)

ray.firstHitOnly = true
ray.far = 5

const raycast_result = []

export function distance_from_ground({ position, height }, scene) {
  ray.set(position, down_vector)

  raycast_result.length = 0

  ray.intersectObjects(scene.children, false, raycast_result)
  if (raycast_result.length) {
    const [{ distance }] = raycast_result
    return distance - height
  }

  return Infinity
}

export function compute_movements({
  dummy,
  terrain_collider,
  character: { capsule_radius, capsule_segment },
  delta,
  velocity,
  objects,
}) {
  if (!terrain_collider) throw new Error('Missing terrain_collider')

  let is_on_ground = false

  Array.from([terrain_collider, ...objects]).forEach(collider => {
    axis_aligned_bounding_box.makeEmpty()
    terrain_collider_matrix_in_local_space.copy(collider.matrixWorld).invert()
    segment.copy(capsule_segment)

    segment.start
      .applyMatrix4(dummy.matrixWorld)
      .applyMatrix4(terrain_collider_matrix_in_local_space)
    segment.end
      .applyMatrix4(dummy.matrixWorld)
      .applyMatrix4(terrain_collider_matrix_in_local_space)

    axis_aligned_bounding_box.expandByPoint(segment.start)
    axis_aligned_bounding_box.expandByPoint(segment.end)
    axis_aligned_bounding_box.min.addScalar(-capsule_radius)
    axis_aligned_bounding_box.max.addScalar(capsule_radius)

    collider.geometry.boundsTree.shapecast({
      intersectsBounds: box => box.intersectsBox(axis_aligned_bounding_box),
      intersectsTriangle: triangle => {
        const triangle_point = temporary_vector
        const capsule_point = temporary_vector2

        const distance_between_triangle_and_capsule =
          triangle.closestPointToSegment(segment, triangle_point, capsule_point)

        if (distance_between_triangle_and_capsule < capsule_radius) {
          const depth = capsule_radius - distance_between_triangle_and_capsule
          const direction = capsule_point.sub(triangle_point).normalize()

          segment.start.addScaledVector(direction, depth)
          segment.end.addScaledVector(direction, depth)
        }
      },
    })

    const new_position = temporary_vector
      .copy(segment.start)
      .applyMatrix4(terrain_collider.matrixWorld)

    const delta_vector = temporary_vector2.subVectors(
      new_position,
      dummy.position,
    )

    const character_grounded =
      delta_vector.y > Math.abs(delta * velocity.y * 0.25)

    const offset_minus_epsilon = Math.max(0.0, delta_vector.length() - 1e-5)

    delta_vector.normalize().multiplyScalar(offset_minus_epsilon)

    dummy.position.copy(temporary_vector.copy(dummy.position).add(delta_vector))

    dummy.updateMatrixWorld()

    if (!character_grounded) {
      delta_vector.normalize()
      velocity.addScaledVector(delta_vector, -delta_vector.dot(velocity))
    } else {
      velocity.set(0, 0, 0)
    }

    is_on_ground = is_on_ground || character_grounded
  })

  return is_on_ground
}

const sensor_matrix_in_local_space = new Matrix4()

export function compute_sensors({
  player,
  player: { three_body },
  character: { capsule_radius, capsule_segment },
  sensors,
}) {
  sensors.forEach(({ sensor, on_collide }) => {
    axis_aligned_bounding_box.makeEmpty()
    sensor_matrix_in_local_space.copy(sensor.matrixWorld).invert()
    segment.copy(capsule_segment)

    segment.start
      .applyMatrix4(three_body.matrixWorld)
      .applyMatrix4(sensor_matrix_in_local_space)
    segment.end
      .applyMatrix4(three_body.matrixWorld)
      .applyMatrix4(sensor_matrix_in_local_space)

    axis_aligned_bounding_box.expandByPoint(segment.start)
    axis_aligned_bounding_box.expandByPoint(segment.end)
    axis_aligned_bounding_box.min.addScalar(-capsule_radius)
    axis_aligned_bounding_box.max.addScalar(capsule_radius)

    sensor.geometry.boundsTree.shapecast({
      intersectsBounds: box => box.intersectsBox(axis_aligned_bounding_box),
      intersectsTriangle: triangle => {
        const triangle_point = temporary_vector
        const capsule_point = temporary_vector2

        const distance_between_triangle_and_capsule =
          triangle.closestPointToSegment(segment, triangle_point, capsule_point)

        if (distance_between_triangle_and_capsule < capsule_radius)
          on_collide(player)
      },
    })
  })
}
