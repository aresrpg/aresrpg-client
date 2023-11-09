import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import {
  AnimationMixer,
  Box3,
  Vector3,
  CylinderGeometry,
  Box3Helper,
  Color,
} from 'three'
import {
  RigidBodyDesc,
  RigidBodyType,
  ColliderDesc,
  Ray,
} from '@dimforge/rapier3d'

import { load_fbx } from '../utils/load_model.js'
import create_ghost from '../utils/entities.js'
import { GRAVITY } from '../game.js'

const KEYS = {
  FORWARD: 'KeyW',
  BACKWARD: 'KeyS',
  LEFT: 'KeyA',
  RIGHT: 'KeyD',
  JUMP: 'Space',
}

const ANIMATIONS = [
  'guard_dance',
  'guard_idle',
  'guard_jump',
  'guard_run_backward',
  'guard_run',
  'guard_strafe_left',
  'guard_strafe_right',
]

const SPEED = 0.05
const RAYCAST_DISTANCE = 2.0
const JUMP_FORCE = 5
const JUMP_BOOST = 2 // Extra forward force to apply when holding the jump button
const CONTROLLER_OFFSET = 0.01
const MAX_FALL_SPEED = -40 // The maximum speed the character can fall, negative for downward
const DESCENT_GRAVITY_MULTIPLIER = 3 // Stronger gravity multiplier for descent

/** @param {Object} param0
 * @param {*} param0.scene
 * @param {import("@dimforge/rapier3d").World} param0.world  */
export default async function create({ scene, world }) {
  const state = {
    on_ground: false,
    velocity: new Vector3(0, 0, 0),
    apex_reached: false,
  }

  const model = await load_fbx('src/models/guard.fbx')

  scene.add(model)

  const size = new Vector3()
  const bounding_box = new Box3().setFromObject(model)

  bounding_box.getSize(size)

  // Create a dynamic body for the character
  const dynamic_body = RigidBodyDesc.kinematicPositionBased()
  const capsule = ColliderDesc.capsule(size.y, Math.max(size.x, size.z) * 0.5)
  const rigid_body = world.createRigidBody(dynamic_body)
  const collider = world.createCollider(capsule, dynamic_body.handle)

  rigid_body.setNextKinematicTranslation({ x: 0, y: 5, z: 0 })

  const ghost = create_ghost({
    height: 2,
    radius: 0.5,
    position: new Vector3(0, 0, 0),
    color: '#283593',
    visible: true,
    wireframe: true,
  })

  scene.add(ghost)

  const controller = world.createCharacterController(0.01)

  controller.enableAutostep(0.7, 0.3, true)
  controller.enableSnapToGround(0.3)
  controller.setCharacterMass(1)
  controller.setApplyImpulsesToDynamicBodies(true)
  controller.setSlideEnabled(true)

  const key_state = {
    [KEYS.FORWARD]: false,
    [KEYS.BACKWARD]: false,
    [KEYS.LEFT]: false,
    [KEYS.RIGHT]: false,
    [KEYS.JUMP]: false,
  }

  function is_pressed(code) {
    return key_state[code]
  }

  function on_key_down({ code }) {
    const state = key_state[code]
    if (state == null || state) return
    key_state[code] = true
  }

  function on_key_up({ code }) {
    const state = key_state[code]
    if (state == null || !state) return
    key_state[code] = false
  }

  function verify_position() {
    const current_position = rigid_body.translation()
    const from = new Vector3(
      current_position.x,
      current_position.y,
      current_position.z,
    )
    const to = new Vector3(
      current_position.x,
      // this is the only way I found to correctly cast according to the model specific size
      current_position.y + 5,
      current_position.z,
    )
    const ray = new Ray(from, to)

    // check if the character is on the ground
    const hit = world.castRay(ray, RAYCAST_DISTANCE, true)

    if (hit) state.on_ground = true
  }

  window.addEventListener('keydown', on_key_down)
  window.addEventListener('keyup', on_key_up)

  return {
    context: {
      player_model: model,
    },
    update(delta, { lock_controls }) {
      verify_position()

      const position = rigid_body.translation()
      const movement = new Vector3()
      const delta_seconds = delta / 1000
      const locked = lock_controls.isLocked

      if (locked && is_pressed(KEYS.FORWARD)) movement.z -= SPEED
      if (locked && is_pressed(KEYS.BACKWARD)) movement.z += SPEED
      if (locked && is_pressed(KEYS.LEFT)) movement.x -= SPEED
      if (locked && is_pressed(KEYS.RIGHT)) movement.x += SPEED

      if (movement.length()) {
        movement.normalize()
        // After normalization, apply the speed
        movement.multiplyScalar(SPEED)
      }

      if (!state.on_ground) {
        if (!state.apex_reached) {
          // Apply initial stronger gravity after jump
          state.velocity.y -= GRAVITY * delta_seconds
          if (state.velocity.y <= 0) {
            console.log('apex reached')
            state.apex_reached = true // Flag to apply stronger gravity after apex
          }
        } else {
          // Apply much stronger gravity after the apex
          state.velocity.y -=
            GRAVITY * DESCENT_GRAVITY_MULTIPLIER * delta_seconds
        }

        // Clamp to max fall speed
        state.velocity.y = Math.max(state.velocity.y, MAX_FALL_SPEED)
      } else {
        state.apex_reached = false // Reset the flag when on ground
        // Reset the velocity when on ground
        state.velocity.y = 0
        state.velocity.x = 0
        state.velocity.z = 0
      }

      // Apply jump force as an impulse
      if (state.on_ground && locked && is_pressed(KEYS.JUMP)) {
        state.velocity.y = JUMP_FORCE
        state.on_ground = false // Set the flag that the character is in the air
        state.apex_reached = false
      }

      // Update the movement with the accumulated velocity
      movement.x += state.velocity.x * delta_seconds
      movement.y += state.velocity.y * delta_seconds
      movement.z += state.velocity.z * delta_seconds

      controller.computeColliderMovement(collider, movement)

      const corrected_movement = controller.computedMovement()

      position.x += corrected_movement.x
      position.y += corrected_movement.y
      position.z += corrected_movement.z

      // Set the kinematic body's next translation
      rigid_body.setNextKinematicTranslation(position)
      ghost.position.set(position.x, position.y + 1, position.z)

      model.position.set(position.x, position.y, position.z)
    },
    destroy({ renderer }) {
      window.removeEventListener('keydown', on_key_down)
      window.removeEventListener('keyup', on_key_up)
    },
  }
}
