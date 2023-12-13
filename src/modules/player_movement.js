import { on } from 'events'
// @ts-ignore
import { setInterval } from 'timers/promises'

import { aiter } from 'iterator-helper'
import {
  Box3,
  Line3,
  MathUtils,
  Matrix4,
  Quaternion,
  Spherical,
  Vector3,
} from 'three'
import { lerp } from 'three/src/math/MathUtils.js'
import { get } from '@vueuse/core'
import { to_chunk_position } from 'aresrpg-protocol'

import { GRAVITY } from '../game.js'
import { abortable } from '../utils/iterator'
import { compute_animation_state } from '../utils/animation.js'

const SPEED = 10
const JUMP_FORCE = 23
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

function rounded_position(position) {
  const factor = Math.pow(10, 5)
  return new Vector3()
    .copy(position)
    .multiplyScalar(factor)
    .round()
    .divide(factor)
}

function compute_and_play_animation({
  current_animation,
  on_ground,
  is_moving_horizontally,
  inputs,
  animations,
  jump_state,
}) {
  if (on_ground) {
    if (is_moving_horizontally && current_animation !== animations.RUN) {
      fade_to_animation(current_animation, animations.RUN, 0.3)
      return animations.RUN
    } else if (
      !is_moving_horizontally &&
      current_animation !== animations.IDLE &&
      current_animation !== animations.DANCE
    ) {
      fade_to_animation(current_animation, animations.IDLE, 0.3)
      return animations.IDLE
    }
  } else if (
    jump_state === jump_states.ASCENT &&
    current_animation !== animations.JUMP
  ) {
    fade_to_animation(current_animation, animations.JUMP, 0)
    return animations.JUMP
  } else if (
    (jump_state === jump_states.APEX || jump_state === jump_states.DESCENT) &&
    current_animation !== animations.FALLING
  ) {
    fade_to_animation(current_animation, animations.FALLING, 0.3)
    return animations.FALLING
  } else if (
    current_animation !== animations.FALLING &&
    current_animation !== animations.JUMP
  ) {
    fade_to_animation(current_animation, animations.FALLING, 0.5)
    return animations.FALLING
  }

  if (on_ground && inputs.dance && current_animation !== animations.DANCE) {
    fade_to_animation(current_animation, animations.DANCE, 0.3)
    return animations.DANCE
  }
}

/** @type {Type.Module} */
export default function ({ world }) {
  const velocity = new Vector3()
  const controller = world.createCharacterController(CONTROLLER_OFFSET)
  const model_forward = new Vector3(0, 0, 1)

  // Don’t allow climbing slopes larger than 45 degrees.
  controller.setMaxSlopeClimbAngle((45 * Math.PI) / 180)
  // Automatically slide down on slopes smaller than 30 degrees.
  controller.setMinSlopeSlideAngle((30 * Math.PI) / 180)

  controller.enableAutostep(1.6, 0.3, false)
  controller.enableSnapToGround(0.7)
  // controller.setCharacterMass(100)
  controller.setSlideEnabled(true)

  let jump_state = jump_states.NONE
  let jump_cooldown = 0
  const current_animation = null
  let on_ground = 0

  let is_dancing = false

  return {
    name: 'player_movements',
    tick({ inputs, player }, { camera, send_packet, events }, delta) {
      if (!player) return

      const {
        animations,
        rapier_body: { collider, rigid_body },
      } = player
      const position = player.position()
      const camera_forward = new Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion)
        .setY(0)
        .normalize()
      const camera_right = new Vector3(1, 0, 0)
        .applyQuaternion(camera.quaternion)
        .setY(0)
        .normalize()

      if (player.target_position) {
        player.move(player.target_position)
        player.target_position = null
        return
      }

      // Avoid falling to hell
      // TODO: tp to nether if falling to hell
      if (position.y <= -30) {
        velocity.setScalar(0)
        player.move(new Vector3(0, 100, 0))
        return
      }

      const movement = new Vector3()

      if (inputs.forward) movement.add(camera_forward)
      if (inputs.backward) movement.sub(camera_forward)
      if (inputs.right) movement.add(camera_right)
      if (inputs.left) movement.sub(camera_right)

      // normalize sideways movement
      if (movement.length()) movement.normalize().multiplyScalar(SPEED * delta)

      // Apply jump force
      if (on_ground) {
        if (jump_cooldown > 0) jump_cooldown -= delta
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
          on_ground = false

          send_packet('packet/entityAction', { id: '', action: 'JUMP' })
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
          velocity.y -= GRAVITY * ASCENT_GRAVITY_FACTOR * delta
          // prepare apex phase
          if (velocity.y <= 0.2) jump_state = jump_states.APEX
          break
        case jump_states.APEX:
          // if apex phase, apply reduced gravity
          velocity.y -= GRAVITY * APEX_GRAVITY_FACTOR * delta
          // prepare descent phase
          if (velocity.y <= 0) jump_state = jump_states.DESCENT
          break
        case jump_states.DESCENT:
          // if descent phase, apply increased gravity
          velocity.y -= GRAVITY * DESCENT_GRAVITY_FACTOR * delta
          // and also cancel forward impulse
          velocity.x = lerp(velocity.x, 0, 0.1)
          velocity.z = lerp(velocity.z, 0, 0.1)
          break
        case jump_states.NONE:
        default:
          // if not jumping, apply normal gravity
          velocity.y -= GRAVITY * delta
      }

      movement.addScaledVector(velocity, delta)

      controller.computeColliderMovement(collider, movement)
      on_ground = controller.computedGrounded()

      const { x, y, z } = controller.computedMovement()
      const corrected_movement = new Vector3(x, y, z)

      const is_moving_horizontally =
        corrected_movement.clone().setY(0).lengthSq() > 0.001

      if (inputs.dance && !is_dancing) {
        is_dancing = true
        send_packet('packet/entityAction', { id: '', action: 'DANCE' })
      }

      if (is_moving_horizontally) {
        player.rotate(corrected_movement)
        is_dancing = false
      }

      const animation_name = compute_animation_state({
        is_jumping: jump_state === jump_states.ASCENT,
        is_on_ground: on_ground,
        is_moving_horizontally,
        is_dancing: inputs.dance,
      })

      const new_position = new Vector3(
        position.x + corrected_movement.x,
        position.y + corrected_movement.y,
        position.z + corrected_movement.z,
      )

      if (new_position.distanceToSquared(position) > 0.001) {
        player.move(new_position)
        player.animate(animation_name, delta)
      } else player.animate(inputs.dance ? 'DANCE' : 'IDLE', delta)

      const last_chunk = to_chunk_position(position)
      const current_chunk = to_chunk_position(new_position)

      if (last_chunk.x !== current_chunk.x || last_chunk.z !== current_chunk.z)
        events.emit('CHANGE_CHUNK', current_chunk)
    },
    reduce(state, { type, payload }) {
      if (type === 'packet/playerPosition') {
        return {
          ...state,
          player: {
            ...state.player,
            target_position: payload.position,
          },
        }
      }
      return state
    },
    observe({ events, world, signal, dispatch, get_state, send_packet }) {
      aiter(abortable(setInterval(50, null, { signal }))).reduce(
        last_position => {
          const { player } = get_state()

          if (!player) return last_position

          const position = player.position()
          const { x, y, z } = position

          if (
            last_position.x !== x ||
            last_position.y !== y ||
            last_position.z !== z
          ) {
            send_packet('packet/playerPosition', { position })
          }

          return position
        },
        new Vector3(),
      )
    },
  }
}
