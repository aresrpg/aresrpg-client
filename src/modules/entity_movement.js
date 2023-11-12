import { on } from 'events'

import { aiter } from 'iterator-helper'
import { Quaternion, Vector3 } from 'three'
import { Ray } from '@dimforge/rapier3d'
import { lerp } from 'three/src/math/MathUtils.js'

import { GRAVITY, PLAYER_ID } from '../game.js'

const SPEED = 0.1
const JUMP_FORCE = 13
const CONTROLLER_OFFSET = 0.01

const ASCENT_GRAVITY_FACTOR = 3
const APEX_GRAVITY_FACTOR = 0.3
const DESCENT_GRAVITY_FACTOR = 5
const JUMP_FORWARD_IMPULSE = 3
const JUMP_COOLDWON = 0.1 // one jump every 100ms

const jump_states = {
  ASCENT: 'ASCENT',
  APEX: 'APEX',
  DESCENT: 'DESCENT',
  NONE: 'NONE',
}

// last_positions are the latest state of positions the server or client wanted to enforce
// if the last wanted position becomes outdated, the entity will be moved to the latest position
function handle_entity_positions({ entities, last_positions }) {
  for (const entity of entities.values()) {
    const { rigid_body, collider, model, body_type } = entity

    if (
      body_type === 'kinematic' &&
      !last_positions.get(entity)?.equals(entity.position)
    )
      entity.move(entity.position)

    entity.update_mesh_position()
    last_positions.set(entity, entity.position.clone())
  }
}

function fade_to_animation(from, to, duration) {
  if (from !== to) {
    from.fadeOut(duration)
    to.reset().fadeIn(duration).play()
  }
}

/** @type {Type.Module} */
export default function ({ world }) {
  const last_positions = new WeakMap()
  const ray = new Ray(new Vector3(), new Vector3(0, -1, 0))
  const velocity = new Vector3()
  const controller = world.createCharacterController(CONTROLLER_OFFSET)
  const model_forward = new Vector3(0, 0, 1)

  controller.enableAutostep(0.7, 0.3, true)
  controller.enableSnapToGround(0.7)
  controller.setApplyImpulsesToDynamicBodies(true)

  let last_corrected_movement = new Vector3()
  let jump_state = jump_states.NONE
  let jump_cooldown = 0
  let current_animation = null

  return {
    tick({ player, entities, inputs }, { world, camera }, delta) {
      const delta_seconds = delta / 1000
      const { rigid_body, collider, animations } = player
      const camera_forward = new Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion)
        .setY(0)
        .normalize()
      const camera_right = new Vector3(1, 0, 0)
        .applyQuaternion(camera.quaternion)
        .setY(0)
        .normalize()

      if (!current_animation) {
        current_animation = animations.IDLE
        current_animation.play()
      }

      // handle movements of entities when their position changes
      handle_entity_positions({ entities, last_positions })
      // handle player movement

      const position = rigid_body.translation()

      // Avoid falling to hell
      // TODO: tp to nether if falling to hell
      if (position.y < -10) {
        player.move(new Vector3(0, 10, 0))
        player.update_mesh_position()
        return
      }

      const movement = new Vector3()

      // Horizontal movement based on inputs
      if (inputs.forward) {
        movement.add(camera_forward)
      }
      if (inputs.backward) {
        movement.sub(camera_forward)
      }
      if (inputs.left) {
        movement.sub(camera_right)
      }
      if (inputs.right) {
        movement.add(camera_right)
      }

      // normalize sideways movement
      if (movement.length()) {
        movement.normalize().multiplyScalar(SPEED)
      }

      const on_ground = controller.computedGrounded()

      // Apply jump force
      if (on_ground) {
        if (jump_cooldown > 0) jump_cooldown -= delta_seconds
        if (inputs.jump && jump_cooldown <= 0) {
          velocity.y = JUMP_FORCE

          const forward_impulse = movement
            .clone()
            .normalize()
            .multiplyScalar(JUMP_FORWARD_IMPULSE)

          velocity.x += forward_impulse.x
          velocity.z += forward_impulse.z

          jump_state = jump_states.ASCENT
          jump_cooldown = JUMP_COOLDWON
        } else {
          jump_state = jump_states.NONE

          // reset jump impulse
          velocity.x = 0
          velocity.z = 0
          velocity.y = 0
        }
      }

      switch (jump_state) {
        case jump_states.ASCENT:
          // if started jumping, apply normal gravity
          velocity.y -= GRAVITY * ASCENT_GRAVITY_FACTOR * delta_seconds
          // prepare apex phase
          if (velocity.y <= 0.2) jump_state = jump_states.APEX
          break
        case jump_states.APEX:
          // if apex phase, apply reduced gravity
          velocity.y -= GRAVITY * APEX_GRAVITY_FACTOR * delta_seconds
          // prepare descent phase
          if (velocity.y <= 0) jump_state = jump_states.DESCENT
          break
        case jump_states.DESCENT:
          // if descent phase, apply increased gravity
          velocity.y -= GRAVITY * DESCENT_GRAVITY_FACTOR * delta_seconds
          // and also cancel forward impulse
          velocity.x = lerp(velocity.x, 0, 0.1)
          velocity.z = lerp(velocity.z, 0, 0.1)
          break
        case jump_states.NONE:
        default:
          // if not jumping, apply normal gravity
          velocity.y -= GRAVITY * delta_seconds
      }

      movement.y += velocity.y * delta_seconds
      movement.x += velocity.x * delta_seconds
      movement.z += velocity.z * delta_seconds

      controller.computeColliderMovement(collider, movement)

      const { x, y, z } = controller.computedMovement()
      const corrected_movement = new Vector3(x, y, z)
      const is_moving_horizontally = !!corrected_movement
        .clone()
        .setY(0)
        .lengthSq()

      if (is_moving_horizontally) {
        // Use lengthSq for efficiency, as we're only checking for non-zero length
        const flat_movement = corrected_movement.clone().setY(0).normalize()

        // Calculate the target quaternion: this rotates modelForward to align with flatMovement
        const quaternion = new Quaternion().setFromUnitVectors(
          model_forward,
          flat_movement,
        )
        player.model.quaternion.slerp(quaternion, 0.2)
      }

      if (on_ground) {
        if (is_moving_horizontally && current_animation !== animations.RUN) {
          fade_to_animation(current_animation, animations.RUN, 0.3)
          current_animation = animations.RUN
        } else if (
          !is_moving_horizontally &&
          current_animation !== animations.IDLE &&
          current_animation !== animations.DANCE
        ) {
          fade_to_animation(current_animation, animations.IDLE, 0.3)
          current_animation = animations.IDLE
        }
      } else if (
        jump_state === jump_states.ASCENT &&
        current_animation !== animations.JUMP
      ) {
        fade_to_animation(current_animation, animations.JUMP, 0)
        current_animation = animations.JUMP
      } else if (
        (jump_state === jump_states.APEX ||
          jump_state === jump_states.DESCENT) &&
        current_animation !== animations.FALLING
      ) {
        fade_to_animation(current_animation, animations.FALLING, 0.3)
        current_animation = animations.FALLING
      } else if (
        current_animation !== animations.FALLING &&
        current_animation !== animations.JUMP
      ) {
        fade_to_animation(current_animation, animations.FALLING, 0.5)
        current_animation = animations.FALLING
      }

      if (on_ground && inputs.dance && current_animation !== animations.DANCE) {
        fade_to_animation(current_animation, animations.DANCE, 0.3)
        current_animation = animations.DANCE
      }

      // Move the player if there's a change in position
      if (!corrected_movement.equals(last_corrected_movement)) {
        player.move({
          x: position.x + corrected_movement.x,
          y: position.y + corrected_movement.y,
          z: position.z + corrected_movement.z,
        })

        player.update_mesh_position()
      }

      animations.mixer.update(delta_seconds)
      last_corrected_movement = corrected_movement
    },
    reduce(state, { type, payload }) {
      if (type === 'packet:ENTITY_MOVE') {
        const { id, position } = payload
        const [x, y, z] = position
        const entity = id === PLAYER_ID ? state.player : state.entities.get(id)

        entity.position.set(x, y, z)
      }

      if (type === 'PLAYER_MOVED') state.player.position.copy(payload)

      return state
    },
  }
}
