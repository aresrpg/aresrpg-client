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
import { to_chunk_position } from 'aresrpg-protocol'

import { GRAVITY } from '../game.js'
import { abortable } from '../utils/iterator'
import { compute_animation_state } from '../utils/animation.js'

const SPEED = 7
const JUMP_FORCE = 23
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
  const model_forward = new Vector3(0, 0, 1)

  let jump_state = jump_states.NONE
  let jump_cooldown = 0
  const current_animation = null
  let on_ground = 0

  let is_dancing = false

  return {
    name: 'player_movements',
    tick(
      { inputs, player },
      { camera, send_packet, events, navigation },
      delta,
    ) {
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
      const target_position = position.clone().add(movement)

      const { nearestRef } = navigation.navmesh_query.findNearestPoly(position)
      const {
        success: movement_success,
        resultPosition,
        visited,
      } = navigation.navmesh_query.moveAlongSurface(
        nearestRef,
        position,
        target_position,
      )

      const move_along_surface_final_referance = visited.at(-1)
      const { success: height_sucess, height } =
        navigation.navmesh_query.getPolyHeight(
          move_along_surface_final_referance,
          resultPosition,
        )

      const found_path = movement_success && height_sucess

      if (height_sucess) resultPosition.y = height

      on_ground = height_sucess

      const new_position = found_path
        ? new Vector3().copy(resultPosition)
        : position.clone().add(movement)

      // if (movement.y > 0) {
      //   new_position.add(new Vector3(0, movement.y, 0))
      // }

      const is_moving_horizontally =
        inputs.forward || inputs.backward || inputs.left || inputs.right

      if (inputs.dance && !is_dancing) {
        is_dancing = true
        send_packet('packet/entityAction', { id: '', action: 'DANCE' })
      }

      if (is_moving_horizontally) {
        player.rotate(new_position.clone().sub(position))
        is_dancing = false
      }

      const animation_name = compute_animation_state({
        is_jumping: jump_state === jump_states.ASCENT,
        is_on_ground: height_sucess,
        is_moving_horizontally,
        is_dancing: inputs.dance,
      })

      if (
        new Vector3().copy(new_position).distanceToSquared(position) > 0.001
      ) {
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
